import { POST_PROCESSING_CONFIG, type PostProcessingConfig, type RendererToneMappingMode } from "@/three/constants";
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
  applyRendererBackendVisuals,
} from "./renderer-backend-compat";
import {
  resolveCapabilityAwareRendererEffectPlan,
  resolveRendererEnvironmentPolicy,
  resolvePostProcessingEffectPlan,
  shouldEnablePostProcessingConfig,
} from "./game-renderer-policy";
import type { RendererBackendV2, RendererPostProcessController, RendererPostProcessPlan } from "./renderer-backend-v2";
import type { RendererSurfaceLike } from "./renderer-backend";
import type { RenderVisualProfile } from "./render-profile";
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
    applyRenderVisualProfile(features: RenderVisualProfile): void;
  };
  hexceptionScene: {
    applyRenderVisualProfile(features: RenderVisualProfile): void;
  };
  worldmapScene: {
    applyRenderVisualProfile(features: RenderVisualProfile): void;
  };
}

interface CreateRendererEffectsRuntimeInput {
  backend: RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };
  createFolder: (name: string) => TrackableFolderLike;
  isGraphicsDevEnabled: boolean;
  resolvePixelRatio?: (pixelRatio: number) => number;
  scenes: RendererEffectsScenes;
}

const DEFAULT_ENVIRONMENT_INTENSITY = 0.55;

const WEATHER_POST_PROCESSING_LIMITS = {
  brightnessReduction: 0.06,
  saturationReduction: 0.18,
  vignetteIncrease: 0.1,
} as const;
const WEATHER_POST_PROCESSING_EPSILON = 0.001;

type WeatherPostProcessingValues = {
  brightness: number;
  contrast: number;
  saturation: number;
  vignetteDarkness: number;
};

export interface RendererEffectsRuntime {
  applyEnvironment(): Promise<void>;
  applyRenderVisualProfile(features: RenderVisualProfile): void;
  hasPostProcessing(): boolean;
  resolveRendererToneMappingMode(mode: RendererToneMappingMode): RendererPostProcessPlan["toneMapping"]["mode"];
  setupPostProcessingEffects(features: RenderVisualProfile): void;
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
  private lastWeatherPostProcessingValues?: WeatherPostProcessingValues;

  constructor(private readonly input: CreateRendererEffectsRuntimeInput) {}

  public setupPostProcessingEffects(features: RenderVisualProfile): void {
    const effectsConfig = this.getPostProcessingConfig();
    if (!effectsConfig) {
      return;
    }

    this.postProcessingConfig = effectsConfig;
    this.rebuildPostProcessing(features);
    this.setupGraphicsDevControls(features, effectsConfig);
  }

  public hasPostProcessing(): boolean {
    return Boolean(this.postProcessingConfig);
  }

  public async applyEnvironment(): Promise<void> {
    const environmentPolicy = resolveRendererEnvironmentPolicy({
      capabilities: this.input.backend.capabilities,
      intensity: DEFAULT_ENVIRONMENT_INTENSITY,
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

  public applyRenderVisualProfile(features: RenderVisualProfile): void {
    const devicePixelRatio = Math.max(window.devicePixelRatio || 1, 1);
    const resolvedPixelRatio = (this.input.resolvePixelRatio ?? ((value: number) => value))(
      Math.min(devicePixelRatio, features.pixelRatio),
    );

    applyRendererBackendVisuals(this.input.backend, {
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

    this.input.scenes.worldmapScene.applyRenderVisualProfile(features);
    this.input.scenes.fastTravelScene?.applyRenderVisualProfile(features);
    this.input.scenes.hexceptionScene.applyRenderVisualProfile(features);
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

    const saturationReduction = Math.min(
      WEATHER_POST_PROCESSING_LIMITS.saturationReduction,
      weatherState.intensity * 0.35 + weatherState.stormIntensity * 0.15,
    );
    const contrastBoost = weatherState.stormIntensity * 0.15;
    const brightnessReduction = Math.min(
      WEATHER_POST_PROCESSING_LIMITS.brightnessReduction,
      weatherState.intensity * 0.05,
    );
    const vignetteIncrease = Math.min(
      WEATHER_POST_PROCESSING_LIMITS.vignetteIncrease,
      weatherState.stormIntensity * 0.2,
    );

    this.applyWeatherPostProcessingValues({
      brightness: this.basePostProcessingValues.brightness - brightnessReduction,
      contrast: this.basePostProcessingValues.contrast + contrastBoost,
      saturation: this.basePostProcessingValues.saturation - saturationReduction,
      vignetteDarkness: this.basePostProcessingValues.vignetteDarkness + vignetteIncrease,
    });
  }

  public resolveRendererToneMappingMode(mode: RendererToneMappingMode): RendererPostProcessPlan["toneMapping"]["mode"] {
    return mode;
  }

  private getPostProcessingConfig(): PostProcessingConfig | null {
    const effectsConfig = POST_PROCESSING_CONFIG;
    if (
      !shouldEnablePostProcessingConfig({
        hasPostProcessingConfig: effectsConfig !== null,
      })
    ) {
      return null;
    }

    return effectsConfig;
  }

  private setupGraphicsDevControls(features: RenderVisualProfile, effectsConfig: PostProcessingConfig): void {
    if (!this.input.isGraphicsDevEnabled) {
      return;
    }

    this.setupToneMappingGUI(features, effectsConfig);
    this.setupPostProcessingGUI(features, effectsConfig);
  }

  private applyWeatherPostProcessingValues(values: WeatherPostProcessingValues): void {
    if (!this.shouldApplyWeatherPostProcessingValues(values)) {
      return;
    }

    this.postProcessController?.setColorGrade({
      brightness: values.brightness,
      contrast: values.contrast,
      saturation: values.saturation,
    });
    this.postProcessController?.setVignette({
      darkness: values.vignetteDarkness,
    });
    this.lastWeatherPostProcessingValues = values;
  }

  private shouldApplyWeatherPostProcessingValues(values: WeatherPostProcessingValues): boolean {
    const lastValues = this.lastWeatherPostProcessingValues;
    if (!lastValues) {
      return true;
    }

    return (
      Math.abs(lastValues.brightness - values.brightness) > WEATHER_POST_PROCESSING_EPSILON ||
      Math.abs(lastValues.contrast - values.contrast) > WEATHER_POST_PROCESSING_EPSILON ||
      Math.abs(lastValues.saturation - values.saturation) > WEATHER_POST_PROCESSING_EPSILON ||
      Math.abs(lastValues.vignetteDarkness - values.vignetteDarkness) > WEATHER_POST_PROCESSING_EPSILON
    );
  }

  private setupToneMappingGUI(features: RenderVisualProfile, config: PostProcessingConfig): void {
    const folder = this.input.createFolder("Tone Mapping");
    folder
      .add(config.toneMapping, "mode", {
        "ACES Filmic": "aces-filmic",
        Cineon: "cineon",
        Linear: "linear",
        Neutral: "neutral",
        Reinhard: "reinhard",
      })
      .onChange?.(() => this.rebuildPostProcessing(features));

    folder.add(config.toneMapping, "exposure", 0.0, 2.0, 0.01).onChange?.(() => this.rebuildPostProcessing(features));
    folder.add(config.toneMapping, "whitePoint", 0.0, 2.0, 0.01).onChange?.(() => this.rebuildPostProcessing(features));
    folder.close?.();
  }

  private setupPostProcessingGUI(features: RenderVisualProfile, config: PostProcessingConfig): void {
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

  private rebuildPostProcessing(features: RenderVisualProfile): void {
    if (!this.postProcessingConfig) {
      return;
    }

    this.weatherBaseValuesInitialized = false;
    this.lastWeatherPostProcessingValues = undefined;

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
        bloom: features.bloom ? undefined : "disabled-by-profile",
        chromaticAberration: features.chromaticAberration ? undefined : "disabled-by-profile",
        vignette: features.vignette ? undefined : "disabled-by-profile",
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
        activeMode: snapshotRendererDiagnostics().activeMode ?? "webgl2-fallback",
        capabilities: this.input.backend.capabilities,
      }),
    );
  }
}
