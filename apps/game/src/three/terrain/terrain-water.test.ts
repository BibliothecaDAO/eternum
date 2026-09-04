import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import {
  isTerrainWaterBiome,
  isTerrainWaterCovered,
  resolveTerrainWaterCrossing,
  resolveTerrainWaterDepth,
  TERRAIN_MIN_RENDERED_WATER_DEPTH,
  TERRAIN_WATER_LEVEL,
} from "./terrain-water";

describe("terrain water", () => {
  it("classifies only semantic water biomes at one shared sea level", () => {
    expect(isTerrainWaterBiome(BiomeType.DeepOcean)).toBe(true);
    expect(isTerrainWaterBiome(BiomeType.Ocean)).toBe(true);
    expect(isTerrainWaterBiome(BiomeType.Beach)).toBe(false);
    expect(isTerrainWaterBiome(null)).toBe(false);
    expect(TERRAIN_WATER_LEVEL).toBeLessThan(0);
    expect(TERRAIN_WATER_LEVEL).toBeGreaterThan(-0.2);
  });

  it("derives bounded bathymetry and an exact rendered shoreline crossing", () => {
    expect(resolveTerrainWaterDepth(TERRAIN_WATER_LEVEL - 0.2)).toBeCloseTo(0.2);
    expect(resolveTerrainWaterDepth(TERRAIN_WATER_LEVEL + 0.1)).toBe(0);
    expect(isTerrainWaterCovered(TERRAIN_WATER_LEVEL - TERRAIN_MIN_RENDERED_WATER_DEPTH)).toBe(true);
    expect(isTerrainWaterCovered(TERRAIN_WATER_LEVEL)).toBe(false);

    const crossing = resolveTerrainWaterCrossing(0.12, 0);
    expect(0.12 + (0 - 0.12) * crossing).toBeCloseTo(TERRAIN_MIN_RENDERED_WATER_DEPTH);
  });

  it("rejects non-finite bed heights instead of inventing water coverage", () => {
    expect(() => resolveTerrainWaterDepth(Number.NaN)).toThrow("Terrain water requires a finite bed height");
  });
});
