import { calculateDistance } from "@bibliothecadao/eternum";
import { HexPosition, Position } from "@bibliothecadao/types";
import { Vector3 } from "three";

import { HEX_SIZE } from "../constants";

const getRowOffset = (row: number, horizDist: number): number => {
  return ((row % 2) * Math.sign(row) * horizDist) / 2;
};

export const getWorldPositionForHex = (hexCoords: HexPosition, flat: boolean = true) => {
  const hexRadius = HEX_SIZE;
  const hexHeight = hexRadius * 2;
  const hexWidth = Math.sqrt(3) * hexRadius;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;

  const col = hexCoords.col;
  const row = hexCoords.row;
  const rowOffset = getRowOffset(row, horizDist);
  const x = col * horizDist - rowOffset;
  const z = row * vertDist;
  const y = flat ? 0 : pseudoRandom(x, z) * 2;
  return new Vector3(x, y, z);
};

export const getWorldPositionForHexCoordsInto = (
  col: number,
  row: number,
  out: Vector3,
  flat: boolean = true,
): Vector3 => {
  const hexRadius = HEX_SIZE;
  const hexHeight = hexRadius * 2;
  const hexWidth = Math.sqrt(3) * hexRadius;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;

  const rowOffset = getRowOffset(row, horizDist);
  const x = col * horizDist - rowOffset;
  const z = row * vertDist;
  const y = flat ? 0 : pseudoRandom(x, z) * 2;

  out.set(x, y, z);
  return out;
};

export const getHexForWorldPosition = (worldPosition: { x: number; y: number; z: number }): HexPosition => {
  const hexRadius = HEX_SIZE;
  const hexHeight = hexRadius * 2;
  const hexWidth = Math.sqrt(3) * hexRadius;
  const vertDist = hexHeight * 0.75;
  const horizDist = hexWidth;
  const epsilon = 1e-12;

  const estimatedRow = Math.round(worldPosition.z / vertDist);
  const estimatedOffset = getRowOffset(estimatedRow, horizDist);
  const estimatedCol = Math.round((worldPosition.x + estimatedOffset) / horizDist);
  const originX = estimatedCol * horizDist - estimatedOffset;
  const originZ = estimatedRow * vertDist;
  const localWorldX = worldPosition.x - originX;
  const localWorldZ = worldPosition.z - originZ;

  let bestRow = estimatedRow;
  let bestCol = estimatedCol;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;

  for (let row = estimatedRow - 1; row <= estimatedRow + 1; row += 1) {
    const rowOffset = getRowOffset(row, horizDist);
    const nearestColForRow = Math.round((worldPosition.x + rowOffset) / horizDist);
    const localCenterZ = (row - estimatedRow) * vertDist;

    for (let col = nearestColForRow - 1; col <= nearestColForRow + 1; col += 1) {
      const localCenterX = (col - estimatedCol) * horizDist - (rowOffset - estimatedOffset);
      const dx = localWorldX - localCenterX;
      const dz = localWorldZ - localCenterZ;
      const distanceSquared = dx * dx + dz * dz;

      if (
        distanceSquared < bestDistanceSquared - epsilon ||
        (Math.abs(distanceSquared - bestDistanceSquared) <= epsilon &&
          (row < bestRow || (row === bestRow && col < bestCol)))
      ) {
        bestDistanceSquared = distanceSquared;
        bestRow = row;
        bestCol = col;
      }
    }
  }

  return { col: bestCol, row: bestRow };
};

export const calculateDistanceInHexes = (
  start: Pick<Position, "x" | "y">,
  destination: Pick<Position, "x" | "y">,
): number | undefined => {
  const distance = calculateDistance(start, destination);
  if (distance) {
    return Math.round(distance / HEX_SIZE / 2);
  }
  return undefined;
};

const pseudoRandom = (x: number, y: number) => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
  return n - Math.floor(n);
};
