import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import {
  applyTerrainGroundSlope,
  applyTerrainGroundStructurePad,
  resolveTerrainGroundEcology,
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

  it("resolves mature moss, regenerating cover, and wet ground through the existing surface catalog", () => {
    const forest = resolveTerrainGroundRecipe(BiomeType.TemperateDeciduousForest, {
      elevation: 0.45,
      moisture: 0.7,
    });
    const clearing = resolveTerrainGroundEcology(forest, {
      allowsVegetation: true,
      moisture: 0.45,
      shore: 0,
      vegetation: vegetation({ canopyCover: 0.08, gapStrength: 0.8, successionStrength: 0.7 }),
    });
    const mature = resolveTerrainGroundEcology(forest, {
      allowsVegetation: true,
      moisture: 0.9,
      shore: 0,
      vegetation: vegetation({ canopyCover: 0.92, debrisCover: 0.48, maturity: 0.9 }),
    });
    const wetShore = resolveTerrainGroundEcology(
      resolveTerrainGroundRecipe(BiomeType.Grassland, { elevation: 0.35, moisture: 0.9 }),
      {
        allowsVegetation: true,
        moisture: 0.95,
        shore: 0.9,
        vegetation: vegetation({ edgeStrength: 0.7, successionStrength: 0.65, understoryCover: 0.8 }),
      },
    );

    expect(mature.weights[3]).toBeLessThan(clearing.weights[3]);
    expect(mature.weights[4]).toBeGreaterThan(clearing.weights[4]);
    expect(mature.tint[1]).toBeGreaterThan(mature.tint[0]);
    expect(wetShore.weights[2]).toBeGreaterThan(0.2);
    expect(wetShore.roughnessOffset).toBeLessThan(0);
    expect(mature.weights.reduce((total, weight) => total + weight, 0)).toBeCloseTo(1, 12);

    expect(
      resolveTerrainGroundEcology(forest, {
        allowsVegetation: false,
        moisture: 0.9,
        shore: 0.9,
        vegetation: vegetation({ canopyCover: 1, maturity: 1 }),
      }),
    ).toEqual({ roughnessOffset: 0, tint: [1, 1, 1], weights: forest });
    expect(applyTerrainGroundStructurePad(mature.weights, 1)[4]).toBe(0);
  });
});

function vegetation(overrides: Partial<Parameters<typeof resolveTerrainGroundEcology>[1]["vegetation"]> = {}) {
  return {
    canopyCover: 0.5,
    debrisCover: 0.2,
    edgeStrength: 0.2,
    gapStrength: 0.2,
    maturity: 0.4,
    successionStrength: 0.3,
    understoryCover: 0.5,
    ...overrides,
  };
}
