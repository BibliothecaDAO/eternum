import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { TERRAIN_BIOME_ART_DIRECTIONS } from "./terrain-biome-art-direction";

describe("terrain biome art direction", () => {
  it("defines bounded runtime controls for every biome", () => {
    Object.values(BiomeType).forEach((biome) => {
      const profile = TERRAIN_BIOME_ART_DIRECTIONS[biome];
      expect(profile).toBeDefined();
      expect(Object.values(profile.landform).every((value) => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(
        true,
      );
      expect(Object.values(profile.material).every((value) => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(
        true,
      );
      expect(Object.values(profile.ecology).every((value) => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(
        true,
      );
      expect(profile.motion.windAmplitude).toBeGreaterThanOrEqual(0);
      expect(profile.motion.windAmplitude).toBeLessThanOrEqual(1);
      expect(profile.atmosphere.haze).toBeGreaterThanOrEqual(0);
      expect(profile.atmosphere.haze).toBeLessThanOrEqual(1);
      expect(profile.atmosphere.tint).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it("names five anchor biomes that span the art-direction families", () => {
    const anchors = Object.entries(TERRAIN_BIOME_ART_DIRECTIONS).filter(([, profile]) => profile.anchor);

    expect(anchors.map(([biome]) => biome)).toEqual(
      expect.arrayContaining([
        BiomeType.Beach,
        BiomeType.Scorched,
        BiomeType.Snow,
        BiomeType.Grassland,
        BiomeType.TemperateRainForest,
      ]),
    );
    expect(anchors).toHaveLength(5);
  });

  it("distinguishes closed-canopy forests from open and marine ground", () => {
    expect(TERRAIN_BIOME_ART_DIRECTIONS[BiomeType.TropicalRainForest].ecology.canopyCover).toBeGreaterThan(0.8);
    expect(TERRAIN_BIOME_ART_DIRECTIONS[BiomeType.Grassland].ecology.canopyCover).toBeLessThan(0.25);
    expect(TERRAIN_BIOME_ART_DIRECTIONS[BiomeType.Ocean].ecology.canopyCover).toBe(0);
  });
});
