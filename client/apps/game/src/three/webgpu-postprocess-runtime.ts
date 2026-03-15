import { ACESFilmicToneMapping, CineonToneMapping, LinearToneMapping, ReinhardToneMapping, type Camera, type Scene } from "three";
import { PostProcessing } from "three/webgpu";
import { pass, renderOutput } from "three/tsl";

import type { RendererSurfaceLike } from "./renderer-backend";
import {
  type RendererFramePipeline,
  type RendererPostProcessController,
  type RendererPostProcessPlan,
  type RendererPostProcessRuntime,
} from "./renderer-backend-v2";

interface WebGPUScenePass {
  camera: Camera;
  getTextureNode(name?: string): unknown;
  scene: Scene;
  setMRT(mrt: unknown): void;
}

interface WebGPUPostProcessing {
  dispose(): void;
  needsUpdate: boolean;
  outputColorTransform: boolean;
  outputNode: unknown;
  render(): void;
}

interface WebGPUPostProcessRuntimeDependencies {
  createPass(scene: Scene, camera: Camera): WebGPUScenePass;
  createPostProcessing(renderer: RendererSurfaceLike): WebGPUPostProcessing;
  createRenderOutput(colorNode: unknown, toneMapping: number, outputColorSpace: string | undefined): unknown;
}

const NOOP_POST_PROCESS_CONTROLLER: RendererPostProcessController = {
  setColorGrade: () => {},
  setVignette: () => {},
};

const defaultDependencies: WebGPUPostProcessRuntimeDependencies = {
  createPass: (scene, camera) => pass(scene, camera) as unknown as WebGPUScenePass,
  createPostProcessing: (renderer) => new PostProcessing(renderer as never) as unknown as WebGPUPostProcessing,
  createRenderOutput: (colorNode, toneMapping, outputColorSpace) =>
    renderOutput(colorNode as never, toneMapping, outputColorSpace) as unknown,
};

export function createWebGPUPostProcessRuntime(
  input: {
    renderer: RendererSurfaceLike;
  },
  dependencies: WebGPUPostProcessRuntimeDependencies = defaultDependencies,
): RendererPostProcessRuntime {
  return new WebGPUPostProcessRuntime(input.renderer, dependencies);
}

class WebGPUPostProcessRuntime implements RendererPostProcessRuntime {
  private readonly postProcessing: WebGPUPostProcessing;
  private plan?: RendererPostProcessPlan;
  private scenePass?: WebGPUScenePass;

  constructor(
    private readonly renderer: RendererSurfaceLike,
    private readonly dependencies: WebGPUPostProcessRuntimeDependencies,
  ) {
    this.postProcessing = this.dependencies.createPostProcessing(this.renderer);
    this.postProcessing.outputColorTransform = false;
  }

  setPlan(plan: RendererPostProcessPlan): RendererPostProcessController {
    this.plan = {
      antiAlias: plan.antiAlias,
      bloom: { ...plan.bloom },
      chromaticAberration: { ...plan.chromaticAberration },
      colorGrade: { ...plan.colorGrade },
      toneMapping: { ...plan.toneMapping },
      vignette: { ...plan.vignette },
    };
    this.rebuildOutputNode();

    return NOOP_POST_PROCESS_CONTROLLER;
  }

  renderFrame(pipeline: RendererFramePipeline): void {
    if (!this.scenePass) {
      this.scenePass = this.dependencies.createPass(pipeline.mainScene, pipeline.mainCamera);
      this.rebuildOutputNode();
    } else {
      this.scenePass.scene = pipeline.mainScene;
      this.scenePass.camera = pipeline.mainCamera;
    }

    this.renderer.info.reset();
    this.renderer.clear();
    this.postProcessing.render();

    if (pipeline.overlayScene && pipeline.overlayCamera) {
      this.renderer.clearDepth();
      this.renderer.render(pipeline.overlayScene, pipeline.overlayCamera);
    }
  }

  setSize(): void {
    this.postProcessing.needsUpdate = true;
  }

  dispose(): void {
    this.postProcessing.dispose();
  }

  private rebuildOutputNode(): void {
    if (!this.plan || !this.scenePass) {
      return;
    }

    this.renderer.toneMapping = resolveRendererToneMapping(this.plan.toneMapping.mode);
    this.renderer.toneMappingExposure = this.plan.toneMapping.exposure;

    const sceneColorNode = this.scenePass.getTextureNode("output");
    this.postProcessing.outputNode = this.dependencies.createRenderOutput(
      sceneColorNode,
      this.renderer.toneMapping,
      this.renderer.outputColorSpace,
    );
    this.postProcessing.needsUpdate = true;
  }
}

function resolveRendererToneMapping(mode: RendererPostProcessPlan["toneMapping"]["mode"]): number {
  switch (mode) {
    case "linear":
      return LinearToneMapping;
    case "reinhard":
      return ReinhardToneMapping;
    case "cineon":
      return CineonToneMapping;
    case "aces-filmic":
    case "neutral":
    default:
      return ACESFilmicToneMapping;
  }
}
