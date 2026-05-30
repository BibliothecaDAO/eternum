import { POST_PROCESSING_CONFIG, type PostProcessingConfig } from "@/three/constants";
import { GraphicsSettings } from "@/ui/config";
import { ToneMappingMode } from "postprocessing";
import {
  replaceRendererDiagnosticDegradations,
  setRendererDiagnosticDegradations,
  setRendererDiagnosticEffectPlan,
  setRendererDiagnosticPostprocessPolicy,
  snapshotRendererDiagnostics,
} from "./renderer-diagnostics";
import {
  applyRendererBackendEnvironment,
  applyRendererBackendPostProcessPlan,
  applyRendererBackendQuality,
} from "./renderer-backend-compat";
import {
  resolveCapabilityAwareRendererEffectPlan,
  resolveRendererEnvironmentPolicy,
  resolvePostProcessingEffectPlan,
  shouldEnablePostProcessingConfig,
} from "./game-renderer-policy";
import type { RendererBackendV2, RendererPostProcessController, RendererPostProcessPlan } from "./renderer-backend-v2";
import type { RendererSurfaceLike } from "./renderer-backend";
import type { QualityFeatures } from "./utils/quality-controller";
import { resolveWebgpuPostprocessPolicy } from "./webgpu-postprocess-policy";

type TrackableFolderLike = {
  add(
    target: object,
    property: string,
    ...args: unknown[]
  ): {
    name?(label: string): { onChange?(handler: (value: any) => void): unknown };
    onChange?(handler: (value: any) => void): unknown;
  };
  close?(): void;
};

interface RendererEffectsScenes {
  fastTravelScene?: {
    applyQualityFeatures(features: QualityFeatures): void;
  };
  hexceptionScene: {
    applyQualityFeatures(features: QualityFeatures): void;
  };
  worldmapScene: {
    applyQualityFeatures(features: QualityFeatures): void;
  };
}

interface CreateRendererEffectsRuntimeInput {
  backend: RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };
  createFolder: (name: string) => TrackableFolderLike;
  graphicsSetting: GraphicsSettings;
  isMobileDevice: boolean;
  resolvePixelRatio?: (pixelRatio: number) => number;
  scenes: RendererEffectsScenes;
}

const DEFAULT_ENVIRONMENT_INTENSITY: Record<GraphicsSettings, number> = {
  [GraphicsSettings.HIGH]: 0.55,
  [GraphicsSettings.MID]: 0.45,
  [GraphicsSettings.LOW]: 0.25,
};

export interface RendererEffectsRuntime {
  applyEnvironment(): Promise<void>;
  applyQualityFeatures(features: QualityFeatures): void;
  hasPostProcessing(): boolean;
  resolveRendererToneMappingMode(mode: ToneMappingMode): RendererPostProcessPlan["toneMapping"]["mode"];
  setupPostProcessingEffects(features: QualityFeatures): void;
  updateWeatherPostProcessing(weatherState: { intensity: number; stormIntensity: number }): void;
}

export function createRendererEffectsRuntime(input: CreateRendererEffectsRuntimeInput): RendererEffectsRuntime {
  return new GameRendererEffectsRuntime(input);
}

class GameRendererEffectsRuntime implements RendererEffectsRuntime {
  private postProcessController?: RendererPostProcessController;
  private postProcessingConfig?: PostProcessingConfig;
  private postProcessingGUIInitialized = false;
  private readonly basePostProcessingValues = {
    saturation: 0,
    contrast: 0,
    brightness: 0,
    vignetteDarkness: 0,
  };
  private weatherBaseValuesInitialized = false;
  private weatherPostProcessingEnabled = true;

  constructor(private readonly input: CreateRendererEffectsRuntimeInput) {}

  public setupPostProcessingEffects(features: QualityFeatures): void {
    const effectsConfig = this.getPostProcessingConfig();
    if (!effectsConfig) {
      return;
    }

    this.postProcessingConfig = effectsConfig;
    this.rebuildPostProcessing(features);
    this.setupToneMappingGUI(features, effectsConfig);
    this.setupPostProcessingGUI(features, effectsConfig);
  }

  public hasPostProcessing(): boolean {
    return Boolean(this.postProcessingConfig);
  }

  public async applyEnvironment(): Promise<void> {
    const environmentPolicy = resolveRendererEnvironmentPolicy({
      capabilities: this.input.backend.capabilities,
      intensity: DEFAULT_ENVIRONMENT_INTENSITY[this.input.graphicsSetting],
    });

    replaceRendererDiagnosticDegradations(["environmentIbl"], environmentPolicy.degradations);
    if (!environmentPolicy.shouldApplyEnvironment) {
      return;
    }

    await applyRendererBackendEnvironment(this.input.backend, {
      fastTravelScene: this.input.scenes.fastTravelScene as never,
      hexceptionScene: this.input.scenes.hexceptionScene as never,
      intensity: environmentPolicy.intensity,
      worldmapScene: this.input.scenes.worldmapScene as never,
    });
  }

  public applyQualityFeatures(features: QualityFeatures): void {
    const devicePixelRatio = Math.max(window.devicePixelRatio || 1, 1);
    const resolvedPixelRatio = (this.input.resolvePixelRatio ?? ((value: number) => value))(
      Math.min(devicePixelRatio, features.pixelRatio),
    );

    applyRendererBackendQuality(this.input.backend, {
      height: window.innerHeight,
      pixelRatio: resolvedPixelRatio,
      shadows: features.shadows,
      width: window.innerWidth,
    });

    if (this.postProcessingConfig) {
      this.rebuildPostProcessing(features);
    } else {
      setRendererDiagnosticDegradations([]);
    }

    this.input.scenes.worldmapScene.applyQualityFeatures(features);
    this.input.scenes.fastTravelScene?.applyQualityFeatures(features);
    this.input.scenes.hexceptionScene.applyQualityFeatures(features);
  }

  public updateWeatherPostProcessing(weatherState: { intensity: number; stormIntensity: number }): void {
    if (!this.weatherPostProcessingEnabled || !this.postProcessingConfig) {
      return;
    }

    if (!this.weatherBaseValuesInitialized) {
      this.basePostProcessingValues.saturation = this.postProcessingConfig.saturation;
      this.basePostProcessingValues.contrast = this.postProcessingConfig.contrast;
      this.basePostProcessingValues.brightness = this.postProcessingConfig.brightness;
      this.basePostProcessingValues.vignetteDarkness = this.postProcessingConfig.vignette.darkness;
      this.weatherBaseValuesInitialized = true;
    }

    const saturationReduction = weatherState.intensity * 0.35 + weatherState.stormIntensity * 0.15;
    const contrastBoost = weatherState.stormIntensity * 0.15;
    const brightnessReduction = weatherState.intensity * 0.05;
    const vignetteIncrease = weatherState.stormIntensity * 0.2;

    this.postProcessController?.setColorGrade({
      brightness: this.basePostProcessingValues.brightness - brightnessReduction,
      contrast: this.basePostProcessingValues.contrast + contrastBoost,
      saturation: this.basePostProcessingValues.saturation - saturationReduction,
    });
    this.postProcessController?.setVignette({
      darkness: this.basePostProcessingValues.vignetteDarkness + vignetteIncrease,
    });
  }

  public resolveRendererToneMappingMode(mode: ToneMappingMode): RendererPostProcessPlan["toneMapping"]["mode"] {
    switch (mode) {
      case ToneMappingMode.ACES_FILMIC:
        return "aces-filmic";
      case ToneMappingMode.LINEAR:
        return "linear";
      case ToneMappingMode.NEUTRAL:
        return "neutral";
      case ToneMappingMode.REINHARD:
        return "reinhard";
      case ToneMappingMode.CINEON:
      case ToneMappingMode.OPTIMIZED_CINEON:
      default:
        return "cineon";
    }
  }

  private getPostProcessingConfig(): PostProcessingConfig | null {
    const effectsConfig = POST_PROCESSING_CONFIG[this.input.graphicsSetting];
    if (
      !shouldEnablePostProcessingConfig({
        hasPostProcessingConfig: effectsConfig !== null,
        isMobileDevice: this.input.isMobileDevice,
        isHighGraphicsSetting: this.input.graphicsSetting === GraphicsSettings.HIGH,
      })
    ) {
      return null;
    }

    return effectsConfig;
  }

  private setupToneMappingGUI(features: QualityFeatures, config: PostProcessingConfig): void {
    const folder = this.input.createFolder("Tone Mapping");
    folder
      .add(config.toneMapping, "mode", {
        ...ToneMappingMode,
      })
      .onChange?.(() => this.rebuildPostProcessing(features));

    folder.add(config.toneMapping, "exposure", 0.0, 2.0, 0.01).onChange?.(() => this.rebuildPostProcessing(features));
    folder.add(config.toneMapping, "whitePoint", 0.0, 2.0, 0.01).onChange?.(() => this.rebuildPostProcessing(features));
    folder.close?.();
  }

  private setupPostProcessingGUI(features: QualityFeatures, config: PostProcessingConfig): void {
    if (this.postProcessingGUIInitialized) {
      return;
    }
    this.postProcessingGUIInitialized = true;

    const colorGradeFolder = this.input.createFolder("Color Grade");
    colorGradeFolder
      .add(config, "saturation", -0.5, 0.5, 0.01)
      .name?.("Saturation")
      .onChange?.((value: number) => {
        config.saturation = value;
        this.postProcessController?.setColorGrade({ saturation: value });
        this.rebuildPostProcessing(features);
      });
    colorGradeFolder
      .add(config, "hue", -0.5, 0.5, 0.01)
      .name?.("Hue")
      .onChange?.((value: number) => {
        config.hue = value;
        this.postProcessController?.setColorGrade({ hue: value });
        this.rebuildPostProcessing(features);
      });
    colorGradeFolder
      .add(config, "brightness", -0.5, 0.5, 0.01)
      .name?.("Brightness")
      .onChange?.((value: number) => {
        config.brightness = value;
        this.postProcessController?.setColorGrade({ brightness: value });
        this.rebuildPostProcessing(features);
      });
    colorGradeFolder
      .add(config, "contrast", -0.5, 0.5, 0.01)
      .name?.("Contrast")
      .onChange?.((value: number) => {
        config.contrast = value;
        this.postProcessController?.setColorGrade({ contrast: value });
        this.rebuildPostProcessing(features);
      });
    colorGradeFolder.close?.();

    const vignetteFolder = this.input.createFolder("Vignette");
    vignetteFolder.add(config.vignette, "darkness", 0.0, 1.0, 0.01).onChange?.((value: number) => {
      config.vignette.darkness = value;
      this.postProcessController?.setVignette({ darkness: value });
      this.rebuildPostProcessing(features);
    });
    vignetteFolder.add(config.vignette, "offset", 0.0, 1.0, 0.01).onChange?.((value: number) => {
      config.vignette.offset = value;
      this.postProcessController?.setVignette({ offset: value });
      this.rebuildPostProcessing(features);
    });
    vignetteFolder.close?.();
  }

  private rebuildPostProcessing(features: QualityFeatures): void {
    if (!this.postProcessingConfig) {
      return;
    }

    this.weatherBaseValuesInitialized = false;

    const effectPlan = resolvePostProcessingEffectPlan({
      bloom: features.bloom,
      chromaticAberration: features.chromaticAberration,
      fxaa: features.fxaa,
      vignette: features.vignette,
    });

    const rendererPlan = resolveCapabilityAwareRendererEffectPlan({
      antiAlias: effectPlan.shouldEnableFXAA ? "fxaa" : "none",
      bloomEnabled: effectPlan.shouldEnableBloom,
      bloomIntensity: features.bloomIntensity,
      capabilities: this.input.backend.capabilities,
      chromaticAberrationEnabled: effectPlan.shouldEnableChromaticAberration,
      colorGrade: {
        brightness: this.postProcessingConfig.brightness,
        contrast: this.postProcessingConfig.contrast,
        hue: this.postProcessingConfig.hue,
        saturation: this.postProcessingConfig.saturation,
      },
      disabledReasons: {
        bloom: features.bloom ? undefined : "disabled-by-quality",
        chromaticAberration: features.chromaticAberration ? undefined : "disabled-by-quality",
        vignette: features.vignette ? undefined : "disabled-by-quality",
      },
      toneMapping: {
        exposure: this.postProcessingConfig.toneMapping.exposure,
        mode: this.resolveRendererToneMappingMode(this.postProcessingConfig.toneMapping.mode),
        whitePoint: this.postProcessingConfig.toneMapping.whitePoint,
      },
      vignette: {
        darkness: this.postProcessingConfig.vignette.darkness,
        enabled: effectPlan.shouldEnableVignette,
        offset: this.postProcessingConfig.vignette.offset,
      },
    });

    this.postProcessController = applyRendererBackendPostProcessPlan(this.input.backend, rendererPlan.plan);
    replaceRendererDiagnosticDegradations(
      ["colorGrade", "bloom", "vignette", "chromaticAberration"],
      rendererPlan.degradations,
    );
    setRendererDiagnosticEffectPlan(rendererPlan.plan);
    setRendererDiagnosticPostprocessPolicy(
      resolveWebgpuPostprocessPolicy({
        activeMode: snapshotRendererDiagnostics().activeMode ?? "legacy-webgl",
        capabilities: this.input.backend.capabilities,
      }),
    );
  }
}
