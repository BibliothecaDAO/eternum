import { BiomeType } from "@bibliothecadao/types";

import type { TerrainVegetationField } from "./terrain-field";

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

export interface TerrainGroundEcology {
  roughnessOffset: number;
  tint: readonly [number, number, number];
  weights: TerrainGroundWeights;
}

export interface TerrainGroundEcologyContext {
  allowsVegetation: boolean;
  moisture: number;
  shore: number;
  vegetation: TerrainVegetationField;
}

export function resolveTerrainGroundEcology(
  source: TerrainGroundWeights,
  context: TerrainGroundEcologyContext,
): TerrainGroundEcology {
  if (!context.allowsVegetation) return { roughnessOffset: 0, tint: [1, 1, 1], weights: source };

  const result = [...source];
  const vegetation = context.vegetation;
  const moisture = clampUnit(context.moisture);
  const shore = clampUnit(context.shore);
  const canopy = clampUnit(vegetation.canopyCover);
  const debris = clampUnit(vegetation.debrisCover);
  const moss = canopy * vegetation.maturity * moisture * (0.65 + debris * 0.35);
  const regeneratingCover = vegetation.successionStrength * vegetation.understoryCover * moisture * (1 - canopy * 0.35);
  const wetlandCover = shore * moisture * (1 - canopy * 0.45) * (0.5 + vegetation.edgeStrength * 0.5);
  const dryLitter = canopy * (1 - moisture) * (0.5 + vegetation.maturity * 0.5);

  result[GRASS] *= 1 - canopy * 0.62;
  result[GRASS] += regeneratingCover * 0.18 + wetlandCover * 0.22;
  result[LITTER] += canopy * 0.28 + debris * 0.14 + moss * 0.38 + regeneratingCover * 0.08 + dryLitter * 0.25;
  result[SOIL] += canopy * 0.06 + wetlandCover * 0.22;

  return {
    roughnessOffset: clamp(-0.16, 0.08, moss * 0.04 + dryLitter * 0.05 - wetlandCover * 0.14),
    tint: [
      clamp(0.78, 1.12, 1 - moss * 0.12 - regeneratingCover * 0.04 - wetlandCover * 0.1 + dryLitter * 0.06),
      clamp(0.78, 1.12, 1 - moss * 0.04 + regeneratingCover * 0.04 - wetlandCover * 0.04),
      clamp(0.78, 1.12, 1 - moss * 0.16 - regeneratingCover * 0.07 - wetlandCover * 0.08 - dryLitter * 0.1),
    ],
    weights: normalizeWeights(result),
  };
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

function clamp(minimum: number, maximum: number, value: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
