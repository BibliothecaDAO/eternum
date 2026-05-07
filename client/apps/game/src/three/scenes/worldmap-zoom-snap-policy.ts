import type { RendererActiveMode } from "../renderer-backend-v2";

export function shouldSnapWorldmapZoomBandChange(input: { activeMode: RendererActiveMode | null }): boolean {
  return input.activeMode === "webgpu";
}
