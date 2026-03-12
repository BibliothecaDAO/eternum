import type { FastTravelHexCoords } from "./fast-travel-hydration";
import { buildFastTravelHexField, type FastTravelHexField } from "./fast-travel-hex-field";
import { createFastTravelSurfacePalette, type FastTravelSurfacePalette } from "./fast-travel-surface-material";

export interface FastTravelRenderState {
  terrainMode: "none";
  explorationMode: "fully-explored";
  hexes: Array<FastTravelHexCoords & { explored: true }>;
  surface: {
    field: FastTravelHexField;
    palette: FastTravelSurfacePalette;
  };
}

export function prepareFastTravelRenderState(input: {
  visibleHexWindow: FastTravelHexCoords[];
}): FastTravelRenderState {
  const field = buildFastTravelHexField(input);

  return {
    terrainMode: "none",
    explorationMode: "fully-explored",
    hexes: input.visibleHexWindow.map((hex) => ({
      ...hex,
      explored: true as const,
    })),
    surface: {
      field,
      palette: createFastTravelSurfacePalette(),
    },
  };
}
