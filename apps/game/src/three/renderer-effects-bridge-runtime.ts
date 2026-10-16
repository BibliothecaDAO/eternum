import type { RendererEffectsRuntime } from "./renderer-effects-runtime";
import type { RenderVisualProfile } from "./render-profile";

interface CreateRendererEffectsBridgeRuntimeInput {
  createEffectsRuntime: () => RendererEffectsRuntime;
}

export interface RendererEffectsBridgeRuntime {
  reportEnvironmentSupport(): void;
  applyRenderVisualProfile(features: RenderVisualProfile): void;
  dispose(): void;
}

export function createRendererEffectsBridgeRuntime(
  input: CreateRendererEffectsBridgeRuntimeInput,
): RendererEffectsBridgeRuntime {
  return new GameRendererEffectsBridgeRuntime(input);
}

class GameRendererEffectsBridgeRuntime implements RendererEffectsBridgeRuntime {
  private effectsRuntime?: RendererEffectsRuntime;

  constructor(private readonly input: CreateRendererEffectsBridgeRuntimeInput) {}

  public reportEnvironmentSupport(): void {
    this.getOrCreateEffectsRuntime().reportEnvironmentSupport();
  }

  public applyRenderVisualProfile(features: RenderVisualProfile): void {
    this.getOrCreateEffectsRuntime().applyRenderVisualProfile(features);
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
