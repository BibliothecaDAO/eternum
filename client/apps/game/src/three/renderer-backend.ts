import {
  EffectComposer,
  RenderPass,
  type EffectPass,
} from "postprocessing";
import {
  ACESFilmicToneMapping,
  HalfFloatType,
  PCFShadowMap,
  PCFSoftShadowMap,
  type Camera,
  type Object3D,
  type Scene,
  type Texture,
  UnsignedByteType,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { PMREMGenerator } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { GraphicsSettings, type GraphicsSettings as GraphicsSettingsType } from "@/ui/config";

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
  programs?: unknown[];
}

export interface RendererSurfaceLike {
  autoClear: boolean;
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

export interface RendererPassLike {
  dispose?: () => void;
  scene: unknown;
}

export interface RendererComposerLike {
  addPass(pass: unknown): void;
  dispose(): void;
  render(): void;
  setSize(width: number, height: number): void;
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

export interface RendererBackend {
  readonly composer: RendererComposerLike;
  readonly renderer: RendererSurfaceLike;
  addPass(pass: unknown): void;
  applyEnvironment(targets: RendererEnvironmentTargets): Promise<void>;
  applyQuality(input: { pixelRatio: number; shadows: boolean; width: number; height: number }): void;
  clear(): void;
  clearDepth(): void;
  createRenderPass(scene: Scene, camera: Camera): RendererPassLike;
  dispose(): void;
  removePass(pass: unknown): void;
  renderComposer(): void;
  renderScene(scene: Scene, camera: Camera): void;
  resize(width: number, height: number): void;
  updateRenderPassScene(pass: RendererPassLike, scene: Scene): void;
}

export type RendererBackendFactory = (options: {
  graphicsSetting: GraphicsSettingsType;
  isMobileDevice: boolean;
  pixelRatio: number;
}) => RendererBackend;

let cachedHDRTarget: WebGLRenderTarget | null = null;
let cachedHDRPromise: Promise<WebGLRenderTarget> | null = null;

class WebGLRendererBackend implements RendererBackend {
  public readonly renderer: WebGLRenderer;
  public readonly composer: EffectComposer;
  private environmentTarget?: WebGLRenderTarget;
  private isDisposed = false;

  constructor(
    private readonly graphicsSetting: GraphicsSettingsType,
    private readonly isMobileDevice: boolean,
    pixelRatio: number,
  ) {
    const isLowGraphics = this.graphicsSetting === GraphicsSettings.LOW;
    this.renderer = new WebGLRenderer({
      powerPreference: "high-performance",
      antialias: false,
      stencil: !isLowGraphics,
      depth: true,
    });

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = this.graphicsSetting !== GraphicsSettings.LOW;
    this.renderer.shadowMap.type = this.isMobileDevice ? PCFShadowMap : PCFSoftShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;

    const frameBufferType = this.isMobileDevice ? UnsignedByteType : HalfFloatType;
    this.composer = new EffectComposer(this.renderer, {
      frameBufferType,
    });
  }

  createRenderPass(scene: Scene, camera: Camera): RendererPassLike {
    return new RenderPass(scene, camera);
  }

  updateRenderPassScene(pass: RendererPassLike, scene: Scene): void {
    pass.scene = scene;
  }

  addPass(pass: unknown): void {
    this.composer.addPass(pass as RenderPass | EffectPass);
  }

  removePass(pass: unknown): void {
    const passes = (this.composer as unknown as { passes?: unknown[] }).passes;
    if (!passes) {
      return;
    }

    const index = passes.indexOf(pass);
    if (index !== -1) {
      passes.splice(index, 1);
    }
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  applyQuality(input: { pixelRatio: number; shadows: boolean; width: number; height: number }): void {
    this.renderer.setPixelRatio(input.pixelRatio);
    this.renderer.shadowMap.enabled = input.shadows;
    this.composer.setSize(input.width, input.height);
  }

  clear(): void {
    this.renderer.info.reset();
    this.renderer.clear();
  }

  clearDepth(): void {
    this.renderer.clearDepth();
  }

  renderComposer(): void {
    this.composer.render();
  }

  renderScene(scene: Scene, camera: Camera): void {
    this.renderer.render(scene, camera);
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

    this.composer.dispose();
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

export const createWebGLRendererBackend: RendererBackendFactory = ({
  graphicsSetting,
  isMobileDevice,
  pixelRatio,
}) => new WebGLRendererBackend(graphicsSetting, isMobileDevice, pixelRatio);
