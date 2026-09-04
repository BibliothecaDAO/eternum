import type { HexPosition } from "@bibliothecadao/types";

import type { HoverVisualPalette } from "../managers/worldmap-interaction-palette";

export interface WorldmapHoverReconciliationSnapshot {
  hex: HexPosition | null;
  palette: HoverVisualPalette;
}

export function shouldReconcileWorldmapHover(
  previous: WorldmapHoverReconciliationSnapshot | null,
  next: WorldmapHoverReconciliationSnapshot,
): boolean {
  if (!previous) {
    return true;
  }

  return (
    previous.hex?.col !== next.hex?.col ||
    previous.hex?.row !== next.hex?.row ||
    previous.palette.baseColor !== next.palette.baseColor ||
    previous.palette.rimColor !== next.palette.rimColor ||
    previous.palette.intensity !== next.palette.intensity ||
    previous.palette.visualMode !== next.palette.visualMode
  );
}
