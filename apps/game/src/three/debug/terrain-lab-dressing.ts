import { BiomeType } from "@bibliothecadao/types/terrain";

/** What stands and lies on a biome's ground in the lab's trial of real ground, for each tile. */
export interface GroundDressing {
  blades: number;
  /** The tallest blade, in tile radii. */
  bladeHeight: number;
  leaves: number;
  leafTint: string;
  stones: number;
  /** The biome whose tones its stones take. */
  stoneTones: BiomeType;
  /** A surface with depth laid over the tile, in place of blades and leaves. */
  blanket: "none" | "snow" | "dunes" | "beach" | "rock" | "crag" | "earth";
}

const BARE: GroundDressing = {
  blades: 0,
  bladeHeight: 0,
  leaves: 0,
  leafTint: "#000000",
  stones: 0,
  stoneTones: BiomeType.Bare,
  blanket: "none",
};
const dressed = (dressing: Partial<GroundDressing>): GroundDressing => ({ ...BARE, ...dressing });

export const TERRAIN_LAB_DRESSING = {
  [BiomeType.Underground]: BARE,
  [BiomeType.None]: BARE,
  [BiomeType.DeepOcean]: BARE,
  [BiomeType.Ocean]: BARE,
  [BiomeType.Beach]: dressed({ blanket: "beach", stones: 0 }),
  [BiomeType.Scorched]: dressed({ blanket: "rock", stones: 9, stoneTones: BiomeType.Scorched }),
  [BiomeType.Bare]: dressed({ blanket: "crag", stones: 6, blades: 70, bladeHeight: 0.1 }),
  [BiomeType.Tundra]: dressed({ blades: 520, bladeHeight: 0.11, stones: 5 }),
  [BiomeType.Snow]: dressed({ blanket: "snow" }),
  [BiomeType.TemperateDesert]: dressed({
    blanket: "earth",
    stones: 7,
    stoneTones: BiomeType.TemperateDesert,
    blades: 130,
    bladeHeight: 0.12,
  }),
  [BiomeType.Shrubland]: dressed({ blades: 1700, bladeHeight: 0.17, stones: 0 }),
  [BiomeType.Taiga]: dressed({ blades: 520, bladeHeight: 0.12, leaves: 260, leafTint: "#5a4326" }),
  [BiomeType.Grassland]: dressed({ blades: 2600, bladeHeight: 0.2 }),
  [BiomeType.TemperateDeciduousForest]: dressed({ blades: 620, bladeHeight: 0.14, leaves: 720, leafTint: "#b8621c" }),
  [BiomeType.TemperateRainForest]: dressed({ blades: 950, bladeHeight: 0.16, leaves: 360, leafTint: "#4a5a2a" }),
  [BiomeType.SubtropicalDesert]: dressed({ blanket: "dunes", stones: 0 }),
  [BiomeType.TropicalSeasonalForest]: dressed({ blades: 620, bladeHeight: 0.15, leaves: 620, leafTint: "#c08a2a" }),
  [BiomeType.TropicalRainForest]: dressed({ blades: 1150, bladeHeight: 0.18, leaves: 360, leafTint: "#3c5a24" }),
} satisfies Record<BiomeType, GroundDressing>;
