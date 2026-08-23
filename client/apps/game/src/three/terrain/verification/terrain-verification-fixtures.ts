import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";

import type { TerrainPageRequest } from "../terrain-types";

export const ALL_BIOMES_FIXTURE_ID = "all-biomes-game-scale-v2";
export const ALL_BIOMES_COLUMNS = 20;
export const ALL_BIOMES_ROWS = 16;

const BIOME_REGION_COLUMNS = 4;
const BIOME_REGION_WIDTH = ALL_BIOMES_COLUMNS / BIOME_REGION_COLUMNS;
const BIOME_REGION_HEIGHT = ALL_BIOMES_ROWS / 4;
const SHOWCASE_BIOME_GRID = Object.freeze([
  BiomeType.DeepOcean,
  BiomeType.Ocean,
  BiomeType.Beach,
  BiomeType.SubtropicalDesert,
  BiomeType.TropicalRainForest,
  BiomeType.TropicalSeasonalForest,
  BiomeType.Grassland,
  BiomeType.TemperateDesert,
  BiomeType.TemperateRainForest,
  BiomeType.TemperateDeciduousForest,
  BiomeType.Shrubland,
  BiomeType.Bare,
  BiomeType.Taiga,
  BiomeType.Tundra,
  BiomeType.Snow,
  BiomeType.Scorched,
] as const);

export function createAllBiomesTerrainRequest(): TerrainPageRequest {
  return {
    cells: createShowcaseCells(),
    climate: { ...NEUTRAL_BIOME_CLIMATE, elevation_seed: 137, moisture_seed: 991 },
    generation: 1,
    halo: [],
    mapCenter: 0,
    pageKey: ALL_BIOMES_FIXTURE_ID,
    strictBiomeParity: false,
    subdivisions: 2,
  };
}

function createShowcaseCells() {
  return Array.from({ length: ALL_BIOMES_COLUMNS * ALL_BIOMES_ROWS }, (_, index) => {
    const col = index % ALL_BIOMES_COLUMNS;
    const row = Math.floor(index / ALL_BIOMES_COLUMNS);
    return {
      biome: resolveShowcaseBiome(col, row),
      col,
      occupied: false,
      row,
    };
  });
}

function resolveShowcaseBiome(col: number, row: number): BiomeType {
  const warpedCol = col + Math.sin(row * 0.72) * 0.65 + Math.sin((col + row) * 0.31) * 0.35;
  const warpedRow = row + Math.sin(col * 0.51) * 0.55;
  const regionCol = clampRegion(Math.floor(warpedCol / BIOME_REGION_WIDTH), BIOME_REGION_COLUMNS);
  const regionRow = clampRegion(Math.floor(warpedRow / BIOME_REGION_HEIGHT), SHOWCASE_BIOME_GRID.length / 4);
  return SHOWCASE_BIOME_GRID[regionRow * BIOME_REGION_COLUMNS + regionCol];
}

function clampRegion(value: number, count: number): number {
  return Math.min(count - 1, Math.max(0, value));
}
