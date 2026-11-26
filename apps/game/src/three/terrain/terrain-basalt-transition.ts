import {
  findNearestTerrainHex,
  terrainCellKey,
  terrainHexToWorld,
  terrainNeighborCoordinates,
  type TerrainWorldCoordinate,
} from "./terrain-coordinates";
import { TERRAIN_GROUND_HEIGHT } from "./terrain-surface";
import type { TerrainCellInput, TerrainPageRequest } from "./terrain-types";

const APOTHEM = Math.sqrt(3) / 2;
const MARGIN_REACH = 0.62;

/** Surface-only mineral margins use revealed spires, never hidden biome or landmark data. */
export class SurfaceBasaltTransition {
  private readonly centersByCell = new Map<string, TerrainWorldCoordinate[]>();

  constructor(request: TerrainPageRequest) {
    if (request.surfacePresentation === "ethereal") return;
    const cells = new Map(
      [...request.halo, ...request.cells].map((cell) => [terrainCellKey(cell.col, cell.row), cell]),
    );
    for (const cell of cells.values()) {
      if (!cell.explored || !cell.biome || cell.surfacePresentation !== "ethereal") continue;
      const center = terrainHexToWorld(cell.col, cell.row);
      for (const coordinate of [cell, ...terrainNeighborCoordinates(cell.col, cell.row)]) {
        const key = terrainCellKey(coordinate.col, coordinate.row);
        const centers = this.centersByCell.get(key) ?? [];
        centers.push(center);
        this.centersByCell.set(key, centers);
      }
    }
  }

  affects(cell: Pick<TerrainCellInput, "col" | "row">): boolean {
    return this.centersByCell.has(terrainCellKey(cell.col, cell.row));
  }

  blendHeight(x: number, z: number, height: number): number {
    if (this.centersByCell.size === 0) return height;
    const distance = this.distanceFromPatch(x, z, findNearestTerrainHex(x, z));
    // Complete the first ring at the same height, then join the existing landform gently.
    const weight = 1 - smoothstep(0.16, MARGIN_REACH, distance);
    return height + (TERRAIN_GROUND_HEIGHT - height) * weight;
  }

  stoneWeight(x: number, z: number, cell: Pick<TerrainCellInput, "col" | "row">): number {
    return 1 - smoothstep(0.08, MARGIN_REACH, this.distanceFromPatch(x, z, cell));
  }

  private distanceFromPatch(x: number, z: number, cell: Pick<TerrainCellInput, "col" | "row">): number {
    let distance = Infinity;
    for (const center of this.centersByCell.get(terrainCellKey(cell.col, cell.row)) ?? []) {
      const dx = Math.abs(x - center.x),
        dz = Math.abs(z - center.z);
      distance = Math.min(distance, Math.max(dx, dx * 0.5 + dz * APOTHEM) - APOTHEM);
    }
    return distance;
  }
}

function smoothstep(low: number, high: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}
