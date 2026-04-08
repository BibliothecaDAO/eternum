import type { RendererEffectsRuntime } from "./renderer-effects-runtime";
import type { QualityFeatures } from "./utils/quality-controller";

type RendererWeatherPostProcessingState = {
  intensity: number;
  stormIntensity: number;
};

type QualityChangeListener = (event: { currentFeatures: QualityFeatures }) => void;

interface CreateRendererEffectsBridgeRuntimeInput {
  addQualityListener: (listener: QualityChangeListener) => () => void;
  createEffectsRuntime: () => RendererEffectsRuntime;
  resolveQualityFeatures: () => QualityFeatures;
  resolveWeatherState: () => RendererWeatherPostProcessingState | undefined;
}

export interface RendererEffectsBridgeRuntime {
  applyEnvironment(): void;
  applyQualityFeatures(features: QualityFeatures): void;
  dispose(): void;
  setupPostProcessingEffects(): void;
  subscribeToQualityController(): void;
  updateWeatherPostProcessing(): void;
}

export function createRendererEffectsBridgeRuntime(
  input: CreateRendererEffectsBridgeRuntimeInput,
): RendererEffectsBridgeRuntime {
  return new GameRendererEffectsBridgeRuntime(input);
}

class GameRendererEffectsBridgeRuntime implements RendererEffectsBridgeRuntime {
  private effectsRuntime?: RendererEffectsRuntime;
  private unsubscribeQualityListener?: () => void;

  constructor(private readonly input: CreateRendererEffectsBridgeRuntimeInput) {}

  public setupPostProcessingEffects(): void {
    this.getOrCreateEffectsRuntime().setupPostProcessingEffects(this.input.resolveQualityFeatures());
  }

  public applyEnvironment(): void {
    void this.getOrCreateEffectsRuntime().applyEnvironment();
  }

  public applyQualityFeatures(features: QualityFeatures): void {
    this.getOrCreateEffectsRuntime().applyQualityFeatures(features);
  }

  public subscribeToQualityController(): void {
    if (this.unsubscribeQualityListener) {
      return;
    }

    this.unsubscribeQualityListener = this.input.addQualityListener((event) => {
      this.applyQualityFeatures(event.currentFeatures);
    });
  }

  public updateWeatherPostProcessing(): void {
    const weatherState = this.input.resolveWeatherState();
    if (!weatherState || !this.effectsRuntime) {
      return;
    }

    this.effectsRuntime.updateWeatherPostProcessing(weatherState);
  }

  public dispose(): void {
    this.unsubscribeQualityListener?.();
    this.unsubscribeQualityListener = undefined;
    this.effectsRuntime = undefined;
  }

  private getOrCreateEffectsRuntime(): RendererEffectsRuntime {
    if (!this.effectsRuntime) {
      this.effectsRuntime = this.input.createEffectsRuntime();
    }

    return this.effectsRuntime;
  }
}
