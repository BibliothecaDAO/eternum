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
});
