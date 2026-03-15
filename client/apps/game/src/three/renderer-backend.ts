import {
  ACESFilmicToneMapping,
  PCFShadowMap,
  PCFSoftShadowMap,
  type Camera,
  type Object3D,
  type Scene,
  type Texture,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { PMREMGenerator } from "three";
import { GraphicsSettings, type GraphicsSettings as GraphicsSettingsType } from "@/ui/config";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import {
  createRendererBackendCapabilities,
  createRendererInitDiagnostics,
  type RendererBackendV2,
  type RendererFramePipeline,
  type RendererPostProcessController,
  type RendererPostProcessPlan,
  type RendererPostProcessRuntime,
} from "./renderer-backend-v2";
import { syncRenderPassScene } from "./renderer-pass-scene";
import { createWebGLPostProcessRuntime } from "./webgl-postprocess-runtime";

export interface RendererInfoLike {
  autoReset?: boolean;
  reset(): void;
  render: {
    calls: number;
    triangles: number;
  };
  memory: {
    geometries: number;
    textures: number;
  };
  programs?: unknown[] | null;
}

export interface RendererSurfaceLike {
  autoClear: boolean;
  clear(): void;
  clearDepth(): void;
  domElement: HTMLCanvasElement;
  dispose(): void;
  info: RendererInfoLike;
  render(scene: Object3D, camera: Camera): void;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number): void;
  shadowMap: {
    enabled: boolean;
    type: number;
  };
  toneMapping: number;
  toneMappingExposure: number;
}

export interface EnvironmentSceneTarget {
  setEnvironment(environment: Texture, intensity: number): void;
}

export interface RendererEnvironmentTargets {
  fastTravelScene?: EnvironmentSceneTarget;
  hexceptionScene: EnvironmentSceneTarget;
  intensity: number;
  worldmapScene: EnvironmentSceneTarget;
}

export interface RendererBackend extends RendererBackendV2 {
  readonly renderer: RendererSurfaceLike;
  applyEnvironment(targets: RendererEnvironmentTargets): Promise<void>;
  applyPostProcessPlan(plan: RendererPostProcessPlan): RendererPostProcessController;
  applyQuality(input: { pixelRatio: number; shadows: boolean; width: number; height: number }): void;
  dispose(): void;
  initialize(): Promise<ReturnType<typeof createRendererInitDiagnostics>>;
  renderFrame(pipeline: RendererFramePipeline): void;
  resize(width: number, height: number): void;
}

export type RendererBackendFactory = (options: {
  graphicsSetting: GraphicsSettingsType;
  isMobileDevice: boolean;
  pixelRatio: number;
}) => RendererBackend;

interface WebGLRendererBackendDependencies {
  createPostProcessRuntime(input: {
    isMobileDevice: boolean;
    renderer: RendererSurfaceLike;
  }): RendererPostProcessRuntime;
  createRenderer(input: { isLowGraphics: boolean }): WebGLRenderer;
}

let cachedHDRTarget: WebGLRenderTarget | null = null;
let cachedHDRPromise: Promise<WebGLRenderTarget> | null = null;

const WEBGL_RENDERER_BACKEND_CAPABILITIES = createRendererBackendCapabilities({
  supportsBloom: true,
  supportsChromaticAberration: true,
  supportsColorGrade: true,
  supportsEnvironmentIbl: true,
  supportsToneMappingControl: true,
  supportsVignette: true,
  supportsWideLines: false,
});

class WebGLRendererBackend implements RendererBackend {
  public readonly renderer: WebGLRenderer;
  public readonly capabilities = WEBGL_RENDERER_BACKEND_CAPABILITIES;
  private readonly postProcessRuntime: RendererPostProcessRuntime;
  private environmentTarget?: WebGLRenderTarget;
  private isDisposed = false;

  constructor(
    private readonly graphicsSetting: GraphicsSettingsType,
    private readonly isMobileDevice: boolean,
    pixelRatio: number,
    dependencies: WebGLRendererBackendDependencies,
  ) {
    const isLowGraphics = this.graphicsSetting === GraphicsSettings.LOW;
    this.renderer = dependencies.createRenderer({
      isLowGraphics,
    });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = this.graphicsSetting !== GraphicsSettings.LOW;
    this.renderer.shadowMap.type = this.isMobileDevice ? PCFShadowMap : PCFSoftShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    this.postProcessRuntime = dependencies.createPostProcessRuntime({
      isMobileDevice: this.isMobileDevice,
      renderer: this.renderer,
    });
    this.postProcessRuntime.setSize(window.innerWidth, window.innerHeight);
  }

  async initialize() {
    return createRendererInitDiagnostics({
      activeMode: "legacy-webgl",
      buildMode: "legacy-webgl",
      requestedMode: "legacy-webgl",
    });
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.postProcessRuntime.setSize(width, height);
  }

  applyQuality(input: { pixelRatio: number; shadows: boolean; width: number; height: number }): void {
    this.renderer.setPixelRatio(input.pixelRatio);
    this.renderer.shadowMap.enabled = input.shadows;
    this.postProcessRuntime.setSize(input.width, input.height);
  }

  applyPostProcessPlan(plan: RendererPostProcessPlan): RendererPostProcessController {
    return this.postProcessRuntime.setPlan(plan);
  }

  renderFrame(pipeline: RendererFramePipeline): void {
    this.postProcessRuntime.renderFrame(pipeline);
  }

  async applyEnvironment(targets: RendererEnvironmentTargets): Promise<void> {
    const pmremGenerator = new PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    const fallbackTarget = pmremGenerator.fromScene(new RoomEnvironment());
    this.setEnvironmentFromTarget(fallbackTarget, targets);

    try {
      const target = await this.loadCachedEnvironmentMap(pmremGenerator);
      if (this.isDisposed) {
        if (target !== cachedHDRTarget) {
          target.dispose();
        }
        return;
      }
      this.setEnvironmentFromTarget(target, targets);
    } catch (error) {
      console.error("Failed to load HDR environment map", error);
    } finally {
      pmremGenerator.dispose();
    }
  }

  dispose(): void {
    this.isDisposed = true;

    if (this.environmentTarget && this.environmentTarget !== cachedHDRTarget) {
      this.environmentTarget.dispose();
    }
    this.environmentTarget = undefined;

    this.postProcessRuntime.dispose();
    this.renderer.dispose();
  }

  private setEnvironmentFromTarget(renderTarget: WebGLRenderTarget, targets: RendererEnvironmentTargets): void {
    const envMap = renderTarget.texture;
    targets.hexceptionScene.setEnvironment(envMap, targets.intensity);
    targets.worldmapScene.setEnvironment(envMap, targets.intensity);
    targets.fastTravelScene?.setEnvironment(envMap, targets.intensity);

    if (
      this.environmentTarget &&
      this.environmentTarget !== renderTarget &&
      this.environmentTarget !== cachedHDRTarget
    ) {
      this.environmentTarget.dispose();
    }

    this.environmentTarget = renderTarget;
  }

  private loadCachedEnvironmentMap(pmremGenerator: PMREMGenerator): Promise<WebGLRenderTarget> {
    if (cachedHDRTarget) {
      return Promise.resolve(cachedHDRTarget);
    }

    if (cachedHDRPromise) {
      return cachedHDRPromise;
    }

    const hdriLoader = new RGBELoader();
    cachedHDRPromise = new Promise<WebGLRenderTarget>((resolve, reject) => {
      hdriLoader.load(
        "/textures/environment/models_env.hdr",
        (texture) => {
          const envTarget = pmremGenerator.fromEquirectangular(texture);
          texture.dispose();
          cachedHDRTarget = envTarget;
          cachedHDRPromise = null;
          resolve(envTarget);
        },
        undefined,
        (error) => {
          cachedHDRPromise = null;
          reject(error);
        },
      );
    });

    return cachedHDRPromise;
  }
}

const defaultDependencies: WebGLRendererBackendDependencies = {
  createPostProcessRuntime: createWebGLPostProcessRuntime,
  createRenderer: ({ isLowGraphics }) =>
    new WebGLRenderer({
      powerPreference: "high-performance",
      antialias: false,
      stencil: !isLowGraphics,
      depth: true,
    }),
};

export function createWebGLRendererBackend(
  options: {
    graphicsSetting: GraphicsSettingsType;
    isMobileDevice: boolean;
    pixelRatio: number;
  },
  dependencies: WebGLRendererBackendDependencies = defaultDependencies,
): RendererBackend {
  return new WebGLRendererBackend(options.graphicsSetting, options.isMobileDevice, options.pixelRatio, dependencies);
}
