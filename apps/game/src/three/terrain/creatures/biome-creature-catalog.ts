import { BiomeType } from "@bibliothecadao/types";

/** What an animal does while it is stopped; each rig acts out the ones its anatomy allows. */
export type CreatureIdleAction = "stand" | "forage" | "watch" | "rest";

export interface CreatureTraits {
  movement: "land" | "water" | "air";
  /**
   * Its largest dimension on the map, in world units (a hex is 2 across). The order of sizes is the animals' own; the
   * range is compressed, as a beetle at a moose's true hundredth would not be seen.
   */
  size: number;
  /** Cruising speed in world units per second. Its rig takes its step rate from the ground this covers. */
  pace: number;
  /** How fast it turns, in radians per second. */
  agility: number;
  /** The chance it walks on from a tile it reaches without stopping. */
  wanderlust: number;
  /** What it does when it stops, picked evenly, and for how many seconds at least and at most. */
  idle: readonly CreatureIdleAction[];
  pause: readonly [shortest: number, longest: number];
  /** Seconds it runs, then freezes, within one walk: how small animals cross open ground. */
  bursts?: readonly [run: number, freeze: number];
  /** It travels flank first, as a crab does. */
  sidles?: true;
}

const GRAZER_IDLE = ["forage", "forage", "watch", "stand"] as const;
const HUNTER_IDLE = ["watch", "watch", "rest", "forage"] as const;
const CRAWLER_IDLE = ["stand", "watch"] as const;

const CREATURE_TRAITS = {
  "lantern-anglerfish": {
    movement: "water",
    size: 0.38,
    pace: 0.12,
    agility: 1.1,
    wanderlust: 0.5,
    idle: ["stand", "watch"],
    pause: [2, 6],
  },
  "green-sea-turtle": {
    movement: "water",
    size: 0.5,
    pace: 0.2,
    agility: 0.9,
    wanderlust: 0.6,
    idle: ["stand", "watch"],
    pause: [2, 5],
  },
  "shore-crab": {
    movement: "land",
    size: 0.28,
    pace: 0.3,
    agility: 3,
    wanderlust: 0.2,
    idle: ["stand", "watch", "forage"],
    pause: [2, 6],
    bursts: [0.7, 0.8],
    sidles: true,
  },
  "fire-beetle": {
    movement: "land",
    size: 0.24,
    pace: 0.2,
    agility: 4,
    wanderlust: 0.3,
    idle: CRAWLER_IDLE,
    pause: [1, 4],
    bursts: [1, 0.6],
  },
  "mountain-goat": {
    movement: "land",
    size: 0.55,
    pace: 0.14,
    agility: 2,
    wanderlust: 0.25,
    idle: GRAZER_IDLE,
    pause: [4, 10],
  },
  "arctic-fox": {
    movement: "land",
    size: 0.46,
    pace: 0.18,
    agility: 2.8,
    wanderlust: 0.5,
    idle: HUNTER_IDLE,
    pause: [2, 6],
  },
  "emperor-penguin": {
    movement: "land",
    size: 0.42,
    pace: 0.1,
    agility: 1.4,
    wanderlust: 0.2,
    idle: ["stand", "watch", "forage", "rest"],
    pause: [3, 8],
  },
  jackrabbit: {
    movement: "land",
    size: 0.32,
    pace: 0.34,
    agility: 3.5,
    wanderlust: 0.3,
    idle: ["forage", "watch", "watch"],
    pause: [3, 8],
    bursts: [0.9, 0.7],
  },
  "mediterranean-tortoise": {
    movement: "land",
    size: 0.3,
    pace: 0.045,
    agility: 0.6,
    wanderlust: 0.1,
    idle: ["forage", "stand", "rest"],
    pause: [4, 10],
  },
  moose: {
    movement: "land",
    size: 0.88,
    pace: 0.26,
    agility: 1.5,
    wanderlust: 0.2,
    idle: GRAZER_IDLE,
    pause: [5, 12],
  },
  "plains-zebra": {
    movement: "land",
    size: 0.72,
    pace: 0.22,
    agility: 1.8,
    wanderlust: 0.3,
    idle: GRAZER_IDLE,
    pause: [4, 10],
  },
  "red-deer": {
    movement: "land",
    size: 0.77,
    pace: 0.22,
    agility: 1.9,
    wanderlust: 0.3,
    idle: GRAZER_IDLE,
    pause: [4, 10],
  },
  "red-backed-salamander": {
    movement: "land",
    size: 0.3,
    pace: 0.08,
    agility: 2.2,
    wanderlust: 0.2,
    idle: CRAWLER_IDLE,
    pause: [3, 9],
    bursts: [1.2, 1],
  },
  "desert-scorpion": {
    movement: "land",
    size: 0.28,
    pace: 0.16,
    agility: 3,
    wanderlust: 0.2,
    idle: CRAWLER_IDLE,
    pause: [2, 7],
    bursts: [1.4, 0.8],
  },
  "bengal-tiger": {
    movement: "land",
    size: 1.0,
    pace: 0.17,
    agility: 1.8,
    wanderlust: 0.5,
    idle: HUNTER_IDLE,
    pause: [3, 9],
  },
  "keel-billed-toucan": {
    movement: "air",
    size: 0.32,
    pace: 0.75,
    agility: 2.6,
    wanderlust: 0.35,
    idle: ["stand", "watch", "forage"],
    pause: [3, 8],
  },
} as const satisfies Record<string, CreatureTraits>;

export type CreatureSpecies = keyof typeof CREATURE_TRAITS;

/** One native species per biome; terrestrial species can visit neighboring land biomes. */
const CREATURES: Readonly<Record<BiomeType, CreatureSpecies | null>> = {
  [BiomeType.Underground]: null,
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

export function creatureForBiome(biome: BiomeType | null): CreatureSpecies | null {
  if (biome === null) return null;
  const creature = CREATURES[biome];
  if (creature === undefined) throw new Error(`Missing wildlife mapping for biome ${biome}`);
  return creature;
}

export function creatureTraits(species: CreatureSpecies): CreatureTraits {
  return CREATURE_TRAITS[species];
}
