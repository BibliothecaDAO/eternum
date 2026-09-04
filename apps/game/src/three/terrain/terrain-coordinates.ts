import { getNeighborHexes } from "@bibliothecadao/types";

const TERRAIN_HEX_RADIUS = 1;
const TERRAIN_HEX_HORIZONTAL_SPACING = Math.sqrt(3) * TERRAIN_HEX_RADIUS;
const TERRAIN_HEX_VERTICAL_SPACING = 1.5 * TERRAIN_HEX_RADIUS;
const TERRAIN_COORDINATE_PRECISION = 1_000_000;

export interface TerrainWorldCoordinate {
  x: number;
  z: number;
}

export function terrainHexToWorld(col: number, row: number): TerrainWorldCoordinate {
  const rowOffset = ((row % 2) * Math.sign(row) * TERRAIN_HEX_HORIZONTAL_SPACING) / 2;
  return {
    x: snapTerrainCoordinate(col * TERRAIN_HEX_HORIZONTAL_SPACING - rowOffset),
    z: snapTerrainCoordinate(row * TERRAIN_HEX_VERTICAL_SPACING),
  };
}

export function terrainHexCorners(col: number, row: number): TerrainWorldCoordinate[] {
  const center = terrainHexToWorld(col, row);
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 6 + index * (Math.PI / 3);
    return {
      x: snapTerrainCoordinate(center.x + Math.cos(angle) * TERRAIN_HEX_RADIUS),
      z: snapTerrainCoordinate(center.z + Math.sin(angle) * TERRAIN_HEX_RADIUS),
    };
  });
}

export function snapTerrainCoordinate(value: number): number {
  return Math.round(value * TERRAIN_COORDINATE_PRECISION) / TERRAIN_COORDINATE_PRECISION;
}

export function terrainNeighborCoordinates(col: number, row: number): Array<{ col: number; row: number }> {
  return getNeighborHexes(col, row).map((neighbor) => ({ col: neighbor.col, row: neighbor.row }));
}

export function terrainCellKey(col: number, row: number): string {
  return `${col}:${row}`;
}

export function findNearestTerrainHex(worldX: number, worldZ: number): { col: number; row: number } {
  const estimatedRow = Math.round(worldZ / TERRAIN_HEX_VERTICAL_SPACING);
  let nearest = { col: 0, row: estimatedRow };
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (let row = estimatedRow - 2; row <= estimatedRow + 2; row += 1) {
    const centerAtZero = terrainHexToWorld(0, row);
    const estimatedCol = Math.round((worldX - centerAtZero.x) / TERRAIN_HEX_HORIZONTAL_SPACING);
    for (let col = estimatedCol - 2; col <= estimatedCol + 2; col += 1) {
      const center = terrainHexToWorld(col, row);
      const distanceSquared = (center.x - worldX) ** 2 + (center.z - worldZ) ** 2;
      if (distanceSquared < nearestDistanceSquared) {
        nearest = { col, row };
        nearestDistanceSquared = distanceSquared;
      }
    }
  }

  return nearest;
}
