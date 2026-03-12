import type { FastTravelHexCoords } from "./fast-travel-hydration";

const FAST_TRAVEL_HEX_SIZE = 1;

export function getFastTravelWorldPositionForHex(hexCoords: FastTravelHexCoords): { x: number; y: number; z: number } {
  const hexHeight = FAST_TRAVEL_HEX_SIZE * 2;
  const hexWidth = Math.sqrt(3) * FAST_TRAVEL_HEX_SIZE;
  const verticalDistance = hexHeight * 0.75;
  const horizontalDistance = hexWidth;
  const rowOffset = ((hexCoords.row % 2) * Math.sign(hexCoords.row) * horizontalDistance) / 2;

  return {
    x: hexCoords.col * horizontalDistance - rowOffset,
    y: 0,
    z: hexCoords.row * verticalDistance,
  };
}

export interface FastTravelHexFieldTile {
  hexCoords: FastTravelHexCoords;
  explored: true;
  worldPosition: {
    x: number;
    y: number;
    z: number;
  };
}

export interface FastTravelHexField {
  bounds: {
    origin: FastTravelHexCoords;
    size: {
      cols: number;
      rows: number;
    };
  };
  tiles: FastTravelHexFieldTile[];
}

export function buildFastTravelHexField(input: { visibleHexWindow: FastTravelHexCoords[] }): FastTravelHexField {
  const colValues = input.visibleHexWindow.map((hex) => hex.col);
  const rowValues = input.visibleHexWindow.map((hex) => hex.row);
  const minCol = Math.min(...colValues);
  const maxCol = Math.max(...colValues);
  const minRow = Math.min(...rowValues);
  const maxRow = Math.max(...rowValues);

  return {
    bounds: {
      origin: {
        col: minCol,
        row: minRow,
      },
      size: {
        cols: maxCol - minCol + 1,
        rows: maxRow - minRow + 1,
      },
    },
    tiles: input.visibleHexWindow.map((hex) => {
      const worldPosition = getFastTravelWorldPositionForHex(hex);
      return {
        hexCoords: hex,
        explored: true as const,
        worldPosition: {
          x: worldPosition.x,
          y: worldPosition.y,
          z: worldPosition.z,
        },
      };
    }),
  };
}
