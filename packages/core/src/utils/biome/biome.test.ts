import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { Biome, NEUTRAL_BIOME_CLIMATE } from "./biome";

describe("Biome climate", () => {
  it("keeps existing neutral biome generation unchanged", () => {
    expect(Biome.getBiome(0, 0, NEUTRAL_BIOME_CLIMATE)).toBe(Biome.getBiome(0, 0));
    expect(Biome.getBiome(0, 0, NEUTRAL_BIOME_CLIMATE)).toBe(BiomeType.Beach);
  });

  it("applies elevation and moisture climate before classifying the biome", () => {
    expect(
      Biome.getBiome(0, 0, {
        elevation_scale_bps: 10_000,
        moisture_scale_bps: 10_000,
        elevation_bias_bps: 20_000,
        moisture_bias_bps: 20_000,
      }),
    ).toBe(BiomeType.Snow);

    expect(
      Biome.getBiome(0, 0, {
        elevation_scale_bps: 10_000,
        moisture_scale_bps: 10_000,
        elevation_bias_bps: 1,
        moisture_bias_bps: 1,
      }),
    ).toBe(BiomeType.DeepOcean);
  });

  it("treats zero climate values as neutral for unset config safety", () => {
    expect(
      Biome.getBiome(0, 0, {
        elevation_scale_bps: 0,
        moisture_scale_bps: 0,
        elevation_bias_bps: 0,
        moisture_bias_bps: 0,
      }),
    ).toBe(BiomeType.Beach);
  });

  it("uses biome seeds to produce a different deterministic map", () => {
    const sampleCoordinates = [
      [0, 0],
      [4, 2],
      [8, 8],
      [12, 5],
      [18, 21],
    ] as const;

    const neutralBiomes = sampleCoordinates.map(([col, row]) => Biome.getBiome(col, row, NEUTRAL_BIOME_CLIMATE));
    const seededBiomes = sampleCoordinates.map(([col, row]) =>
      Biome.getBiome(col, row, {
        ...NEUTRAL_BIOME_CLIMATE,
        elevation_seed: 137,
        moisture_seed: 991,
      }),
    );

    expect(seededBiomes).not.toEqual(neutralBiomes);
    expect(seededBiomes).toEqual(
      sampleCoordinates.map(([col, row]) =>
        Biome.getBiome(col, row, {
          ...NEUTRAL_BIOME_CLIMATE,
          elevation_seed: 137,
          moisture_seed: 991,
        }),
      ),
    );
  });

  it("exposes the exact classified environment without changing getBiome", () => {
    const fixtures = [
      {
        col: 0,
        row: 0,
        climate: NEUTRAL_BIOME_CLIMATE,
        expected: { biome: BiomeType.Beach, elevation: 0.28, moisture: 0.28 },
      },
      {
        col: 1128,
        row: 389,
        climate: NEUTRAL_BIOME_CLIMATE,
        expected: { biome: BiomeType.DeepOcean, elevation: 0.1683116883116883, moisture: 0.28 },
      },
      {
        col: 2_147_483_648,
        row: 2_147_483_648,
        climate: NEUTRAL_BIOME_CLIMATE,
        expected: { biome: BiomeType.Tundra, elevation: 0.7676623376623377, moisture: 0.58 },
      },
      {
        col: 0,
        row: 0,
        climate: { ...NEUTRAL_BIOME_CLIMATE, elevation_seed: 137, moisture_seed: 991 },
        expected: { biome: BiomeType.Tundra, elevation: 0.6131168831168832, moisture: 0.45 },
      },
      {
        col: -13,
        row: 27,
        climate: { ...NEUTRAL_BIOME_CLIMATE, elevation_seed: 137, moisture_seed: 991 },
        expected: { biome: BiomeType.Bare, elevation: 0.7867532467532468, moisture: 0.43 },
      },
    ];

    for (const fixture of fixtures) {
      const sample = Biome.sampleEnvironment(fixture.col, fixture.row, fixture.climate);
      expect(sample).toEqual(fixture.expected);
      expect(Biome.getBiome(fixture.col, fixture.row, fixture.climate)).toBe(sample.biome);
    }
  });
});
