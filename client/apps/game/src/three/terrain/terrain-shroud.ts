import { BiomeType } from "@bibliothecadao/types";
import { Color } from "three";

import { TERRAIN_BIOME_ART_DIRECTIONS } from "./terrain-biome-art-direction";
import { terrainHexToWorld, terrainNeighborCoordinates } from "./terrain-coordinates";
import type { TerrainField } from "./terrain-field";
import { hashTerrainCoordinates, terrainHashToUnitFloat } from "./terrain-hash";
import type { TerrainPageRequest, TerrainShroudInstance } from "./terrain-types";

const DEEP_SHROUD_COLOR = new Color("#2b4050");
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
  const exploredNeighborBiomes = terrainNeighborCoordinates(col, row)
    .map((neighbor) => field.getCell(neighbor.col, neighbor.row))
    .filter((neighbor): neighbor is NonNullable<typeof neighbor> & { biome: BiomeType } =>
      Boolean(neighbor?.explored && neighbor.biome),
    )
    .map(({ biome }) => biome);
  const center = terrainHexToWorld(col, row);
  return {
    col,
    frontier: exploredNeighborBiomes.length > 0,
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
    tint: resolveShroudTint(exploredNeighborBiomes),
    worldX: center.x,
    worldY: field.sampleVisual(center.x, center.z, { col, row }).height + SHROUD_SURFACE_OFFSET,
    worldZ: center.z,
  };
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
