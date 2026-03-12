import type { FastTravelHexCoords } from "./fast-travel-hydration";

export interface FastTravelRenderState {
  terrainMode: "none";
  explorationMode: "fully-explored";
  hexes: Array<FastTravelHexCoords & { explored: true }>;
  shader: {
    uniforms: {
      baseColor: "#ff4fd8";
      glowColor: "#ff92ea";
      accentColor: "#ffd6f7";
      windowOrigin: FastTravelHexCoords;
      windowSize: {
        cols: number;
        rows: number;
      };
    };
  };
}

export function prepareFastTravelRenderState(input: {
  visibleHexWindow: FastTravelHexCoords[];
}): FastTravelRenderState {
  const colValues = input.visibleHexWindow.map((hex) => hex.col);
  const rowValues = input.visibleHexWindow.map((hex) => hex.row);
  const minCol = Math.min(...colValues);
  const maxCol = Math.max(...colValues);
  const minRow = Math.min(...rowValues);
  const maxRow = Math.max(...rowValues);

  return {
    terrainMode: "none",
    explorationMode: "fully-explored",
    hexes: input.visibleHexWindow.map((hex) => ({
      ...hex,
      explored: true as const,
    })),
    shader: {
      uniforms: {
        baseColor: "#ff4fd8",
        glowColor: "#ff92ea",
        accentColor: "#ffd6f7",
        windowOrigin: {
          col: minCol,
          row: minRow,
        },
        windowSize: {
          cols: maxCol - minCol + 1,
          rows: maxRow - minRow + 1,
        },
      },
    },
  };
}
