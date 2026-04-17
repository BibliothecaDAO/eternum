import type { RendererActiveMode } from "../renderer-backend";

export function resolvePointLabelTextureFlipY(activeMode: RendererActiveMode | null): boolean {
  return activeMode === "legacy-webgl";
}
