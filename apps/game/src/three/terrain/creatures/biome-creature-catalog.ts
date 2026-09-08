import { BiomeType } from "@bibliothecadao/types";

/** One native species per biome; terrestrial species can visit neighboring land biomes. */
const CREATURES: Readonly<Record<BiomeType, string | null>> = {
  [BiomeType.None]: null,
  [BiomeType.DeepOcean]: "lantern-anglerfish",
  [BiomeType.Ocean]: "green-sea-turtle",
  [BiomeType.Beach]: "shore-crab",
  [BiomeType.Scorched]: "fire-beetle",
  [BiomeType.Bare]: "mountain-goat",
  [BiomeType.Tundra]: "arctic-fox",
  [BiomeType.Snow]: "emperor-penguin",
  [BiomeType.TemperateDesert]: "jackrabbit",
  [BiomeType.Shrubland]: "mediterranean-tortoise",
  [BiomeType.Taiga]: "moose",
  [BiomeType.Grassland]: "plains-zebra",
  [BiomeType.TemperateDeciduousForest]: "red-deer",
  [BiomeType.TemperateRainForest]: "red-backed-salamander",
  [BiomeType.SubtropicalDesert]: "desert-scorpion",
  [BiomeType.TropicalSeasonalForest]: "bengal-tiger",
  [BiomeType.TropicalRainForest]: "keel-billed-toucan",
};

export function creatureForBiome(biome: BiomeType | null): string | null {
  if (biome === null) return null;
  const creature = CREATURES[biome];
  if (creature === undefined) throw new Error(`Missing wildlife mapping for biome ${biome}`);
  return creature;
}

export function creatureMovement(creature: string): "land" | "water" | "air" {
  if (creature === "lantern-anglerfish" || creature === "green-sea-turtle") return "water";
  return creature === "keel-billed-toucan" ? "air" : "land";
}
