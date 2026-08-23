import { NEUTRAL_BIOME_CLIMATE } from "@bibliothecadao/eternum";
import { BiomeType } from "@bibliothecadao/types";

import type { TerrainPageRequest } from "../terrain-types";

export const ALL_BIOMES_FIXTURE_ID = "all-biomes-game-scale-v2";
export const ALL_BIOMES_COLUMNS = 20;
export const ALL_BIOMES_ROWS = 16;
export const TERRAIN_ANCHOR_COLUMNS = 18;
export const TERRAIN_ANCHOR_ROWS = 12;

export const TERRAIN_VERIFICATION_SCENE_IDS = Object.freeze([
  "all-biomes",
  "temperate-grove",
  "tropical-coast",
  "arid-basin",
  "cold-front",
  "scorched-ridge",
] as const);

export type TerrainVerificationSceneId = (typeof TERRAIN_VERIFICATION_SCENE_IDS)[number];

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

export function createTerrainVerificationRequest(sceneId: TerrainVerificationSceneId): TerrainPageRequest {
  if (sceneId === "all-biomes") return createAllBiomesTerrainRequest();
  return {
    cells: createAnchorCells(sceneId),
    climate: { ...NEUTRAL_BIOME_CLIMATE, elevation_seed: 137, moisture_seed: 991 },
    generation: 1,
    halo: [],
    mapCenter: 0,
    pageKey: `terrain-anchor:${sceneId}`,
    strictBiomeParity: false,
    subdivisions: 3,
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

function createAnchorCells(sceneId: Exclude<TerrainVerificationSceneId, "all-biomes">) {
  return Array.from({ length: TERRAIN_ANCHOR_COLUMNS * TERRAIN_ANCHOR_ROWS }, (_, index) => {
    const col = index % TERRAIN_ANCHOR_COLUMNS;
    const row = Math.floor(index / TERRAIN_ANCHOR_COLUMNS);
    return {
      biome: resolveAnchorBiome(sceneId, col, row),
      col,
      occupied: col === Math.floor(TERRAIN_ANCHOR_COLUMNS * 0.58) && row === Math.floor(TERRAIN_ANCHOR_ROWS * 0.52),
      row,
    };
  });
}

function resolveAnchorBiome(
  sceneId: Exclude<TerrainVerificationSceneId, "all-biomes">,
  col: number,
  row: number,
): BiomeType {
  const x = col / (TERRAIN_ANCHOR_COLUMNS - 1);
  const y = row / (TERRAIN_ANCHOR_ROWS - 1);
  const warp = Math.sin(row * 0.82 + col * 0.21) * 0.045 + Math.sin(col * 0.47) * 0.035;
  switch (sceneId) {
    case "temperate-grove":
      if (y + warp < 0.22) return BiomeType.Grassland;
      if (x - warp > 0.68) return BiomeType.TemperateRainForest;
      return y - warp > 0.78 ? BiomeType.Shrubland : BiomeType.TemperateDeciduousForest;
    case "tropical-coast":
      if (x + warp < 0.16) return BiomeType.DeepOcean;
      if (x + warp < 0.3) return BiomeType.Ocean;
      if (x + warp < 0.4) return BiomeType.Beach;
      return y + warp < 0.48 ? BiomeType.TropicalRainForest : BiomeType.TropicalSeasonalForest;
    case "arid-basin":
      if (y + warp < 0.22) return BiomeType.Shrubland;
      if (x - warp > 0.76) return BiomeType.Bare;
      return x + y + warp > 1.18 ? BiomeType.TemperateDesert : BiomeType.SubtropicalDesert;
    case "cold-front":
      if (y + warp < 0.28) return BiomeType.Taiga;
      if (y + warp < 0.56) return BiomeType.Tundra;
      return x - warp > 0.78 ? BiomeType.Bare : BiomeType.Snow;
    case "scorched-ridge":
      if (x + warp < 0.24) return BiomeType.Grassland;
      if (x + warp < 0.45) return BiomeType.TemperateDesert;
      return y - warp > 0.76 ? BiomeType.Bare : BiomeType.Scorched;
  }
}

function clampRegion(value: number, count: number): number {
  return Math.min(count - 1, Math.max(0, value));
}
