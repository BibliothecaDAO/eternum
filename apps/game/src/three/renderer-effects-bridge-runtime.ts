import type { RendererEffectsRuntime } from "./renderer-effects-runtime";
import type { RenderVisualProfile } from "./render-profile";

type RendererWeatherPostProcessingState = {
  intensity: number;
  stormIntensity: number;
};

interface CreateRendererEffectsBridgeRuntimeInput {
  createEffectsRuntime: () => RendererEffectsRuntime;
  resolveRenderVisualProfile: () => RenderVisualProfile;
  resolveWeatherState: () => RendererWeatherPostProcessingState | undefined;
}

export interface RendererEffectsBridgeRuntime {
  applyEnvironment(): void;
  applyRenderVisualProfile(features: RenderVisualProfile): void;
  dispose(): void;
  setupPostProcessingEffects(): void;
  updateWeatherPostProcessing(weatherState?: RendererWeatherPostProcessingState): void;
}

export function createRendererEffectsBridgeRuntime(
  input: CreateRendererEffectsBridgeRuntimeInput,
): RendererEffectsBridgeRuntime {
  return new GameRendererEffectsBridgeRuntime(input);
}

class GameRendererEffectsBridgeRuntime implements RendererEffectsBridgeRuntime {
  private effectsRuntime?: RendererEffectsRuntime;

  constructor(private readonly input: CreateRendererEffectsBridgeRuntimeInput) {}

  public setupPostProcessingEffects(): void {
    this.getOrCreateEffectsRuntime().setupPostProcessingEffects(this.input.resolveRenderVisualProfile());
  }

  public applyEnvironment(): void {
    void this.getOrCreateEffectsRuntime().applyEnvironment();
  }

  public applyRenderVisualProfile(features: RenderVisualProfile): void {
    this.getOrCreateEffectsRuntime().applyRenderVisualProfile(features);
  }

  public updateWeatherPostProcessing(weatherState = this.input.resolveWeatherState()): void {
    if (!weatherState || !this.effectsRuntime) {
      return;
    }

    this.effectsRuntime.updateWeatherPostProcessing(weatherState);
  }

  public dispose(): void {
    this.effectsRuntime = undefined;
  }

  private getOrCreateEffectsRuntime(): RendererEffectsRuntime {
    if (!this.effectsRuntime) {
      this.effectsRuntime = this.input.createEffectsRuntime();
    }

    return this.effectsRuntime;
  }
}
