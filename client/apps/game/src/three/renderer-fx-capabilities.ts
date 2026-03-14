import { snapshotRendererDiagnostics } from "./renderer-diagnostics";
import type { RendererActiveMode } from "./renderer-backend-v2";

export interface RendererFxCapabilities {
  activeMode: RendererActiveMode | null;
  supportsSpriteSceneFx: boolean;
  supportsBillboardMeshFx: boolean;
  supportsDomLabelFx: boolean;
}

type RendererFxCapabilitiesInput = {
  activeMode: RendererActiveMode | null;
};

export function resolveRendererFxCapabilities(
  input: RendererFxCapabilitiesInput | null,
): RendererFxCapabilities {
  const activeMode = input?.activeMode ?? null;
  const supportsSpriteSceneFx = activeMode === "legacy-webgl" || activeMode === "webgl2-fallback";

  return {
    activeMode,
    supportsSpriteSceneFx,
    supportsBillboardMeshFx: true,
    supportsDomLabelFx: true,
  };
}

export function snapshotRendererFxCapabilities(): RendererFxCapabilities {
  return resolveRendererFxCapabilities({
    activeMode: snapshotRendererDiagnostics().activeMode,
  });
}
