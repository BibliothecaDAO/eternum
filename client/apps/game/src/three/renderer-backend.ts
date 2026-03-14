import {
  BloomEffect,
  BrightnessContrastEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  FXAAEffect,
  HueSaturationEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
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
  Vector2,
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
} from "./renderer-backend-v2";
import { syncRenderPassScene } from "./renderer-pass-scene";

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
  private readonly composer: EffectComposer;
  private environmentTarget?: WebGLRenderTarget;
  private isDisposed = false;
  private renderPass?: RenderPass;
  private effectPass?: EffectPass;
  private activeCamera?: Camera;
  private postProcessPlan?: RendererPostProcessPlan;
  private hueSaturationEffect?: HueSaturationEffect;
  private brightnessContrastEffect?: BrightnessContrastEffect;
  private vignetteEffect?: VignetteEffect;
  private readonly postProcessController: RendererPostProcessController = {
    setColorGrade: (input) => {
      if (!this.postProcessPlan) {
        return;
      }

      this.postProcessPlan.colorGrade = {
        ...this.postProcessPlan.colorGrade,
        ...input,
      };

      if (this.hueSaturationEffect) {
        const hueSaturation = this.hueSaturationEffect as unknown as { hue: number; saturation: number };
        if (typeof input.hue === "number") {
          hueSaturation.hue = input.hue;
        }
        if (typeof input.saturation === "number") {
          hueSaturation.saturation = input.saturation;
        }
      }

      if (this.brightnessContrastEffect) {
        const brightnessContrast = this.brightnessContrastEffect as unknown as { brightness: number; contrast: number };
        if (typeof input.brightness === "number") {
          brightnessContrast.brightness = input.brightness;
        }
        if (typeof input.contrast === "number") {
          brightnessContrast.contrast = input.contrast;
        }
      }
    },
    setVignette: (input) => {
      if (!this.postProcessPlan) {
        return;
      }

      this.postProcessPlan.vignette = {
        ...this.postProcessPlan.vignette,
        ...input,
      };

      if (this.vignetteEffect) {
        if (typeof input.darkness === "number") {
          this.vignetteEffect.darkness = input.darkness;
        }
        if (typeof input.offset === "number") {
          this.vignetteEffect.offset = input.offset;
        }
      }
    },
  };

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

  async initialize() {
    return createRendererInitDiagnostics({
      activeMode: "legacy-webgl",
      buildMode: "legacy-webgl",
      requestedMode: "legacy-webgl",
    });
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

  applyPostProcessPlan(plan: RendererPostProcessPlan): RendererPostProcessController {
    this.postProcessPlan = {
      antiAlias: plan.antiAlias,
      bloom: { ...plan.bloom },
      chromaticAberration: { ...plan.chromaticAberration },
      colorGrade: { ...plan.colorGrade },
      toneMapping: { ...plan.toneMapping },
      vignette: { ...plan.vignette },
    };

    this.rebuildEffectPass();
    return this.postProcessController;
  }

  renderFrame(pipeline: RendererFramePipeline): void {
    this.renderer.info.reset();
    this.renderer.clear();

    this.ensureRenderPass(pipeline.mainScene, pipeline.mainCamera);
    this.composer.render();

    if (pipeline.overlayScene && pipeline.overlayCamera) {
      this.renderer.clearDepth();
      this.renderer.render(pipeline.overlayScene, pipeline.overlayCamera);
    }
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

    this.effectPass?.dispose();
    this.effectPass = undefined;
    this.renderPass = undefined;

    this.composer.dispose();
    this.renderer.dispose();
  }

  private ensureRenderPass(scene: Scene, camera: Camera): void {
    this.activeCamera = camera;

    if (!this.renderPass) {
      this.renderPass = new RenderPass(scene, camera);
      this.composer.addPass(this.renderPass);
      this.rebuildEffectPass();
      return;
    }

    syncRenderPassScene(this.renderPass as unknown as { mainScene?: unknown; scene?: unknown }, scene);
    (this.renderPass as unknown as { camera?: Camera }).camera = camera;
  }

  private rebuildEffectPass(): void {
    if (this.effectPass) {
      this.removeComposerPass(this.effectPass);
      this.effectPass.dispose();
      this.effectPass = undefined;
    }

    this.hueSaturationEffect = undefined;
    this.brightnessContrastEffect = undefined;
    this.vignetteEffect = undefined;

    if (!this.postProcessPlan || !this.activeCamera) {
      return;
    }

    const effects = [];

    const toneMappingEffect = new ToneMappingEffect({
      mode: this.resolveToneMappingMode(this.postProcessPlan.toneMapping.mode),
    });
    const mutableToneMapping = toneMappingEffect as unknown as { exposure: number; whitePoint: number };
    mutableToneMapping.exposure = this.postProcessPlan.toneMapping.exposure;
    mutableToneMapping.whitePoint = this.postProcessPlan.toneMapping.whitePoint;
    effects.push(toneMappingEffect);

    this.hueSaturationEffect = new HueSaturationEffect({
      hue: this.postProcessPlan.colorGrade.hue,
      saturation: this.postProcessPlan.colorGrade.saturation,
    });
    effects.push(this.hueSaturationEffect);

    this.brightnessContrastEffect = new BrightnessContrastEffect({
      brightness: this.postProcessPlan.colorGrade.brightness,
      contrast: this.postProcessPlan.colorGrade.contrast,
    });
    effects.push(this.brightnessContrastEffect);

    if (this.postProcessPlan.antiAlias === "fxaa") {
      effects.push(new FXAAEffect());
    }

    if (this.postProcessPlan.bloom.enabled) {
      effects.push(
        new BloomEffect({
          intensity: this.postProcessPlan.bloom.intensity,
          luminanceThreshold: 1.1,
          mipmapBlur: true,
        }),
      );
    }

    if (this.postProcessPlan.vignette.enabled) {
      this.vignetteEffect = new VignetteEffect({
        darkness: this.postProcessPlan.vignette.darkness,
        offset: this.postProcessPlan.vignette.offset,
      });
      effects.push(this.vignetteEffect);
    }

    if (this.postProcessPlan.chromaticAberration.enabled) {
      effects.push(
        new ChromaticAberrationEffect({
          modulationOffset: 0.3,
          offset: new Vector2(0.0008, 0.0008),
          radialModulation: true,
        }),
      );
    }

    this.effectPass = new EffectPass(this.activeCamera, ...effects);
    this.composer.addPass(this.effectPass);
  }

  private removeComposerPass(pass: unknown): void {
    const passes = (this.composer as unknown as { passes?: unknown[] }).passes;
    if (!passes) {
      return;
    }

    const index = passes.indexOf(pass);
    if (index !== -1) {
      passes.splice(index, 1);
    }
  }

  private resolveToneMappingMode(mode: RendererPostProcessPlan["toneMapping"]["mode"]): ToneMappingMode {
    switch (mode) {
      case "aces-filmic":
        return ToneMappingMode.ACES_FILMIC;
      case "linear":
        return ToneMappingMode.LINEAR;
      case "neutral":
        return ToneMappingMode.NEUTRAL;
      case "reinhard":
        return ToneMappingMode.REINHARD;
      case "cineon":
      default:
        return ToneMappingMode.OPTIMIZED_CINEON;
    }
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
