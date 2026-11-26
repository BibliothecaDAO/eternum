import { BiomeType } from "@bibliothecadao/types/terrain";
import { Color } from "three/src/math/Color.js";

export interface TerrainBiomeDescriptor {
  foliage: number;
  label: string;
  primary: string;
  roughness: number;
  secondary: string;
  shore: number;
  snow: number;
  stone: number;
}

export const TERRAIN_BIOME_ORDER = Object.freeze([
  BiomeType.DeepOcean,
  BiomeType.Ocean,
  BiomeType.Beach,
  BiomeType.Scorched,
  BiomeType.Bare,
  BiomeType.Tundra,
  BiomeType.Snow,
  BiomeType.TemperateDesert,
  BiomeType.Shrubland,
  BiomeType.Taiga,
  BiomeType.Grassland,
  BiomeType.TemperateDeciduousForest,
  BiomeType.TemperateRainForest,
  BiomeType.SubtropicalDesert,
  BiomeType.TropicalSeasonalForest,
  BiomeType.TropicalRainForest,
] as const);

export const TERRAIN_BIOME_DESCRIPTORS: Readonly<Record<BiomeType, TerrainBiomeDescriptor>> = Object.freeze({
  [BiomeType.Underground]: descriptor("Ethereal", "#393131", "#626d7b", 0.92, 0, 0.82, 0, 0),
  [BiomeType.None]: descriptor("Unknown", "#303530", "#252a27", 1, 0, 0, 0, 0),
  [BiomeType.DeepOcean]: descriptor("Deep Ocean", "#214670", "#172c4b", 0.34, 0, 0, 0, 0),
  [BiomeType.Ocean]: descriptor("Ocean", "#368995", "#206777", 0.3, 0, 0, 0, 0),
  [BiomeType.Beach]: descriptor("Beach", "#e0d4af", "#baa87f", 0.82, 0.04, 0.06, 0, 1),
  [BiomeType.Scorched]: descriptor("Scorched", "#34373b", "#77736c", 0.96, 0.01, 0.9, 0, 0),
  [BiomeType.Bare]: descriptor("Bare", "#a0a9b3", "#626d7b", 0.92, 0.01, 0.82, 0, 0),
  [BiomeType.Tundra]: descriptor("Tundra", "#a79a76", "#785943", 0.95, 0.08, 0.48, 0.3, 0),
  [BiomeType.Snow]: descriptor("Snow", "#ebf1f1", "#b3cbd8", 0.94, 0.02, 0.2, 1, 0),
  [BiomeType.TemperateDesert]: descriptor("Temperate Desert", "#bd7954", "#86472f", 0.9, 0.08, 0.3, 0, 0),
  [BiomeType.Shrubland]: descriptor("Shrubland", "#b0a37a", "#7b8064", 0.96, 0.38, 0.22, 0, 0),
  [BiomeType.Taiga]: descriptor("Taiga", "#526f71", "#2e4e53", 0.98, 0.72, 0.3, 0.2, 0),
  [BiomeType.Grassland]: descriptor("Grassland", "#a6b66b", "#748a43", 1, 0.32, 0.08, 0, 0),
  [BiomeType.TemperateDeciduousForest]: descriptor("Deciduous Forest", "#9d8050", "#635333", 1, 0.82, 0.12, 0, 0),
  [BiomeType.TemperateRainForest]: descriptor("Temperate Rain Forest", "#628d80", "#345b50", 0.98, 0.9, 0.16, 0, 0),
  [BiomeType.SubtropicalDesert]: descriptor("Subtropical Desert", "#e2b968", "#b48743", 0.88, 0.05, 0.2, 0, 0),
  [BiomeType.TropicalSeasonalForest]: descriptor(
    "Tropical Seasonal Forest",
    "#ae8b49",
    "#70703b",
    0.98,
    0.78,
    0.08,
    0,
    0,
  ),
  [BiomeType.TropicalRainForest]: descriptor("Tropical Rain Forest", "#398f61", "#24503c", 0.96, 1, 0.1, 0, 0),
});

function descriptor(
  label: string,
  primary: string,
  secondary: string,
  roughness: number,
  foliage: number,
  stone: number,
  snow: number,
  shore: number,
): TerrainBiomeDescriptor {
  return { foliage, label, primary, roughness, secondary, shore, snow, stone };
}

export const TERRAIN_GROUNDS = Object.freeze([
  "water",
  "sand",
  "snow",
  "tundra",
  "rock",
  "ash",
  "grass",
  "forest",
  "ethereal",
] as const);
export type TerrainGround = (typeof TERRAIN_GROUNDS)[number];

export const TERRAIN_BIOME_GROUNDS = Object.freeze({
  [BiomeType.Underground]: "ethereal",
  [BiomeType.None]: "grass",
  [BiomeType.DeepOcean]: "water",
  [BiomeType.Ocean]: "water",
  [BiomeType.Beach]: "sand",
  [BiomeType.Scorched]: "ash",
  [BiomeType.Bare]: "rock",
  [BiomeType.Tundra]: "tundra",
  [BiomeType.Snow]: "snow",
  [BiomeType.TemperateDesert]: "sand",
  [BiomeType.Shrubland]: "grass",
  [BiomeType.Taiga]: "forest",
  [BiomeType.Grassland]: "grass",
  [BiomeType.TemperateDeciduousForest]: "forest",
  [BiomeType.TemperateRainForest]: "forest",
  [BiomeType.SubtropicalDesert]: "sand",
  [BiomeType.TropicalSeasonalForest]: "forest",
  [BiomeType.TropicalRainForest]: "forest",
} satisfies Record<BiomeType, TerrainGround>);

const GROUND_BASES = {
  water: "#2b6b80",
  sand: "#e6d3a3",
  snow: "#f1f5f9",
  tundra: "#b0a68a",
  rock: "#9aa0a6",
  ash: "#4d4741",
  grass: "#6fa03a",
  forest: "#2f5d34",
  ethereal: "#393131",
} satisfies Record<TerrainGround, string>;
const BIOME_TINT_SHARE = 0.3;

export function terrainBiomePaint(biome: BiomeType, tone: "primary" | "secondary"): Color {
  const base = new Color(GROUND_BASES[TERRAIN_BIOME_GROUNDS[biome]]);
  return base.lerp(new Color(TERRAIN_BIOME_DESCRIPTORS[biome][tone]), BIOME_TINT_SHARE);
}

export interface TerrainBiomeTones {
  shadow: Color;
  body: Color;
  light: Color;
}

/** The ground's paint for each biome: the colour of its hollows, of its body and of what the sun catches. */
const TERRAIN_BIOME_GROUND_TONES = {
  [BiomeType.Underground]: ["#262021", "#393131", "#4d4444"],
  [BiomeType.None]: ["#232724", "#303530", "#3f4640"],
  [BiomeType.DeepOcean]: ["#172c4b", "#214670", "#2f5c8c"],
  [BiomeType.Ocean]: ["#206777", "#368995", "#4fa6b0"],
  [BiomeType.Beach]: ["#c2ad7c", "#e4d5a6", "#f7edcc"],
  [BiomeType.Scorched]: ["#17120f", "#342b27", "#55473f"],
  [BiomeType.Bare]: ["#555c68", "#8a919c", "#bcc1c8"],
  [BiomeType.Tundra]: ["#5f5a3c", "#8d8358", "#b5a878"],
  [BiomeType.Snow]: ["#a9c4e2", "#e3edf7", "#ffffff"],
  [BiomeType.TemperateDesert]: ["#7e4127", "#b76d44", "#dd9d6c"],
  [BiomeType.Shrubland]: ["#56682a", "#84963f", "#aeb85c"],
  [BiomeType.Taiga]: ["#1c3a34", "#346052", "#5a8a72"],
  [BiomeType.Grassland]: ["#2f6a14", "#519a24", "#78b83a"],
  [BiomeType.TemperateDeciduousForest]: ["#394a18", "#647a2a", "#93a244"],
  [BiomeType.TemperateRainForest]: ["#174a38", "#2c7a62", "#52a688"],
  [BiomeType.SubtropicalDesert]: ["#b47f38", "#e0b25e", "#f7d992"],
  [BiomeType.TropicalSeasonalForest]: ["#4a5a1c", "#7e8c30", "#aeb450"],
  [BiomeType.TropicalRainForest]: ["#0e4a26", "#1f7a3a", "#46aa58"],
} satisfies Record<BiomeType, [shadow: string, body: string, light: string]>;

export function terrainBiomeTones(biome: BiomeType): TerrainBiomeTones {
  const [shadow, body, light] = TERRAIN_BIOME_GROUND_TONES[biome];
  return { shadow: new Color(shadow), body: new Color(body), light: new Color(light) };
}
