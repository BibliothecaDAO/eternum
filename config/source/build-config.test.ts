import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, test } from "bun:test";
import { buildConfig } from "./build-config";

function findStartingResourceAmount(
  resources: Array<{ resource: ResourcesIds; amount: number }>,
  resourceId: ResourcesIds,
): number | undefined {
  return resources.find((resource) => resource.resource === resourceId)?.amount;
}

function findRecipeAmount(
  resources: Array<{ resource: ResourcesIds; amount: number }>,
  resourceId: ResourcesIds,
): number | undefined {
  return resources.find((resource) => resource.resource === resourceId)?.amount;
}

describe("buildConfig", () => {
  test("resolves the expected chain overlays for Blitz and Eternum", async () => {
    const slotBlitz = await buildConfig({ chain: "slot", gameType: "blitz" });
    const slotEternum = await buildConfig({ chain: "slot", gameType: "eternum" });
    const localBlitz = await buildConfig({ chain: "local", gameType: "blitz" });

    expect(slotBlitz.setup.chain).toBe("slot");
    expect(slotBlitz.battle.regularImmunityTicks).toBe(0);
    expect(slotBlitz.season.durationSeconds).toBe(5_400);
    expect(slotBlitz.blitz.mode.on).toBe(true);
    expect(slotBlitz.hyperstructures.hyperstructureConstructionCost).toEqual([]);

    expect(slotEternum.blitz.mode.on).toBe(false);
    expect(slotEternum.season.durationSeconds).toBe(0);
    expect(slotEternum.exploration.bitcoinMineWinProbability).toBe(30);
    expect(slotEternum.exploration.campFindProbability).toBe(50);
    expect(slotEternum.resources.productionByComplexRecipeOutputs[ResourcesIds.Wheat]).toBe(6);
    expect(slotEternum.resources.productionByComplexRecipeOutputs[ResourcesIds.Fish]).toBe(6);
    expect(findStartingResourceAmount(slotEternum.startingResources, ResourcesIds.Wheat)).toBe(1_000);
    expect(findStartingResourceAmount(slotEternum.startingResources, ResourcesIds.Fish)).toBe(1_000);
    expect(
      findRecipeAmount(slotEternum.resources.productionByComplexRecipe[ResourcesIds.Wood], ResourcesIds.Wheat),
    ).toBe(1);
    expect(
      findRecipeAmount(slotEternum.resources.productionByComplexRecipe[ResourcesIds.Wood], ResourcesIds.Fish),
    ).toBe(1);
    expect(slotEternum.troop.stamina.staminaExploreWheatCost).toBe(0.03);
    expect(slotEternum.troop.stamina.staminaExploreFishCost).toBe(0.03);
    expect(slotEternum.hyperstructures.hyperstructureConstructionCost.length).toBeGreaterThan(0);
    expect(slotEternum.mmr).toBeUndefined();

    expect(localBlitz.dev.mode.on).toBe(true);
    expect(localBlitz.speed.donkey).toBe(0);
    expect(localBlitz.mmr?.enabled).toBe(true);
  });

  test("applies the official Blitz profiles only for exact official durations", async () => {
    const baseConfig = await buildConfig({ chain: "slot", gameType: "blitz" });
    const sixtyMinuteConfig = await buildConfig({ chain: "slot", gameType: "blitz", durationMinutes: 60 });
    const customDurationConfig = await buildConfig({ chain: "slot", gameType: "blitz", durationMinutes: 45 });

    expect(sixtyMinuteConfig.season.durationSeconds).toBe(3_600);
    expect(sixtyMinuteConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood]).toBe(2);
    expect(sixtyMinuteConfig.buildings.simpleBuildingCost[BuildingType.ResourceCopper]?.[0]?.amount).toBe(540);

    expect(customDurationConfig.season.durationSeconds).toBe(baseConfig.season.durationSeconds);
    expect(customDurationConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood]).toBe(
      baseConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood],
    );
  });
});
