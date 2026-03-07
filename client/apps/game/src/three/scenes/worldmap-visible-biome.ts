import { BiomeIdToType, BiomeType } from "@bibliothecadao/types";

interface ResolveVisibleWorldmapBiomeInput {
  exploredBiome?: BiomeType;
  isSpectating: boolean;
  simulateAllExplored: boolean;
  tileBiomeId?: number;
  simulatedBiome: BiomeType;
}

const normalizeBiomeType = (biome?: BiomeType | null): BiomeType | null => {
  if (biome === undefined || biome === null) {
    return null;
  }

  return biome === BiomeType.None ? BiomeType.Grassland : biome;
};

export function resolveVisibleWorldmapBiome(input: ResolveVisibleWorldmapBiomeInput): {
  biome: BiomeType | null;
  shouldRenderOutline: boolean;
} {
  const exploredBiome = normalizeBiomeType(input.exploredBiome);
  if (exploredBiome !== null) {
    return {
      biome: exploredBiome,
      shouldRenderOutline: false,
    };
  }

  if (input.isSpectating && input.tileBiomeId !== undefined) {
    const spectatorBiome = normalizeBiomeType(BiomeIdToType[input.tileBiomeId]);
    if (spectatorBiome !== null) {
      return {
        biome: spectatorBiome,
        shouldRenderOutline: false,
      };
    }
  }

  if (input.simulateAllExplored) {
    return {
      biome: input.simulatedBiome,
      shouldRenderOutline: false,
    };
  }

  return {
    biome: null,
    shouldRenderOutline: true,
  };
}
