import { replaceRendererDiagnosticDegradations } from "./renderer-diagnostics";
import { resolveRendererEnvironmentPolicy } from "./game-renderer-policy";
import type { RendererBackend } from "./renderer-backend";
import type { RenderVisualProfile } from "./render-profile";
import { resolveRendererTargetPixelRatio } from "./renderer-display-runtime";

interface RendererEffectsScenes {
  hexceptionScene: { applyRenderVisualProfile(features: RenderVisualProfile): void };
  worldmapScene: { applyRenderVisualProfile(features: RenderVisualProfile): void };
}
interface CreateRendererEffectsRuntimeInput {
  backend: RendererBackend;
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
      const pixelRatio = resolveRendererTargetPixelRatio({
        devicePixelRatio: window.devicePixelRatio,
        cap: features.pixelRatio,
      });
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
