import { replaceRendererDiagnosticDegradations } from "./renderer-diagnostics";
import { resolveRendererEnvironmentPolicy } from "./game-renderer-policy";
import type { RendererBackend } from "./renderer-backend";
import type { RenderVisualProfile } from "./render-profile";

interface RendererEffectsScenes {
  hexceptionScene: { applyRenderVisualProfile(features: RenderVisualProfile): void };
  worldmapScene: { applyRenderVisualProfile(features: RenderVisualProfile): void };
}
interface CreateRendererEffectsRuntimeInput {
  backend: RendererBackend;
  resolvePixelRatio?: (pixelRatio: number) => number;
  scenes: RendererEffectsScenes;
}
export interface RendererEffectsRuntime {
  reportEnvironmentSupport(): void;
  applyRenderVisualProfile(features: RenderVisualProfile): void;
}
export function createRendererEffectsRuntime(input: CreateRendererEffectsRuntimeInput): RendererEffectsRuntime {
  return {
    reportEnvironmentSupport() {
      const policy = resolveRendererEnvironmentPolicy({ capabilities: input.backend.capabilities, intensity: 0.55 });
      replaceRendererDiagnosticDegradations(["environmentIbl"], policy.degradations);
    },
    applyRenderVisualProfile(features) {
      const devicePixelRatio = Math.max(window.devicePixelRatio || 1, 1);
      const requestedPixelRatio = Math.min(devicePixelRatio, features.pixelRatio);
      const pixelRatio = input.resolvePixelRatio?.(requestedPixelRatio) ?? requestedPixelRatio;
      input.backend.applyRenderVisuals({
        height: window.innerHeight,
        pixelRatio,
        shadows: features.shadows,
        width: window.innerWidth,
      });
      input.scenes.worldmapScene.applyRenderVisualProfile(features);
      input.scenes.hexceptionScene.applyRenderVisualProfile(features);
    },
  };
}
