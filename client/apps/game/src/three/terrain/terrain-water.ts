import { BiomeType } from "@bibliothecadao/types";

export const TERRAIN_WATER_LEVEL = -0.055;
export const TERRAIN_MIN_RENDERED_WATER_DEPTH = 0.002;
export const TERRAIN_SHALLOW_WATER_DEPTH = 0.08;
export const TERRAIN_DEEP_WATER_DEPTH = 0.24;

export function isTerrainWaterBiome(biome: BiomeType | null): boolean {
  return biome === BiomeType.DeepOcean || biome === BiomeType.Ocean;
}

export function resolveTerrainWaterDepth(terrainHeight: number): number {
  if (!Number.isFinite(terrainHeight)) throw new Error(`Terrain water requires a finite bed height: ${terrainHeight}`);
  return Math.max(0, TERRAIN_WATER_LEVEL - terrainHeight);
}

export function isTerrainWaterCovered(terrainHeight: number): boolean {
  return resolveTerrainWaterDepth(terrainHeight) >= TERRAIN_MIN_RENDERED_WATER_DEPTH;
}

export function resolveTerrainWaterCrossing(startDepth: number, endDepth: number): number {
  const denominator = endDepth - startDepth;
  if (Math.abs(denominator) <= Number.EPSILON) return 0.5;
  return clampUnit((TERRAIN_MIN_RENDERED_WATER_DEPTH - startDepth) / denominator);
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
