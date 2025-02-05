import { Fixed, FixedTrait } from "@/utils/biome/fixed-point";
import { noise as snoise } from "@/utils/biome/simplex-noise";
import { Vec3 } from "@/utils/biome/vec3";
import * as THREE from "three";

const MAP_AMPLITUDE = FixedTrait.fromInt(60n);
const MOISTURE_OCTAVE = FixedTrait.fromInt(2n);
const ELEVATION_OCTAVES = [
  FixedTrait.fromInt(1n), // 1
  FixedTrait.fromRatio(1n, 4n), // 0.25
  FixedTrait.fromRatio(1n, 10n), // 0.1
];
const ELEVATION_OCTAVES_SUM = ELEVATION_OCTAVES.reduce((a, b) => a.add(b), FixedTrait.ZERO);

export enum BiomeType {
  DeepOcean = "DeepOcean",
  Ocean = "Ocean",
  Beach = "Beach",
  Scorched = "Scorched",
  Bare = "Bare",
  Tundra = "Tundra",
  Snow = "Snow",
  TemperateDesert = "TemperateDesert",
  Shrubland = "Shrubland",
  Taiga = "Taiga",
  Grassland = "Grassland",
  TemperateDeciduousForest = "TemperateDeciduousForest",
  TemperateRainForest = "TemperateRainForest",
  SubtropicalDesert = "SubtropicalDesert",
  TropicalSeasonalForest = "TropicalSeasonalForest",
  TropicalRainForest = "TropicalRainForest",
}

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
  DEEP_OCEAN: FixedTrait.fromRatio(25n, 100n), // 0.25
  OCEAN: FixedTrait.fromRatio(50n, 100n), // 0.5
  SAND: FixedTrait.fromRatio(53n, 100n), // 0.53
  FOREST: FixedTrait.fromRatio(60n, 100n), // 0.6
  DESERT: FixedTrait.fromRatio(72n, 100n), // 0.72
  MOUNTAIN: FixedTrait.fromRatio(80n, 100n), // 0.8
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
    mapAmplitude: Fixed,
    octaves: Fixed[],
    octavesSum: Fixed,
  ): Fixed {
    let elevation = FixedTrait.ZERO;
    let _100 = FixedTrait.fromInt(100n);
    let _2 = FixedTrait.fromInt(2n);
    for (const octave of octaves) {
      let x = FixedTrait.fromInt(BigInt(col)).div(octave).div(mapAmplitude);
      let z = FixedTrait.fromInt(BigInt(row)).div(octave).div(mapAmplitude);

      let sn = snoise(Vec3.new(x, FixedTrait.ZERO, z));
      const noise = sn.add(FixedTrait.ONE).mul(_100).div(_2);
      elevation = elevation.add(octave.mul(noise.floor()));
    }

    return elevation.div(octavesSum).div(FixedTrait.fromInt(100n));
  }

  private calculateMoisture(col: number, row: number, mapAmplitude: Fixed, moistureOctave: Fixed): Fixed {
    const moistureX = moistureOctave.mul(FixedTrait.fromInt(BigInt(col))).div(mapAmplitude);
    const moistureZ = moistureOctave.mul(FixedTrait.fromInt(BigInt(row))).div(mapAmplitude);
    const noise = snoise(Vec3.new(moistureX, FixedTrait.ZERO, moistureZ))
      .add(FixedTrait.ONE)
      .mul(FixedTrait.fromInt(100n))
      .div(FixedTrait.fromInt(2n));
    return FixedTrait.floor(noise).div(FixedTrait.fromInt(100n));
  }

  private determineBiome(elevation: Fixed, moisture: Fixed, level: typeof LEVEL): BiomeType {
    if (elevation.value < level.DEEP_OCEAN.value) return BiomeType.DeepOcean;
    if (elevation.value < level.OCEAN.value) return BiomeType.Ocean;
    if (elevation.value < level.SAND.value) return BiomeType.Beach;

    if (elevation.value > level.MOUNTAIN.value) {
      if (moisture.value < FixedTrait.fromRatio(10n, 100n).value) return BiomeType.Scorched;
      if (moisture.value < FixedTrait.fromRatio(40n, 100n).value) return BiomeType.Bare;
      if (moisture.value < FixedTrait.fromRatio(50n, 100n).value) return BiomeType.Tundra;
      return BiomeType.Snow;
    }
    if (elevation.value > level.DESERT.value) {
      if (moisture.value < FixedTrait.fromRatio(33n, 100n).value) return BiomeType.TemperateDesert;
      if (moisture.value < FixedTrait.fromRatio(66n, 100n).value) return BiomeType.Shrubland;
      return BiomeType.Taiga;
    }
    if (elevation.value > level.FOREST.value) {
      if (moisture.value < FixedTrait.fromRatio(16n, 100n).value) return BiomeType.TemperateDesert;
      if (moisture.value < FixedTrait.fromRatio(50n, 100n).value) return BiomeType.Grassland;
      if (moisture.value < FixedTrait.fromRatio(83n, 100n).value) return BiomeType.TemperateDeciduousForest;
      return BiomeType.TemperateRainForest;
    }
    if (moisture.value < FixedTrait.fromRatio(16n, 100n).value) return BiomeType.SubtropicalDesert;
    if (moisture.value < FixedTrait.fromRatio(33n, 100n).value) return BiomeType.Grassland;
    if (moisture.value < FixedTrait.fromRatio(66n, 100n).value) return BiomeType.TropicalSeasonalForest;
    return BiomeType.TropicalRainForest;
  }
}

// function testBiomeGeneration() {
//   const biome = new Biome();
//   const start = 5000871265127650;
//   const end = 5000871265127678;
//   for (let i = start; i <= end; i++) {
//     const result = biome.getBiome(i - 5, i + 10);
//     console.log(`biome for ${i - 5} ${i + 10} is ${result} \n`);
//   }
// }

// testBiomeGeneration();
