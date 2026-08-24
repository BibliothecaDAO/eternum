import { BiomeType } from "@bibliothecadao/types";
import { Color } from "three";

import { TERRAIN_BIOME_ART_DIRECTIONS } from "./terrain-biome-art-direction";
import { terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";
import type { TerrainField } from "./terrain-field";
import { TERRAIN_DEEP_FOG_COLOR } from "./terrain-fog-style";
import { hashTerrainCoordinates, terrainHashToUnitFloat } from "./terrain-hash";
import type { TerrainCellInput, TerrainPageRequest, TerrainShroudInstance } from "./terrain-types";

const DEEP_SHROUD_COLOR = new Color(TERRAIN_DEEP_FOG_COLOR);
const SHROUD_SURFACE_OFFSET = 0.065;

export function prepareTerrainShroudInstances(
  request: TerrainPageRequest,
  field: TerrainField,
): TerrainShroudInstance[] {
  return request.cells
    .filter((cell) => !cell.explored)
    .map((cell) => prepareTerrainShroudInstance(request, field, cell.col, cell.row));
}

function prepareTerrainShroudInstance(
  request: TerrainPageRequest,
  field: TerrainField,
  col: number,
  row: number,
): TerrainShroudInstance {
  const exploredNeighbors = terrainNeighborCoordinates(col, row)
    .map((neighbor) => field.getCell(neighbor.col, neighbor.row))
    .filter((neighbor): neighbor is NonNullable<typeof neighbor> & { biome: BiomeType } =>
      Boolean(neighbor?.explored && neighbor.biome),
    );
  const center = terrainHexToWorld(col, row);
  const frontier = exploredNeighbors.length > 0;
  return {
    col,
    frontier,
    frontierDirection: resolveFrontierDirection(center, exploredNeighbors),
    pageKey: request.pageKey,
    row,
    seed: terrainHashToUnitFloat(
      hashTerrainCoordinates({
        col,
        elevationSeed: resolveSeed(request.climate.elevation_seed),
        moistureSeed: resolveSeed(request.climate.moisture_seed),
        row,
        salt: "terrain-exploration-shroud-v1",
      }),
    ),
    tint: resolveShroudTint(exploredNeighbors.map(({ biome }) => biome)),
    worldX: center.x,
    worldY: field.sampleFogPreviewVertex(center.x, center.z, { col, row }).height + SHROUD_SURFACE_OFFSET,
    worldZ: center.z,
  };
}

function resolveFrontierDirection(
  center: { x: number; z: number },
  exploredNeighbors: readonly TerrainCellInput[],
): readonly [number, number] {
  if (exploredNeighbors.length === 0) return [0, 0];
  let directionX = 0;
  let directionZ = 0;
  exploredNeighbors.forEach((neighbor) => {
    const neighborCenter = terrainHexToWorld(neighbor.col, neighbor.row);
    directionX += neighborCenter.x - center.x;
    directionZ += neighborCenter.z - center.z;
  });
  let length = Math.hypot(directionX, directionZ);
  if (length < 0.0001) {
    const fallback = terrainHexToWorld(exploredNeighbors[0].col, exploredNeighbors[0].row);
    directionX = fallback.x - center.x;
    directionZ = fallback.z - center.z;
    length = Math.hypot(directionX, directionZ);
  }
  return [directionX / length, directionZ / length];
}

function resolveShroudTint(exploredNeighborBiomes: readonly BiomeType[]): readonly [number, number, number] {
  if (exploredNeighborBiomes.length === 0) {
    return [DEEP_SHROUD_COLOR.r, DEEP_SHROUD_COLOR.g, DEEP_SHROUD_COLOR.b];
  }
  const frontierTint = new Color(0, 0, 0);
  let haze = 0;
  exploredNeighborBiomes.forEach((biome) => {
    const atmosphere = TERRAIN_BIOME_ART_DIRECTIONS[biome].atmosphere;
    frontierTint.add(new Color(atmosphere.tint));
    haze += atmosphere.haze;
  });
  frontierTint.multiplyScalar(1 / exploredNeighborBiomes.length);
  const blend = Math.min(0.5, 0.28 + (haze / exploredNeighborBiomes.length) * 0.5);
  frontierTint.lerpColors(DEEP_SHROUD_COLOR, frontierTint, blend);
  return [frontierTint.r, frontierTint.g, frontierTint.b];
}

function resolveSeed(value: number | undefined): number {
  return Number.isFinite(value) && value! > 0 ? Math.trunc(value!) : 0;
}
