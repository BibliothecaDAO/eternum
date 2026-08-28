import { BiomeType } from "@bibliothecadao/types";

export type TerrainBiomeFamily = "arid" | "coast" | "cold" | "marine" | "open" | "temperate" | "volcanic";

export interface TerrainBiomeArtDirection {
  anchor: boolean;
  atmosphere: {
    haze: number;
    tint: string;
  };
  ecology: {
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
  marine: artDefaults(0.03, 0.075, 0.08, 0.6, 0.04, 0.8, 0.34, 0.12, 0, 0.08, 0.3, "#9eb7bd"),
  coast: artDefaults(0.065, 0.08, 0.12, 0.36, 0.16, 1, 0.24, 0.36, 0.16, 0.28, 0.22, "#d6c294"),
  arid: artDefaults(0.14, 0.06, 0.42, 0.2, 0.2, 0.2, 0.2, 0.32, 0.12, 0.24, 0.12, "#cda26e"),
  open: artDefaults(0.1, 0.055, 0.2, 0.3, 0.16, 0.12, 0.18, 0.42, 0.72, 0.52, 0.16, "#aab68a"),
  temperate: artDefaults(0.13, 0.052, 0.3, 0.24, 0.17, 0.2, 0.13, 0.24, 0.56, 0.42, 0.22, "#819a82"),
  cold: artDefaults(0.19, 0.045, 0.48, 0.18, 0.15, 0.1, 0.16, 0.34, 0.24, 0.32, 0.32, "#b8c4c1"),
  volcanic: artDefaults(0.25, 0.04, 0.74, 0.12, 0.24, 0.06, 0.11, 0.2, 0.04, 0.12, 0.26, "#8a756d"),
};

export const TERRAIN_BIOME_ART_DIRECTIONS: Readonly<Record<BiomeType, TerrainBiomeArtDirection>> = Object.freeze({
  [BiomeType.None]: art("open", {
    ecology: { clearingStrength: 1, undergrowth: 0 },
    landform: { macroAmplitude: 0 },
    material: { macroTintStrength: 0, shoreWetness: 0 },
    motion: { windAmplitude: 0 },
  }),
  [BiomeType.DeepOcean]: art("marine", { landform: { basinStrength: 0.8, macroAmplitude: 0.02 } }),
  [BiomeType.Ocean]: art("marine", { landform: { basinStrength: 0.58, macroAmplitude: 0.025 } }),
  [BiomeType.Beach]: art("coast", { anchor: true }),
  [BiomeType.Scorched]: art("volcanic", { anchor: true }),
  [BiomeType.Bare]: art("cold", { ecology: { undergrowth: 0.04 }, landform: { ridgeStrength: 0.58 } }),
  [BiomeType.Tundra]: art("cold", { ecology: { undergrowth: 0.18 }, landform: { macroAmplitude: 0.14 } }),
  [BiomeType.Snow]: art("cold", { anchor: true, atmosphere: { haze: 0.38 }, landform: { ridgeStrength: 0.56 } }),
  [BiomeType.TemperateDesert]: art("arid", { landform: { basinStrength: 0.32, ridgeStrength: 0.3 } }),
  [BiomeType.Shrubland]: art("open", { ecology: { clusterScale: 0.22, undergrowth: 0.46 } }),
  [BiomeType.Taiga]: art("cold", {
    ecology: { clusterScale: 0.13, undergrowth: 0.42 },
    motion: { windAmplitude: 0.3 },
  }),
  [BiomeType.Grassland]: art("open", { anchor: true, ecology: { clearingStrength: 0.5, undergrowth: 0.88 } }),
  [BiomeType.TemperateDeciduousForest]: art("temperate", { ecology: { clusterScale: 0.12, undergrowth: 0.6 } }),
  [BiomeType.TemperateRainForest]: art("temperate", {
    anchor: true,
    atmosphere: { haze: 0.28 },
    ecology: { clearingStrength: 0.16, clusterScale: 0.11, undergrowth: 0.76 },
  }),
  [BiomeType.SubtropicalDesert]: art("arid", { landform: { basinStrength: 0.42, ridgeStrength: 0.22 } }),
  [BiomeType.TropicalSeasonalForest]: art("temperate", {
    atmosphere: { haze: 0.24, tint: "#8fa878" },
    ecology: { clearingStrength: 0.22, clusterScale: 0.12, undergrowth: 0.68 },
    motion: { windAmplitude: 0.48 },
  }),
  [BiomeType.TropicalRainForest]: art("temperate", {
    atmosphere: { haze: 0.32, tint: "#6f9578" },
    ecology: { clearingStrength: 0.12, clusterScale: 0.1, undergrowth: 0.84 },
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

function artDefaults(
  macroAmplitude: number,
  macroFrequency: number,
  ridgeStrength: number,
  basinStrength: number,
  macroTintStrength: number,
  shoreWetness: number,
  clusterScale: number,
  clearingStrength: number,
  undergrowth: number,
  windAmplitude: number,
  haze: number,
  tint: string,
): Omit<TerrainBiomeArtDirection, "anchor" | "family"> {
  return {
    atmosphere: { haze, tint },
    ecology: { clearingStrength, clusterScale, undergrowth },
    landform: { basinStrength, macroAmplitude, macroFrequency, ridgeStrength },
    material: { macroTintStrength, shoreWetness },
    motion: { windAmplitude },
  };
}
