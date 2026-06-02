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
});
