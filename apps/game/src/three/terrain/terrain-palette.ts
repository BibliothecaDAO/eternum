import { BiomeType } from "@bibliothecadao/types";

export interface TerrainBiomeDescriptor {
  baseHeight: number;
  elevationScale: number;
  foliage: number;
  label: string;
  primary: string;
  relief: number;
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
  [BiomeType.None]: descriptor("Unknown", "#303530", "#252a27", -0.04, 0, 0.01, 1, 0, 0, 0, 0),
  [BiomeType.DeepOcean]: descriptor("Deep Ocean", "#173b50", "#0d2638", -0.34, 0.04, 0.01, 0.34, 0, 0, 0, 0),
  [BiomeType.Ocean]: descriptor("Ocean", "#24647a", "#163f59", -0.2, 0.04, 0.012, 0.3, 0, 0, 0, 0),
  [BiomeType.Beach]: descriptor("Beach", "#c7ad76", "#9c7e4e", 0.008, 0.025, 0.008, 0.82, 0.04, 0.06, 0, 1),
  [BiomeType.Scorched]: descriptor("Scorched", "#5e5147", "#352e2c", 0.18, 0.26, 0.07, 0.96, 0.01, 0.9, 0, 0),
  [BiomeType.Bare]: descriptor("Bare", "#827b6c", "#544f48", 0.16, 0.23, 0.055, 0.92, 0.01, 0.82, 0, 0),
  [BiomeType.Tundra]: descriptor("Tundra", "#8c8a76", "#686b60", 0.13, 0.18, 0.035, 0.95, 0.08, 0.48, 0.3, 0),
  [BiomeType.Snow]: descriptor("Snow", "#e4e7df", "#aebbc0", 0.2, 0.24, 0.045, 0.76, 0.02, 0.35, 1, 0),
  [BiomeType.TemperateDesert]: descriptor(
    "Temperate Desert",
    "#b98454",
    "#80543b",
    0.08,
    0.13,
    0.025,
    0.9,
    0.08,
    0.3,
    0,
    0,
  ),
  [BiomeType.Shrubland]: descriptor("Shrubland", "#9c9360", "#69734d", 0.07, 0.12, 0.03, 0.96, 0.38, 0.22, 0, 0),
  [BiomeType.Taiga]: descriptor("Taiga", "#526b57", "#344b43", 0.11, 0.17, 0.038, 0.98, 0.72, 0.3, 0.2, 0),
  [BiomeType.Grassland]: descriptor("Grassland", "#79915a", "#526842", 0.055, 0.1, 0.025, 1, 0.32, 0.08, 0, 0),
  [BiomeType.TemperateDeciduousForest]: descriptor(
    "Deciduous Forest",
    "#4f7549",
    "#2f5036",
    0.075,
    0.12,
    0.032,
    1,
    0.82,
    0.12,
    0,
    0,
  ),
  [BiomeType.TemperateRainForest]: descriptor(
    "Temperate Rain Forest",
    "#3f6950",
    "#24463e",
    0.085,
    0.14,
    0.038,
    0.98,
    0.9,
    0.16,
    0,
    0,
  ),
  [BiomeType.SubtropicalDesert]: descriptor(
    "Subtropical Desert",
    "#c39961",
    "#8a6744",
    0.065,
    0.11,
    0.022,
    0.88,
    0.05,
    0.2,
    0,
    0,
  ),
  [BiomeType.TropicalSeasonalForest]: descriptor(
    "Tropical Seasonal Forest",
    "#527a43",
    "#355333",
    0.07,
    0.12,
    0.03,
    0.98,
    0.78,
    0.08,
    0,
    0,
  ),
  [BiomeType.TropicalRainForest]: descriptor(
    "Tropical Rain Forest",
    "#376a43",
    "#1f4933",
    0.08,
    0.14,
    0.035,
    0.96,
    1,
    0.1,
    0,
    0,
  ),
});

function descriptor(
  label: string,
  primary: string,
  secondary: string,
  baseHeight: number,
  elevationScale: number,
  relief: number,
  roughness: number,
  foliage: number,
  stone: number,
  snow: number,
  shore: number,
): TerrainBiomeDescriptor {
  return { baseHeight, elevationScale, foliage, label, primary, relief, roughness, secondary, shore, snow, stone };
}
