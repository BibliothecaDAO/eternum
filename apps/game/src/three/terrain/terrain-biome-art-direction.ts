import { BiomeType } from "@bibliothecadao/types";

export type TerrainBiomeFamily = "arid" | "coast" | "cold" | "marine" | "open" | "temperate" | "volcanic";

export interface TerrainBiomeArtDirection {
  anchor: boolean;
  atmosphere: {
    haze: number;
    tint: string;
  };
  ecology: {
    canopyCover: number;
    clearingStrength: number;
    clusterScale: number;
    undergrowth: number;
  };
  family: TerrainBiomeFamily;
  landform: {
    basinStrength: number;
    macroAmplitude: number;
    macroFrequency: number;
    ridgeStrength: number;
  };
  material: {
    macroTintStrength: number;
    shoreWetness: number;
  };
  motion: {
    windAmplitude: number;
  };
}

type ArtDirectionOverrides = {
  anchor?: boolean;
  atmosphere?: Partial<TerrainBiomeArtDirection["atmosphere"]>;
  ecology?: Partial<TerrainBiomeArtDirection["ecology"]>;
  landform?: Partial<TerrainBiomeArtDirection["landform"]>;
  material?: Partial<TerrainBiomeArtDirection["material"]>;
  motion?: Partial<TerrainBiomeArtDirection["motion"]>;
};

const FAMILY_DEFAULTS: Record<TerrainBiomeFamily, Omit<TerrainBiomeArtDirection, "anchor" | "family">> = {
  marine: defineFamilyDefaults({
    atmosphere: { haze: 0.3, tint: "#9eb7bd" },
    ecology: { canopyCover: 0, clearingStrength: 0.12, clusterScale: 0.34, undergrowth: 0 },
    landform: { basinStrength: 0.6, macroAmplitude: 0.03, macroFrequency: 0.075, ridgeStrength: 0.08 },
    material: { macroTintStrength: 0.04, shoreWetness: 0.8 },
    motion: { windAmplitude: 0.08 },
  }),
  coast: defineFamilyDefaults({
    atmosphere: { haze: 0.22, tint: "#d6c294" },
    ecology: { canopyCover: 0.2, clearingStrength: 0.36, clusterScale: 0.24, undergrowth: 0.16 },
    landform: { basinStrength: 0.36, macroAmplitude: 0.065, macroFrequency: 0.08, ridgeStrength: 0.12 },
    material: { macroTintStrength: 0.16, shoreWetness: 1 },
    motion: { windAmplitude: 0.28 },
  }),
  arid: defineFamilyDefaults({
    atmosphere: { haze: 0.12, tint: "#cda26e" },
    ecology: { canopyCover: 0.04, clearingStrength: 0.32, clusterScale: 0.2, undergrowth: 0.12 },
    landform: { basinStrength: 0.2, macroAmplitude: 0.14, macroFrequency: 0.06, ridgeStrength: 0.42 },
    material: { macroTintStrength: 0.2, shoreWetness: 0.2 },
    motion: { windAmplitude: 0.24 },
  }),
  open: defineFamilyDefaults({
    atmosphere: { haze: 0.16, tint: "#aab68a" },
    ecology: { canopyCover: 0.15, clearingStrength: 0.42, clusterScale: 0.18, undergrowth: 0.72 },
    landform: { basinStrength: 0.3, macroAmplitude: 0.1, macroFrequency: 0.055, ridgeStrength: 0.2 },
    material: { macroTintStrength: 0.16, shoreWetness: 0.12 },
    motion: { windAmplitude: 0.52 },
  }),
  temperate: defineFamilyDefaults({
    atmosphere: { haze: 0.22, tint: "#819a82" },
    ecology: { canopyCover: 0.8, clearingStrength: 0.24, clusterScale: 0.13, undergrowth: 0.56 },
    landform: { basinStrength: 0.24, macroAmplitude: 0.13, macroFrequency: 0.052, ridgeStrength: 0.3 },
    material: { macroTintStrength: 0.17, shoreWetness: 0.2 },
    motion: { windAmplitude: 0.42 },
  }),
  cold: defineFamilyDefaults({
    atmosphere: { haze: 0.32, tint: "#b8c4c1" },
    ecology: { canopyCover: 0.4, clearingStrength: 0.34, clusterScale: 0.16, undergrowth: 0.24 },
    landform: { basinStrength: 0.18, macroAmplitude: 0.19, macroFrequency: 0.045, ridgeStrength: 0.48 },
    material: { macroTintStrength: 0.15, shoreWetness: 0.1 },
    motion: { windAmplitude: 0.32 },
  }),
  volcanic: defineFamilyDefaults({
    atmosphere: { haze: 0.26, tint: "#8a756d" },
    ecology: { canopyCover: 0.03, clearingStrength: 0.2, clusterScale: 0.11, undergrowth: 0.04 },
    landform: { basinStrength: 0.12, macroAmplitude: 0.25, macroFrequency: 0.04, ridgeStrength: 0.74 },
    material: { macroTintStrength: 0.24, shoreWetness: 0.06 },
    motion: { windAmplitude: 0.12 },
  }),
};

export const TERRAIN_BIOME_ART_DIRECTIONS: Readonly<Record<BiomeType, TerrainBiomeArtDirection>> = Object.freeze({
  [BiomeType.None]: art("open", {
    ecology: { canopyCover: 0, clearingStrength: 1, undergrowth: 0 },
    landform: { macroAmplitude: 0 },
    material: { macroTintStrength: 0, shoreWetness: 0 },
    motion: { windAmplitude: 0 },
  }),
  [BiomeType.DeepOcean]: art("marine", { landform: { basinStrength: 0.8, macroAmplitude: 0.02 } }),
  [BiomeType.Ocean]: art("marine", { landform: { basinStrength: 0.58, macroAmplitude: 0.025 } }),
  [BiomeType.Beach]: art("coast", { anchor: true, ecology: { canopyCover: 0.24 } }),
  [BiomeType.Scorched]: art("volcanic", { anchor: true, ecology: { canopyCover: 0.01 } }),
  [BiomeType.Bare]: art("cold", {
    ecology: { canopyCover: 0.04, undergrowth: 0.04 },
    landform: { ridgeStrength: 0.58 },
  }),
  [BiomeType.Tundra]: art("cold", {
    ecology: { canopyCover: 0.08, undergrowth: 0.18 },
    landform: { macroAmplitude: 0.14 },
  }),
  [BiomeType.Snow]: art("cold", {
    anchor: true,
    atmosphere: { haze: 0.38 },
    ecology: { canopyCover: 0.08 },
    landform: { ridgeStrength: 0.56 },
  }),
  [BiomeType.TemperateDesert]: art("arid", {
    ecology: { canopyCover: 0.03 },
    landform: { basinStrength: 0.32, ridgeStrength: 0.3 },
  }),
  [BiomeType.Shrubland]: art("open", { ecology: { canopyCover: 0.12, clusterScale: 0.22, undergrowth: 0.46 } }),
  [BiomeType.Taiga]: art("cold", {
    ecology: { canopyCover: 0.7, clusterScale: 0.13, undergrowth: 0.42 },
    motion: { windAmplitude: 0.3 },
  }),
  [BiomeType.Grassland]: art("open", {
    anchor: true,
    ecology: { canopyCover: 0.16, clearingStrength: 0.5, undergrowth: 0.88 },
  }),
  [BiomeType.TemperateDeciduousForest]: art("temperate", {
    ecology: { canopyCover: 0.84, clusterScale: 0.12, undergrowth: 0.6 },
  }),
  [BiomeType.TemperateRainForest]: art("temperate", {
    anchor: true,
    atmosphere: { haze: 0.28 },
    ecology: { canopyCover: 0.9, clearingStrength: 0.16, clusterScale: 0.11, undergrowth: 0.76 },
  }),
  [BiomeType.SubtropicalDesert]: art("arid", {
    ecology: { canopyCover: 0.03 },
    landform: { basinStrength: 0.42, ridgeStrength: 0.22 },
  }),
  [BiomeType.TropicalSeasonalForest]: art("temperate", {
    atmosphere: { haze: 0.24, tint: "#8fa878" },
    ecology: { canopyCover: 0.74, clearingStrength: 0.22, clusterScale: 0.12, undergrowth: 0.68 },
    motion: { windAmplitude: 0.48 },
  }),
  [BiomeType.TropicalRainForest]: art("temperate", {
    atmosphere: { haze: 0.32, tint: "#6f9578" },
    ecology: { canopyCover: 0.94, clearingStrength: 0.12, clusterScale: 0.1, undergrowth: 0.84 },
    motion: { windAmplitude: 0.52 },
  }),
});

function art(family: TerrainBiomeFamily, overrides: ArtDirectionOverrides = {}): TerrainBiomeArtDirection {
  const defaults = FAMILY_DEFAULTS[family];
  return {
    anchor: overrides.anchor ?? false,
    atmosphere: { ...defaults.atmosphere, ...overrides.atmosphere },
    ecology: { ...defaults.ecology, ...overrides.ecology },
    family,
    landform: { ...defaults.landform, ...overrides.landform },
    material: { ...defaults.material, ...overrides.material },
    motion: { ...defaults.motion, ...overrides.motion },
  };
}

function defineFamilyDefaults(
  defaults: Omit<TerrainBiomeArtDirection, "anchor" | "family">,
): Omit<TerrainBiomeArtDirection, "anchor" | "family"> {
  return defaults;
}
