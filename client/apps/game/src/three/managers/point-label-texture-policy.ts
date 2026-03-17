import type { RendererActiveMode } from "../renderer-backend-v2";

export function resolvePointLabelTextureFlipY(activeMode: RendererActiveMode | null): boolean {
  return activeMode === "legacy-webgl";
}
