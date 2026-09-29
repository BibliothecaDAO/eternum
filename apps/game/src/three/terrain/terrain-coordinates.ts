import { getNeighborHexes } from "@bibliothecadao/types/terrain";
import { HEX_HORIZONTAL_SPACING, HEX_VERTICAL_SPACING } from "../utils/hex-lattice";
import { worldHexAt, worldHexToWorld } from "../world-origin";

const TERRAIN_HEX_RADIUS = 1;
export const TERRAIN_HEX_HORIZONTAL_SPACING = HEX_HORIZONTAL_SPACING;
export const TERRAIN_HEX_VERTICAL_SPACING = HEX_VERTICAL_SPACING;
const TERRAIN_COORDINATE_PRECISION = 1_000_000;

export interface TerrainWorldCoordinate {
  x: number;
  z: number;
}

/** Where a normalized terrain hex is drawn: the world map's lattice, through its floating origin. */
export function terrainHexToWorld(col: number, row: number): TerrainWorldCoordinate {
  const world = worldHexToWorld(col, row);
  return { x: snapTerrainCoordinate(world.x), z: snapTerrainCoordinate(world.z) };
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
  return worldHexAt(worldX, worldZ);
}
