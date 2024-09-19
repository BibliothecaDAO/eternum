import { snoise } from "@dojoengine/utils";
import * as THREE from "three";

const MAP_AMPLITUDE = 60;
const MOISTURE_OCTAVE = 2;
const ELEVATION_OCTAVES = [1, 0.25, 0.1];
const ELEVATION_OCTAVES_SUM = ELEVATION_OCTAVES.reduce((a, b) => a + b, 0);

export type BiomeType =
  | "DeepOcean"
  | "Ocean"
  | "Beach"
  | "Scorched"
  | "Bare"
  | "Tundra"
  | "Snow"
  | "TemperateDesert"
  | "Shrubland"
  | "Taiga"
  | "Grassland"
  | "TemperateDeciduousForest"
  | "TemperateRainForest"
  | "SubtropicalDesert"
  | "TropicalSeasonalForest"
  | "TropicalRainForest";

export const BIOME_COLORS: Record<BiomeType, THREE.Color> = {
  DeepOcean: new THREE.Color("#4a6b63"),
  Ocean: new THREE.Color("#657d71"),
  Beach: new THREE.Color("#d7b485"),
  Scorched: new THREE.Color("#393131"),
  Bare: new THREE.Color("#d1ae7f"),
  Tundra: new THREE.Color("#cfd4d4"),
  Snow: new THREE.Color("#cfd4d4"),
  TemperateDesert: new THREE.Color("#ad6c44"),
  Shrubland: new THREE.Color("#c1aa7f"),
  Taiga: new THREE.Color("#292d23"),
  Grassland: new THREE.Color("#6f7338"),
  TemperateDeciduousForest: new THREE.Color("#6f7338"),
  TemperateRainForest: new THREE.Color("#6f573e"),
  SubtropicalDesert: new THREE.Color("#926338"),
  TropicalSeasonalForest: new THREE.Color("#897049"),
  TropicalRainForest: new THREE.Color("#8a714a"),
};

const LEVEL = {
  DEEP_OCEAN: 0.25,
  OCEAN: 0.5,
  SAND: 0.53,
  FOREST: 0.6,
  DESERT: 0.72,
  MOUNTAIN: 0.8,
};

export class Biome {
  constructor() {}

  getBiome(col: number, row: number): BiomeType {
    const elevation = this.calculateElevation(col, row, MAP_AMPLITUDE, ELEVATION_OCTAVES, ELEVATION_OCTAVES_SUM);
    const moisture = this.calculateMoisture(col, row, MAP_AMPLITUDE, MOISTURE_OCTAVE);
    return this.determineBiome(elevation, moisture, LEVEL);
  }

  private calculateElevation(
    col: number,
    row: number,
    mapAmplitude: number,
    octaves: number[],
    octavesSum: number,
  ): number {
    let elevation = 0;
    for (const octave of octaves) {
      const x = col / octave / mapAmplitude;
      const z = row / octave / mapAmplitude;
      const noise = ((snoise([x, 0, z]) + 1) * 100) / 2;
      elevation += octave * Math.floor(noise);
    }
    elevation = elevation / octavesSum;
    return elevation / 100;
  }

  private calculateMoisture(col: number, row: number, mapAmplitude: number, moistureOctave: number): number {
    const moistureX = (moistureOctave * col) / mapAmplitude;
    const moistureZ = (moistureOctave * row) / mapAmplitude;
    const noise = ((snoise([moistureX, 0, moistureZ]) + 1) * 100) / 2;
    return Math.floor(noise) / 100;
  }

  private determineBiome(elevation: number, moisture: number, level: typeof LEVEL): BiomeType {
    if (elevation < level.DEEP_OCEAN) return "DeepOcean";
    if (elevation < level.OCEAN) return "Ocean";
    if (elevation < level.SAND) return "Beach";
    if (elevation > level.MOUNTAIN) {
      if (moisture < 0.1) return "Scorched";
      if (moisture < 0.4) return "Bare";
      if (moisture < 0.5) return "Tundra";
      return "Snow";
    }
    if (elevation > level.DESERT) {
      if (moisture < 0.33) return "TemperateDesert";
      if (moisture < 0.66) return "Shrubland";
      return "Taiga";
    }
    if (elevation > level.FOREST) {
      if (moisture < 0.16) return "TemperateDesert";
      if (moisture < 0.5) return "Grassland";
      if (moisture < 0.83) return "TemperateDeciduousForest";
      return "TemperateRainForest";
    }
    if (moisture < 0.16) return "SubtropicalDesert";
    if (moisture < 0.33) return "Grassland";
    if (moisture < 0.66) return "TropicalSeasonalForest";
    return "TropicalRainForest";
  }
}
