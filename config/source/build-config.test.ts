import { BuildingType, getBuildingFromResource, ResourcesIds } from "@bibliothecadao/types";
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

const REALM_RESOURCE_IDS_WITH_ERECTION_COSTS: ResourcesIds[] = [
  ResourcesIds.Stone,
  ResourcesIds.Coal,
  ResourcesIds.Wood,
  ResourcesIds.Copper,
  ResourcesIds.Ironwood,
  ResourcesIds.Obsidian,
  ResourcesIds.Gold,
  ResourcesIds.Silver,
  ResourcesIds.Mithral,
  ResourcesIds.AlchemicalSilver,
  ResourcesIds.ColdIron,
  ResourcesIds.DeepCrystal,
  ResourcesIds.Ruby,
  ResourcesIds.Diamonds,
  ResourcesIds.Hartwood,
  ResourcesIds.Ignium,
  ResourcesIds.TwilightQuartz,
  ResourcesIds.TrueIce,
  ResourcesIds.Adamantine,
  ResourcesIds.Sapphire,
  ResourcesIds.EtherealSilica,
  ResourcesIds.Dragonhide,
];

describe("buildConfig", () => {
  test("resolves the expected chain overlays for Blitz and Eternum", async () => {
    const slotBlitz = await buildConfig({ chain: "slot", gameType: "blitz" });
    const slotEternum = await buildConfig({ chain: "slot", gameType: "eternum" });
    const localBlitz = await buildConfig({ chain: "local", gameType: "blitz" });

    expect(slotBlitz.setup?.chain).toBe("slot");
    expect(slotBlitz.battle.regularImmunityTicks).toBe(0);
    expect(slotBlitz.season.durationSeconds).toBe(5_400);
    expect(slotBlitz.blitz.mode.on).toBe(true);
    expect(slotBlitz.blitz.exploration.rewardProfileId).toBe("official-90");
    expect(slotBlitz.blitz.exploration.rewards).toHaveLength(9);
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
    for (const resourceId of REALM_RESOURCE_IDS_WITH_ERECTION_COSTS) {
      const buildingType = getBuildingFromResource(resourceId);

      expect(buildingType).toBeDefined();
      expect(slotEternum.buildings.complexBuildingCosts[buildingType as BuildingType]?.length ?? 0).toBeGreaterThan(0);
      expect(slotEternum.buildings.simpleBuildingCost[buildingType as BuildingType]?.length ?? 0).toBeGreaterThan(0);
    }
    expect(slotEternum.buildings.complexBuildingCosts[BuildingType.ResourceSilver]).toEqual(
      slotEternum.buildings.complexBuildingCosts[BuildingType.ResourceGold],
    );
    expect(slotEternum.buildings.simpleBuildingCost[BuildingType.ResourceSilver]).toEqual(
      slotEternum.buildings.simpleBuildingCost[BuildingType.ResourceGold],
    );
    expect(slotEternum.troop.stamina.staminaExploreWheatCost).toBe(0.03);
    expect(slotEternum.troop.stamina.staminaExploreFishCost).toBe(0.03);
    expect(slotEternum.hyperstructures.hyperstructureConstructionCost.length).toBeGreaterThan(0);
    expect(slotEternum.mmr).toBeUndefined();

    expect(localBlitz.dev.mode.on).toBe(true);
    expect(localBlitz.speed.donkey_for_resources).toBe(0);
    expect(localBlitz.speed.donkey_for_troops).toBe(0);
    expect(localBlitz.mmr?.enabled).toBe(true);
  });

  test("applies the official Blitz profiles only for exact official durations", async () => {
    const baseConfig = await buildConfig({ chain: "slot", gameType: "blitz" });
    const sixtyMinuteConfig = await buildConfig({ chain: "slot", gameType: "blitz", durationMinutes: 60 });
    const customDurationConfig = await buildConfig({ chain: "slot", gameType: "blitz", durationMinutes: 45 });

    expect(sixtyMinuteConfig.season.durationSeconds).toBe(3_600);
    expect(sixtyMinuteConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Donkey]).toBe(5);
    expect(sixtyMinuteConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood]).toBe(2);
    expect(sixtyMinuteConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Labor]).toBe(2);
    expect(sixtyMinuteConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Essence]).toBe(20);
    expect(sixtyMinuteConfig.troop.stamina.staminaInitial).toBe(30);
    expect(sixtyMinuteConfig.troop.stamina.staminaGainPerTick).toBe(30);
    expect(sixtyMinuteConfig.victoryPoints.pointsForTileExploration).toBe(5_000_000n);
    expect(sixtyMinuteConfig.victoryPoints.pointsForNonHyperstructureClaimAgainstBandits).toBe(250_000_000n);
    expect(sixtyMinuteConfig.victoryPoints.pointsForRelicDiscovery).toBe(250_000_000n);
    expect(sixtyMinuteConfig.victoryPoints.pointsForHyperstructureClaimAgainstBandits).toBe(1_000_000_000n);
    expect(sixtyMinuteConfig.victoryPoints.hyperstructurePointsPerCycle).toBe(1_000_000n);
    expect(sixtyMinuteConfig.buildings.simpleBuildingCost[BuildingType.ResourceCopper]?.[0]?.amount).toBe(540);
    expect(sixtyMinuteConfig.blitz.exploration.rewardProfileId).toBe("official-60");
    expect(sixtyMinuteConfig.blitz.exploration.rewards).toHaveLength(6);

    expect(customDurationConfig.season.durationSeconds).toBe(baseConfig.season.durationSeconds);
    expect(customDurationConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood]).toBe(
      baseConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood],
    );
    expect(customDurationConfig.troop.stamina.staminaInitial).toBe(baseConfig.troop.stamina.staminaInitial);
    expect(customDurationConfig.victoryPoints.pointsForTileExploration).toBe(
      baseConfig.victoryPoints.pointsForTileExploration,
    );
    expect(customDurationConfig.blitz.exploration.rewardProfileId).toBe(baseConfig.blitz.exploration.rewardProfileId);
  });
});
