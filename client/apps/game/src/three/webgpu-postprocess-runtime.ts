import { ACESFilmicToneMapping, CineonToneMapping, LinearToneMapping, ReinhardToneMapping, type Camera, type Scene } from "three";
import { PostProcessing } from "three/webgpu";
import { pass, emissive, mrt, output } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

import type { RendererSurfaceLike } from "./renderer-backend";
import {
  type RendererFramePipeline,
  type RendererPostProcessController,
  type RendererPostProcessPlan,
  type RendererPostProcessRuntime,
} from "./renderer-backend-v2";
import { renderRendererOverlayPasses } from "./renderer-overlay-passes";

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
  createBloom(emissiveNode: unknown, intensity: number): unknown;
  createBloomMrt(): unknown;
  createPass(scene: Scene, camera: Camera): WebGPUScenePass;
  createPostProcessing(renderer: RendererSurfaceLike): WebGPUPostProcessing;
}

const NOOP_POST_PROCESS_CONTROLLER: RendererPostProcessController = {
  setColorGrade: () => {},
  setVignette: () => {},
};

const defaultDependencies: WebGPUPostProcessRuntimeDependencies = {
  createBloom: (emissiveNode, intensity) => bloom(emissiveNode as never, intensity) as unknown,
  createBloomMrt: () => mrt({ output, emissive }) as unknown,
  createPass: (scene, camera) => pass(scene, camera) as unknown as WebGPUScenePass,
  createPostProcessing: (renderer) => new PostProcessing(renderer as never) as unknown as WebGPUPostProcessing,
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
    this.postProcessing.outputColorTransform = true;
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
    this.postProcessing.render();
    renderRendererOverlayPasses(this.renderer, pipeline);
  }

  setSize(): void {
    this.postProcessing.needsUpdate = true;
  }

  dispose(): void {
    this.postProcessing.dispose();
  }

  private rebuildOutputNode(): void {
    if (!this.scenePass) {
      return;
    }

    const plan = this.plan;
    if (plan) {
      this.renderer.toneMapping = resolveRendererToneMapping(plan.toneMapping.mode);
      this.renderer.toneMappingExposure = plan.toneMapping.exposure;
    }

    if (plan?.bloom.enabled) {
      this.scenePass.setMRT(this.dependencies.createBloomMrt());
    } else {
      this.scenePass.setMRT(null);
    }

    let outputNode: unknown = this.scenePass;

    if (plan?.bloom.enabled) {
      const sceneColorNode = this.scenePass.getTextureNode("output") as {
        add?: (input: unknown) => unknown;
      };
      const emissiveNode = this.scenePass.getTextureNode("emissive");
      const bloomNode = this.dependencies.createBloom(emissiveNode, plan.bloom.intensity);
      outputNode = sceneColorNode.add?.(bloomNode) ?? outputNode;
    }

    this.postProcessing.outputNode = outputNode;
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
