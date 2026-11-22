import { BiomeType } from "@bibliothecadao/types/terrain";
import { Fixed, FixedTrait } from "./fixed-point";
import { noise as snoise } from "./simplex-noise";
import { noiseFloat } from "./simplex-noise-float";
import { Vec3 } from "./vec3";

const MAP_AMPLITUDE = FixedTrait.fromInt(24n);
const MOISTURE_OCTAVE = FixedTrait.fromInt(5n);
const ELEVATION_OCTAVES = [
  FixedTrait.fromInt(1n), // 1
  FixedTrait.fromRatio(1n, 5n), // 0.2
  FixedTrait.fromRatio(1n, 12n), // 0.083333... (1/12)
];
const ELEVATION_OCTAVES_SUM = ELEVATION_OCTAVES.reduce((a, b) => a.add(b), FixedTrait.ZERO);

const LEVEL = {
  DEEP_OCEAN: FixedTrait.fromRatio(17n, 100n), // 0.17
  OCEAN: FixedTrait.fromRatio(26n, 100n), // 0.26
  SAND: FixedTrait.fromRatio(31n, 100n), // 0.31
  FOREST: FixedTrait.fromRatio(42n, 100n), // 0.42
  DESERT: FixedTrait.fromRatio(50n, 100n), // 0.5
  MOUNTAIN: FixedTrait.fromRatio(56n, 100n), // 0.56
};

export interface BiomeClimateConfig {
  elevation_scale_bps: number;
  moisture_scale_bps: number;
  elevation_bias_bps: number;
  moisture_bias_bps: number;
  elevation_seed?: number;
  moisture_seed?: number;
}

export interface BiomeEnvironmentSample {
  biome: BiomeType;
  elevation: number;
  moisture: number;
}

export interface BiomeClimateField {
  elevation: number;
  moisture: number;
  landform: number;
}

export const NEUTRAL_BIOME_CLIMATE: BiomeClimateConfig = {
  elevation_scale_bps: 10_000,
  moisture_scale_bps: 10_000,
  elevation_bias_bps: 10_000,
  moisture_bias_bps: 10_000,
  elevation_seed: 0,
  moisture_seed: 0,
};

const CLIMATE_BPS_DENOMINATOR = 10_000n;

const fixedToNumber = (value: Fixed): number => Number(value.value) / Number(FixedTrait.ONE_64x64);
const FIELD = {
  amplitude: fixedToNumber(MAP_AMPLITUDE),
  moistureOctave: fixedToNumber(MOISTURE_OCTAVE),
  octaves: ELEVATION_OCTAVES.map(fixedToNumber),
  octaveSum: fixedToNumber(ELEVATION_OCTAVES_SUM),
};

export const BIOME_ELEVATION_LEVELS = {
  deepOcean: fixedToNumber(LEVEL.DEEP_OCEAN),
  ocean: fixedToNumber(LEVEL.OCEAN),
  sand: fixedToNumber(LEVEL.SAND),
  forest: fixedToNumber(LEVEL.FOREST),
  desert: fixedToNumber(LEVEL.DESERT),
  mountain: fixedToNumber(LEVEL.MOUNTAIN),
};

export class Biome {
  static getBiome(col: number, row: number, climate: BiomeClimateConfig = NEUTRAL_BIOME_CLIMATE): BiomeType {
    return Biome.sampleEnvironment(col, row, climate).biome;
  }

  static sampleEnvironment(
    col: number,
    row: number,
    climate: BiomeClimateConfig = NEUTRAL_BIOME_CLIMATE,
  ): BiomeEnvironmentSample {
    const elevation = Biome.applyClimateAdjustment(
      Biome.calculateElevation(
        col,
        row,
        MAP_AMPLITUDE,
        ELEVATION_OCTAVES,
        ELEVATION_OCTAVES_SUM,
        Biome.resolveClimateSeed(climate.elevation_seed),
      ),
      climate.elevation_scale_bps,
      climate.elevation_bias_bps,
    );
    const moisture = Biome.applyClimateAdjustment(
      Biome.calculateMoisture(
        col,
        row,
        MAP_AMPLITUDE,
        MOISTURE_OCTAVE,
        Biome.resolveClimateSeed(climate.moisture_seed),
      ),
      climate.moisture_scale_bps,
      climate.moisture_bias_bps,
    );
    return {
      biome: Biome.determineBiome(elevation, moisture, LEVEL),
      elevation: Biome.toNormalizedNumber(elevation),
      moisture: Biome.toNormalizedNumber(moisture),
    };
  }

  static sampleField(col: number, row: number, climate: BiomeClimateConfig = NEUTRAL_BIOME_CLIMATE): BiomeClimateField {
    const elevationSeed = Biome.resolveClimateSeed(climate.elevation_seed);
    const moistureSeed = Biome.resolveClimateSeed(climate.moisture_seed);
    const elevationAt = (octave: number) =>
      (noiseFloat(
        (col + elevationSeed) / octave / FIELD.amplitude,
        0,
        (row + elevationSeed) / octave / FIELD.amplitude,
      ) +
        1) /
      2;
    let elevation = 0;
    for (const octave of FIELD.octaves) elevation += octave * elevationAt(octave);
    const moisture =
      (noiseFloat(
        (FIELD.moistureOctave * (col + moistureSeed)) / FIELD.amplitude,
        0,
        (FIELD.moistureOctave * (row + moistureSeed)) / FIELD.amplitude,
      ) +
        1) /
      2;
    return {
      elevation: Biome.applyClimateFloat(
        elevation / FIELD.octaveSum,
        climate.elevation_scale_bps,
        climate.elevation_bias_bps,
      ),
      moisture: Biome.applyClimateFloat(moisture, climate.moisture_scale_bps, climate.moisture_bias_bps),
      landform: elevationAt(FIELD.octaves[0]),
    };
  }

  private static applyClimateFloat(value: number, scaleBps: number, biasBps: number): number {
    const denominator = Number(CLIMATE_BPS_DENOMINATOR);
    const scale = Biome.resolveClimateBps(scaleBps) / denominator;
    const bias = (Biome.resolveClimateBps(biasBps) - denominator) / denominator;
    return Math.min(1, Math.max(0, value * scale + bias));
  }

  private static toNormalizedNumber(value: Fixed): number {
    return fixedToNumber(value);
  }

  private static applyClimateAdjustment(value: Fixed, scaleBps: number, biasBps: number): Fixed {
    const scale = Biome.resolveClimateBps(scaleBps);
    const bias = Biome.resolveClimateBps(biasBps);
    const adjustedValue = value
      .mul(FixedTrait.fromRatio(BigInt(scale), CLIMATE_BPS_DENOMINATOR))
      .add(FixedTrait.fromRatio(BigInt(bias) - CLIMATE_BPS_DENOMINATOR, CLIMATE_BPS_DENOMINATOR));

    return Biome.clampClimateValue(adjustedValue);
  }

  private static resolveClimateBps(value: number): number {
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : Number(CLIMATE_BPS_DENOMINATOR);
  }

  private static resolveClimateSeed(value: number | undefined): number {
    return Number.isFinite(value) && value! > 0 ? Math.trunc(value!) : 0;
  }

  private static clampClimateValue(value: Fixed): Fixed {
    if (value.value < FixedTrait.ZERO.value) return FixedTrait.ZERO;
    if (value.value > FixedTrait.ONE.value) return FixedTrait.ONE;
    return value;
  }

  private static calculateElevation(
    col: number,
    row: number,
    mapAmplitude: Fixed,
    octaves: Fixed[],
    octavesSum: Fixed,
    seed: number,
  ): Fixed {
    let elevation = FixedTrait.ZERO;
    let _100 = FixedTrait.fromInt(100n);
    let _2 = FixedTrait.fromInt(2n);
    for (const octave of octaves) {
      let x = FixedTrait.fromInt(BigInt(col + seed))
        .div(octave)
        .div(mapAmplitude);
      let z = FixedTrait.fromInt(BigInt(row + seed))
        .div(octave)
        .div(mapAmplitude);

      let sn = snoise(Vec3.new(x, FixedTrait.ZERO, z));
      const noise = sn.add(FixedTrait.ONE).mul(_100).div(_2);
      elevation = elevation.add(octave.mul(noise.floor()));
    }

    return elevation.div(octavesSum).div(FixedTrait.fromInt(100n));
  }

  private static calculateMoisture(
    col: number,
    row: number,
    mapAmplitude: Fixed,
    moistureOctave: Fixed,
    seed: number,
  ): Fixed {
    const moistureX = moistureOctave.mul(FixedTrait.fromInt(BigInt(col + seed))).div(mapAmplitude);
    const moistureZ = moistureOctave.mul(FixedTrait.fromInt(BigInt(row + seed))).div(mapAmplitude);
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
