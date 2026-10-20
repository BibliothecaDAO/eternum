import type { BiomeType } from "@bibliothecadao/types";

/** A biome as players read it: "TemperateRainForest" reads "Temperate Rain Forest". The one place biomes are named. */
export const biomeDisplayName = (biome: BiomeType | string): string =>
  biome
    .toString()
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
