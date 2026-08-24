import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { isTerrainWaterBiome, TERRAIN_WATER_LEVEL } from "./terrain-water";

describe("terrain water", () => {
  it("classifies only semantic water biomes at one shared sea level", () => {
    expect(isTerrainWaterBiome(BiomeType.DeepOcean)).toBe(true);
    expect(isTerrainWaterBiome(BiomeType.Ocean)).toBe(true);
    expect(isTerrainWaterBiome(BiomeType.Beach)).toBe(false);
    expect(isTerrainWaterBiome(null)).toBe(false);
    expect(TERRAIN_WATER_LEVEL).toBeLessThan(0);
    expect(TERRAIN_WATER_LEVEL).toBeGreaterThan(-0.2);
  });
});
