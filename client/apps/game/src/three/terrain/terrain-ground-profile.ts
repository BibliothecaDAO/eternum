import { BiomeType } from "@bibliothecadao/types";

export const TERRAIN_GROUND_SURFACE_IDS = Object.freeze([
  "sand",
  "dry-earth",
  "soil",
  "grass",
  "litter",
  "stone",
  "snow",
  "ash",
] as const);

export type TerrainGroundWeights = readonly [number, number, number, number, number, number, number, number];

const SAND = 0;
const DRY_EARTH = 1;
const SOIL = 2;
const GRASS = 3;
const LITTER = 4;
const STONE = 5;
const SNOW = 6;
const ASH = 7;

const BIOME_GROUND_RECIPES: Readonly<Record<BiomeType, TerrainGroundWeights>> = Object.freeze({
  [BiomeType.None]: weights(0, 0, 1, 0, 0, 0, 0, 0),
  [BiomeType.DeepOcean]: weights(0.1, 0, 0.5, 0, 0, 0.4, 0, 0),
  [BiomeType.Ocean]: weights(0.35, 0, 0.45, 0, 0, 0.2, 0, 0),
  [BiomeType.Beach]: weights(0.82, 0, 0.1, 0, 0, 0.08, 0, 0),
  [BiomeType.Scorched]: weights(0, 0.15, 0, 0, 0, 0.35, 0, 0.5),
  [BiomeType.Bare]: weights(0, 0.22, 0.08, 0, 0, 0.7, 0, 0),
  [BiomeType.Tundra]: weights(0, 0.3, 0.15, 0, 0, 0.3, 0.25, 0),
  [BiomeType.Snow]: weights(0, 0, 0.05, 0, 0, 0.2, 0.75, 0),
  [BiomeType.TemperateDesert]: weights(0.42, 0.43, 0, 0, 0, 0.15, 0, 0),
  [BiomeType.Shrubland]: weights(0.05, 0.3, 0.27, 0.28, 0, 0.1, 0, 0),
  [BiomeType.Taiga]: weights(0, 0, 0.12, 0.08, 0.55, 0.15, 0.1, 0),
  [BiomeType.Grassland]: weights(0, 0, 0.22, 0.7, 0, 0.08, 0, 0),
  [BiomeType.TemperateDeciduousForest]: weights(0, 0, 0.12, 0.18, 0.65, 0.05, 0, 0),
  [BiomeType.TemperateRainForest]: weights(0, 0, 0.15, 0.05, 0.72, 0.08, 0, 0),
  [BiomeType.SubtropicalDesert]: weights(0.62, 0.28, 0, 0, 0, 0.1, 0, 0),
  [BiomeType.TropicalSeasonalForest]: weights(0, 0, 0.15, 0.2, 0.6, 0.05, 0, 0),
  [BiomeType.TropicalRainForest]: weights(0, 0, 0.16, 0.09, 0.7, 0.05, 0, 0),
});

export function resolveTerrainGroundRecipe(
  biome: BiomeType,
  environment: { elevation: number; moisture: number },
): TerrainGroundWeights {
  const result = [...BIOME_GROUND_RECIPES[biome]];
  const moisture = clampUnit(environment.moisture);
  result[SAND] *= 1.2 - moisture * 0.35;
  result[DRY_EARTH] *= 1.18 - moisture * 0.32;
  result[SOIL] *= 0.88 + moisture * 0.24;
  result[GRASS] *= 0.72 + moisture * 0.55;
  result[LITTER] *= 0.74 + moisture * 0.48;
  const snowline = smoothstep(0.56, 0.82, environment.elevation);
  result[SNOW] *= 0.82 + snowline * 0.36;
  return normalizeWeights(result);
}

export function applyTerrainGroundSlope(source: TerrainGroundWeights, normalY: number): TerrainGroundWeights {
  const result = [...source];
  const steepness = 1 - smoothstep(0.84, 0.985, normalY);
  result[STONE] += steepness * 0.42;
  result[GRASS] *= 1 - steepness * 0.45;
  result[LITTER] *= 1 - steepness * 0.35;
  result[SNOW] *= 1 - steepness * 0.72;
  return normalizeWeights(result);
}

export function applyTerrainGroundStructurePad(source: TerrainGroundWeights, padWeight: number): TerrainGroundWeights {
  const compactGround = weights(0, 0.08, 0.72, 0, 0, 0.2, 0, 0);
  const blend = smoothstep(0, 1, padWeight);
  return normalizeWeights(source.map((weight, index) => weight + (compactGround[index] - weight) * blend));
}

export function blendTerrainGroundWeights(target: number[], source: TerrainGroundWeights, influence: number): void {
  source.forEach((weight, index) => {
    target[index] = (target[index] ?? 0) + weight * influence;
  });
}

export function normalizeTerrainGroundWeights(source: readonly number[]): TerrainGroundWeights {
  return normalizeWeights([...source]);
}

function weights(...values: TerrainGroundWeights): TerrainGroundWeights {
  return values;
}

function normalizeWeights(values: number[]): TerrainGroundWeights {
  const safeValues = values.map((value) => (Number.isFinite(value) ? Math.max(0, value) : 0));
  const total = safeValues.reduce((sum, value) => sum + value, 0);
  if (total <= Number.EPSILON) return BIOME_GROUND_RECIPES[BiomeType.None];
  return safeValues.map((value) => value / total) as unknown as TerrainGroundWeights;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const normalized = clampUnit((value - edge0) / (edge1 - edge0));
  return normalized * normalized * (3 - 2 * normalized);
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
