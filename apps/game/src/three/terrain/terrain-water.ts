import { BiomeType } from "@bibliothecadao/types";

export const TERRAIN_WATER_LEVEL = -0.055;

export function isTerrainWaterBiome(biome: BiomeType | null): boolean {
  return biome === BiomeType.DeepOcean || biome === BiomeType.Ocean;
}
