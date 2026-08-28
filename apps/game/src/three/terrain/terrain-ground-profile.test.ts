import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import {
  applyTerrainGroundSlope,
  applyTerrainGroundStructurePad,
  resolveTerrainGroundRecipe,
  TERRAIN_GROUND_SURFACE_IDS,
} from "./terrain-ground-profile";

describe("terrain ground profiles", () => {
  it("defines finite normalized recipes for every gameplay biome", () => {
    Object.values(BiomeType).forEach((biome) => {
      const recipe = resolveTerrainGroundRecipe(biome, { elevation: 0.5, moisture: 0.5 });
      expect(recipe).toHaveLength(TERRAIN_GROUND_SURFACE_IDS.length);
      expect(recipe.every((weight) => Number.isFinite(weight) && weight >= 0 && weight <= 1)).toBe(true);
      expect(recipe.reduce((total, weight) => total + weight, 0)).toBeCloseTo(1, 12);
    });
  });

  it("responds continuously to moisture without changing the surface catalog", () => {
    const dry = resolveTerrainGroundRecipe(BiomeType.Grassland, { elevation: 0.45, moisture: 0.1 });
    const wet = resolveTerrainGroundRecipe(BiomeType.Grassland, { elevation: 0.45, moisture: 0.9 });

    expect(wet[3]).toBeGreaterThan(dry[3]);
    expect(wet).toHaveLength(dry.length);
  });

  it("exposes stone on steep ground and calms fragile cover on structure pads", () => {
    const forest = resolveTerrainGroundRecipe(BiomeType.TemperateRainForest, { elevation: 0.48, moisture: 0.8 });
    const steep = applyTerrainGroundSlope(forest, 0.8);
    const pad = applyTerrainGroundStructurePad(forest, 1);

    expect(steep[5]).toBeGreaterThan(forest[5]);
    expect(steep[4]).toBeLessThan(forest[4]);
    expect(pad[2]).toBeGreaterThan(forest[2]);
    expect(pad[4]).toBe(0);
    expect(pad.reduce((total, weight) => total + weight, 0)).toBeCloseTo(1, 12);
  });
});
