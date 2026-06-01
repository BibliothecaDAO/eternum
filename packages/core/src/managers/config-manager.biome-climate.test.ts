import { BiomeType } from "@bibliothecadao/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Biome } from "../utils/biome";
import { configManager } from "./config-manager";

describe("ClientConfigManager biome climate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses configured biome climate when predicting undiscovered terrain", () => {
    vi.spyOn(configManager, "getBiomeClimateConfig").mockReturnValue({
      elevation_scale_bps: 10_000,
      moisture_scale_bps: 10_000,
      elevation_bias_bps: 20_000,
      moisture_bias_bps: 20_000,
    });

    expect(configManager.getBiome(0, 0)).toBe(BiomeType.Snow);
  });

  it("falls back to neutral climate when config has not loaded", () => {
    vi.spyOn(configManager, "getBiomeClimateConfig").mockReturnValue(undefined);

    expect(configManager.getBiome(0, 0)).toBe(Biome.getBiome(0, 0));
  });

  it("treats zero climate values from config as neutral", () => {
    vi.spyOn(configManager, "getBiomeClimateConfig").mockReturnValue({
      elevation_scale_bps: 0,
      moisture_scale_bps: 0,
      elevation_bias_bps: 0,
      moisture_bias_bps: 0,
    });

    expect(configManager.getBiome(0, 0)).toBe(Biome.getBiome(0, 0));
  });
});
