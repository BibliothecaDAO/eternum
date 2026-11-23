import { BiomeType } from "@bibliothecadao/types/terrain";

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
  material?: Partial<TerrainBiomeArtDirection["material"]>;
  motion?: Partial<TerrainBiomeArtDirection["motion"]>;
};

const FAMILY_DEFAULTS: Record<TerrainBiomeFamily, Omit<TerrainBiomeArtDirection, "anchor" | "family">> = {
  marine: defineFamilyDefaults({
    atmosphere: { haze: 0.3, tint: "#9eb7bd" },
    ecology: { canopyCover: 0, clearingStrength: 0.12, clusterScale: 0.34, undergrowth: 0 },
    material: { macroTintStrength: 0.04, shoreWetness: 0.8 },
    motion: { windAmplitude: 0.08 },
  }),
  coast: defineFamilyDefaults({
    atmosphere: { haze: 0.22, tint: "#d6c294" },
    ecology: { canopyCover: 0.2, clearingStrength: 0.36, clusterScale: 0.24, undergrowth: 0.16 },
    material: { macroTintStrength: 0.16, shoreWetness: 1 },
    motion: { windAmplitude: 0.28 },
  }),
  arid: defineFamilyDefaults({
    atmosphere: { haze: 0.12, tint: "#cda26e" },
    ecology: { canopyCover: 0.04, clearingStrength: 0.32, clusterScale: 0.2, undergrowth: 0.12 },
    material: { macroTintStrength: 0.2, shoreWetness: 0.2 },
    motion: { windAmplitude: 0.24 },
  }),
  open: defineFamilyDefaults({
    atmosphere: { haze: 0.16, tint: "#aab68a" },
    ecology: { canopyCover: 0.15, clearingStrength: 0.42, clusterScale: 0.18, undergrowth: 0.72 },
    material: { macroTintStrength: 0.16, shoreWetness: 0.12 },
    motion: { windAmplitude: 0.52 },
  }),
  temperate: defineFamilyDefaults({
    atmosphere: { haze: 0.22, tint: "#819a82" },
    ecology: { canopyCover: 0.8, clearingStrength: 0.24, clusterScale: 0.13, undergrowth: 0.56 },
    material: { macroTintStrength: 0.17, shoreWetness: 0.2 },
    motion: { windAmplitude: 0.42 },
  }),
  cold: defineFamilyDefaults({
    atmosphere: { haze: 0.32, tint: "#b8c4c1" },
    ecology: { canopyCover: 0.4, clearingStrength: 0.34, clusterScale: 0.16, undergrowth: 0.24 },
    material: { macroTintStrength: 0.15, shoreWetness: 0.1 },
    motion: { windAmplitude: 0.32 },
  }),
  volcanic: defineFamilyDefaults({
    atmosphere: { haze: 0.26, tint: "#8a756d" },
    ecology: { canopyCover: 0.03, clearingStrength: 0.2, clusterScale: 0.11, undergrowth: 0.04 },
    material: { macroTintStrength: 0.24, shoreWetness: 0.06 },
    motion: { windAmplitude: 0.12 },
  }),
};

export const TERRAIN_BIOME_ART_DIRECTIONS: Readonly<Record<BiomeType, TerrainBiomeArtDirection>> = Object.freeze({
  [BiomeType.Underground]: art("cold", { ecology: { canopyCover: 0, undergrowth: 0 }, motion: { windAmplitude: 0 } }),
  [BiomeType.None]: art("open", {
    ecology: { canopyCover: 0, clearingStrength: 1, undergrowth: 0 },
    material: { macroTintStrength: 0, shoreWetness: 0 },
    motion: { windAmplitude: 0 },
  }),
  [BiomeType.DeepOcean]: art("marine"),
  [BiomeType.Ocean]: art("marine"),
  [BiomeType.Beach]: art("coast", {
    anchor: true,
    ecology: { canopyCover: 0.24, clusterScale: 0.18, undergrowth: 0.1 },
    material: { macroTintStrength: 0.1 },
    motion: { windAmplitude: 0.4 },
  }),
  [BiomeType.Scorched]: art("volcanic", { anchor: true, ecology: { canopyCover: 0.01 } }),
  [BiomeType.Bare]: art("cold", {
    ecology: { canopyCover: 0, undergrowth: 0.02 },
    material: { macroTintStrength: 0.3 },
  }),
  [BiomeType.Tundra]: art("cold", {
    ecology: { canopyCover: 0, clusterScale: 0.26, undergrowth: 0.54 },
    material: { macroTintStrength: 0.28 },
    motion: { windAmplitude: 0.5 },
  }),
  [BiomeType.Snow]: art("cold", {
    anchor: true,
    atmosphere: { haze: 0.38 },
    ecology: { canopyCover: 0, undergrowth: 0.01 },
    material: { macroTintStrength: 0.14 },
  }),
  [BiomeType.TemperateDesert]: art("arid", {
    ecology: { canopyCover: 0, undergrowth: 0.35 },
    material: { macroTintStrength: 0.28 },
    motion: { windAmplitude: 0.38 },
  }),
  [BiomeType.Shrubland]: art("open", {
    ecology: { canopyCover: 0.03, clearingStrength: 0.5, clusterScale: 0.28, undergrowth: 0.5 },
    material: { macroTintStrength: 0.22 },
    motion: { windAmplitude: 0.65 },
  }),
  [BiomeType.Taiga]: art("cold", {
    ecology: { canopyCover: 0.82, clusterScale: 0.15, undergrowth: 0.44 },
    motion: { windAmplitude: 0.3 },
  }),
  [BiomeType.Grassland]: art("open", {
    anchor: true,
    ecology: { canopyCover: 0.06, clearingStrength: 0.6, clusterScale: 0.16, undergrowth: 0.95 },
    material: { macroTintStrength: 0.24 },
    motion: { windAmplitude: 0.8 },
  }),
  [BiomeType.TemperateDeciduousForest]: art("temperate", {
    ecology: { canopyCover: 0.84, clusterScale: 0.12, undergrowth: 0.6 },
    material: { macroTintStrength: 0.28 },
    motion: { windAmplitude: 0.58 },
  }),
  [BiomeType.TemperateRainForest]: art("temperate", {
    anchor: true,
    atmosphere: { haze: 0.28 },
    ecology: { canopyCover: 0.9, clearingStrength: 0.2, clusterScale: 0.09, undergrowth: 0.84 },
    material: { macroTintStrength: 0.26 },
    motion: { windAmplitude: 0.46 },
  }),
  [BiomeType.SubtropicalDesert]: art("arid", {
    ecology: { canopyCover: 0, undergrowth: 0.08 },
    material: { macroTintStrength: 0.2 },
  }),
  [BiomeType.TropicalSeasonalForest]: art("temperate", {
    atmosphere: { haze: 0.24, tint: "#8fa878" },
    ecology: { canopyCover: 0.64, clearingStrength: 0.34, clusterScale: 0.16, undergrowth: 0.6 },
    material: { macroTintStrength: 0.26 },
    motion: { windAmplitude: 0.48 },
  }),
  [BiomeType.TropicalRainForest]: art("temperate", {
    atmosphere: { haze: 0.32, tint: "#6f9578" },
    ecology: { canopyCover: 0.94, clearingStrength: 0.12, clusterScale: 0.1, undergrowth: 0.84 },
    material: { macroTintStrength: 0.26 },
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
    material: { ...defaults.material, ...overrides.material },
    motion: { ...defaults.motion, ...overrides.motion },
  };
}

function defineFamilyDefaults(
  defaults: Omit<TerrainBiomeArtDirection, "anchor" | "family">,
): Omit<TerrainBiomeArtDirection, "anchor" | "family"> {
  return defaults;
}
