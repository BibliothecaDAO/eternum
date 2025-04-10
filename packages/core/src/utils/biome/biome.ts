import { BiomeType } from "@bibliothecadao/types";
import { Fixed, FixedTrait } from "./fixed-point";
import { noise as snoise } from "./simplex-noise";
import { Vec3 } from "./vec3";

const MAP_AMPLITUDE = FixedTrait.fromInt(60n);
const MOISTURE_OCTAVE = FixedTrait.fromInt(2n);
const ELEVATION_OCTAVES = [
  FixedTrait.fromInt(1n), // 1
  FixedTrait.fromRatio(1n, 4n), // 0.25
  FixedTrait.fromRatio(1n, 10n), // 0.1
];
const ELEVATION_OCTAVES_SUM = ELEVATION_OCTAVES.reduce((a, b) => a.add(b), FixedTrait.ZERO);

const LEVEL = {
  DEEP_OCEAN: FixedTrait.fromRatio(20n, 100n), // 0.2
  OCEAN: FixedTrait.fromRatio(30n, 100n), // 0.3
  SAND: FixedTrait.fromRatio(35n, 100n), // 0.35
  FOREST: FixedTrait.fromRatio(45n, 100n), // 0.45
  DESERT: FixedTrait.fromRatio(53n, 100n), // 0.53
  MOUNTAIN: FixedTrait.fromRatio(60n, 100n), // 0.6
};

export class Biome {
  static getBiome(col: number, row: number): BiomeType {
    const elevation = Biome.calculateElevation(col, row, MAP_AMPLITUDE, ELEVATION_OCTAVES, ELEVATION_OCTAVES_SUM);
    const moisture = Biome.calculateMoisture(col, row, MAP_AMPLITUDE, MOISTURE_OCTAVE);
    return Biome.determineBiome(elevation, moisture, LEVEL);
  }

  private static calculateElevation(
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

  private static calculateMoisture(col: number, row: number, mapAmplitude: Fixed, moistureOctave: Fixed): Fixed {
    const moistureX = moistureOctave.mul(FixedTrait.fromInt(BigInt(col))).div(mapAmplitude);
    const moistureZ = moistureOctave.mul(FixedTrait.fromInt(BigInt(row))).div(mapAmplitude);
    const noise = snoise(Vec3.new(moistureX, FixedTrait.ZERO, moistureZ))
      .add(FixedTrait.ONE)
      .mul(FixedTrait.fromInt(100n))
      .div(FixedTrait.fromInt(2n));
    return FixedTrait.floor(noise).div(FixedTrait.fromInt(100n));
  }

  private static determineBiome(elevation: Fixed, moisture: Fixed, level: typeof LEVEL): BiomeType {
    if (elevation.value < level.DEEP_OCEAN.value) return BiomeType.DeepOcean;
    if (elevation.value < level.OCEAN.value) return BiomeType.Ocean;
    if (elevation.value < level.SAND.value) return BiomeType.Beach;

    if (elevation.value > level.MOUNTAIN.value) {
      if (moisture.value < FixedTrait.fromRatio(35n, 100n).value) return BiomeType.Scorched;
      if (moisture.value < FixedTrait.fromRatio(45n, 100n).value) return BiomeType.Bare;
      if (moisture.value < FixedTrait.fromRatio(60n, 100n).value) return BiomeType.Tundra;
      return BiomeType.Snow;
    }
    if (elevation.value > level.DESERT.value) {
      if (moisture.value < FixedTrait.fromRatio(40n, 100n).value) return BiomeType.TemperateDesert;
      if (moisture.value < FixedTrait.fromRatio(60n, 100n).value) return BiomeType.Shrubland;
      return BiomeType.Taiga;
    }
    if (elevation.value > level.FOREST.value) {
      if (moisture.value < FixedTrait.fromRatio(30n, 100n).value) return BiomeType.TemperateDesert;
      if (moisture.value < FixedTrait.fromRatio(45n, 100n).value) return BiomeType.Grassland;
      if (moisture.value < FixedTrait.fromRatio(60n, 100n).value) return BiomeType.TemperateDeciduousForest;
      return BiomeType.TemperateRainForest;
    }
    if (moisture.value < FixedTrait.fromRatio(40n, 100n).value) return BiomeType.SubtropicalDesert;
    if (moisture.value < FixedTrait.fromRatio(45n, 100n).value) return BiomeType.Grassland;
    if (moisture.value < FixedTrait.fromRatio(62n, 100n).value) return BiomeType.TropicalSeasonalForest;
    return BiomeType.TropicalRainForest;
  }
}

// Test biome generation
// export function testBiomeGeneration() {
//   console.log("[");
//   const start = 7785456456650;
//   const end = start + 50000;
//   let i = start;

//   while (true) {
//     if (i > end) {
//       break;
//     }
//     const x = i - 5;
//     const z = i + 10;
//     const biome = Biome.getBiome(x, z);

//     // Print JSON object with comma for all entries except the last one
//     if (i !== end) {
//       console.log(`  { "x": "${x}", "z": "${z}", "biome": "${biome}" },`);
//     } else {
//       console.log(`  { "x": "${x}", "z": "${z}", "biome": "${biome}" }`);
//     }

//     i += 1;
//   }

//   console.log("]");
// }
// testBiomeGeneration();
