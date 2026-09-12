import { BiomeType } from "@bibliothecadao/types/terrain";

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
  [BiomeType.Underground]: descriptor("Ethereal", "#393131", "#626d7b", 0.16, 0.23, 0.055, 0.92, 0, 0.82, 0, 0),
  [BiomeType.None]: descriptor("Unknown", "#303530", "#252a27", -0.04, 0, 0.01, 1, 0, 0, 0, 0),
  [BiomeType.DeepOcean]: descriptor("Deep Ocean", "#214670", "#172c4b", -0.34, 0.04, 0.01, 0.34, 0, 0, 0, 0),
  [BiomeType.Ocean]: descriptor("Ocean", "#368995", "#206777", -0.2, 0.04, 0.012, 0.3, 0, 0, 0, 0),
  [BiomeType.Beach]: descriptor("Beach", "#e0d4af", "#baa87f", 0.008, 0.025, 0.008, 0.82, 0.04, 0.06, 0, 1),
  [BiomeType.Scorched]: descriptor("Scorched", "#34373b", "#77736c", 0.18, 0.26, 0.07, 0.96, 0.01, 0.9, 0, 0),
  [BiomeType.Bare]: descriptor("Bare", "#a0a9b3", "#626d7b", 0.16, 0.23, 0.055, 0.92, 0.01, 0.82, 0, 0),
  [BiomeType.Tundra]: descriptor("Tundra", "#a79a76", "#785943", 0.13, 0.18, 0.035, 0.95, 0.08, 0.48, 0.3, 0),
  [BiomeType.Snow]: descriptor("Snow", "#ebf1f1", "#b3cbd8", 0.2, 0.24, 0.045, 0.94, 0.02, 0.2, 1, 0),
  [BiomeType.TemperateDesert]: descriptor(
    "Temperate Desert",
    "#bd7954",
    "#86472f",
    0.08,
    0.13,
    0.025,
    0.9,
    0.08,
    0.3,
    0,
    0,
  ),
  [BiomeType.Shrubland]: descriptor("Shrubland", "#b0a37a", "#7b8064", 0.07, 0.12, 0.03, 0.96, 0.38, 0.22, 0, 0),
  [BiomeType.Taiga]: descriptor("Taiga", "#526f71", "#2e4e53", 0.11, 0.17, 0.038, 0.98, 0.72, 0.3, 0.2, 0),
  [BiomeType.Grassland]: descriptor("Grassland", "#a6b66b", "#748a43", 0.055, 0.1, 0.025, 1, 0.32, 0.08, 0, 0),
  [BiomeType.TemperateDeciduousForest]: descriptor(
    "Deciduous Forest",
    "#9d8050",
    "#635333",
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
    "#628d80",
    "#345b50",
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
    "#e2b968",
    "#b48743",
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
    "#ae8b49",
    "#70703b",
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
    "#398f61",
    "#24503c",
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
