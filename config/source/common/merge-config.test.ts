import { BuildingType } from "@bibliothecadao/types";
import { describe, expect, test } from "bun:test";
import { blitzBaseConfig } from "../blitz/base";
import { mergeConfigPatches } from "./merge-config";

describe("mergeConfigPatches", () => {
  test("preserves numeric building cost maps when merging unrelated patches", () => {
    const mergedConfig = mergeConfigPatches(blitzBaseConfig, {
      season: {
        durationSeconds: 1,
      },
    });
    const mergedGoldComplexCost = mergedConfig.buildings?.complexBuildingCosts?.[BuildingType.ResourceGold];
    const mergedDeepCrystalComplexCost =
      mergedConfig.buildings?.complexBuildingCosts?.[BuildingType.ResourceDeepCrystal];
    const mergedAdamantineSimpleCost = mergedConfig.buildings?.simpleBuildingCost?.[BuildingType.ResourceAdamantine];

    expect(mergedGoldComplexCost).toEqual(blitzBaseConfig.buildings?.complexBuildingCosts?.[BuildingType.ResourceGold]);
    expect(mergedGoldComplexCost).not.toBe(mergedConfig.buildings?.complexBuildingCosts);
    expect(mergedDeepCrystalComplexCost).toEqual(
      blitzBaseConfig.buildings?.complexBuildingCosts?.[BuildingType.ResourceDeepCrystal],
    );
    expect(mergedAdamantineSimpleCost).toEqual(
      blitzBaseConfig.buildings?.simpleBuildingCost?.[BuildingType.ResourceAdamantine],
    );
    expect(mergedAdamantineSimpleCost).not.toBe(mergedConfig.buildings?.simpleBuildingCost);
  });
});
