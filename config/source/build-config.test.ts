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
    const appchainBlitz = await buildConfig({ chain: "appchain", gameType: "blitz" });
    const appchainEternum = await buildConfig({ chain: "appchain", gameType: "eternum" });
    const madaraBlitz = await buildConfig({ chain: "madara", gameType: "blitz" });

    expect(appchainBlitz.setup?.chain).toBe("appchain");
    expect(appchainBlitz.battle.regularImmunityTicks).toBe(0);
    expect(appchainBlitz.season.durationSeconds).toBe(3_600);
    expect(appchainBlitz.blitz.mode.on).toBe(true);
    expect(appchainBlitz.blitz.exploration.rewardProfileId).toBe("official-90");
    expect(appchainBlitz.blitz.exploration.rewards).toHaveLength(9);
    expect(appchainBlitz.hyperstructures.hyperstructureConstructionCost).toEqual([]);
    expect((appchainBlitz.setup?.manifest as { world: { seed: string } }).world.seed).toBe("s2_blitz_1");

    expect(appchainEternum.blitz.mode.on).toBe(false);
    expect((appchainEternum.setup?.manifest as { world: { seed: string } }).world.seed).toBe("s2_eternum_1");
    expect(appchainEternum.season.durationSeconds).toBe(60 * 60 * 24 * 30);
    expect(appchainEternum.exploration.bitcoinMineWinProbability).toBe(200);
    expect(appchainEternum.exploration.campFindProbability).toBe(1_500);
    expect(appchainEternum.resources.productionByComplexRecipeOutputs[ResourcesIds.Wheat]).toBe(6);
    expect(appchainEternum.resources.productionByComplexRecipeOutputs[ResourcesIds.Fish]).toBe(6);
    expect(findStartingResourceAmount(appchainEternum.startingResources, ResourcesIds.Wheat)).toBe(1_000);
    expect(findStartingResourceAmount(appchainEternum.startingResources, ResourcesIds.Fish)).toBe(1_000);
    expect(
      findRecipeAmount(appchainEternum.resources.productionByComplexRecipe[ResourcesIds.Wood], ResourcesIds.Wheat),
    ).toBe(1);
    expect(
      findRecipeAmount(appchainEternum.resources.productionByComplexRecipe[ResourcesIds.Wood], ResourcesIds.Fish),
    ).toBe(1);
    for (const resourceId of REALM_RESOURCE_IDS_WITH_ERECTION_COSTS) {
      const buildingType = getBuildingFromResource(resourceId);

      expect(buildingType).toBeDefined();
      expect(appchainEternum.buildings.complexBuildingCosts[buildingType as BuildingType]?.length ?? 0).toBeGreaterThan(
        0,
      );
      expect(appchainEternum.buildings.simpleBuildingCost[buildingType as BuildingType]?.length ?? 0).toBeGreaterThan(
        0,
      );
    }
    expect(appchainEternum.buildings.complexBuildingCosts[BuildingType.ResourceSilver]).toEqual(
      appchainEternum.buildings.complexBuildingCosts[BuildingType.ResourceGold],
    );
    expect(appchainEternum.buildings.simpleBuildingCost[BuildingType.ResourceSilver]).toEqual(
      appchainEternum.buildings.simpleBuildingCost[BuildingType.ResourceGold],
    );
    expect(appchainEternum.troop.stamina.staminaExploreWheatCost).toBe(0.03);
    expect(appchainEternum.troop.stamina.staminaExploreFishCost).toBe(0.03);
    expect(appchainEternum.hyperstructures.hyperstructureConstructionCost.length).toBeGreaterThan(0);
    expect(appchainEternum.mmr).toBeUndefined();

    expect(madaraBlitz.blitz.registration.fee_amount).toBe(0n);
    expect(madaraBlitz.blitz.registration.registration_count_max).toBe(96);
    expect(madaraBlitz.blitz.registration.entry_token_class_hash).toBe("0x0");
    expect(madaraBlitz.blitz.registration.collectible_cosmetics_address).toBe("0x0");
    expect(madaraBlitz.blitz.registration.collectible_timelock_address).toBe("0x0");
    expect(madaraBlitz.blitz.registration.collectibles_lootchest_address).toBe("0x0");
    expect(madaraBlitz.blitz.registration.collectibles_elitenft_address).toBe("0x0");
    expect(madaraBlitz.agent.controller_address).toBe("0x0");
    expect(madaraBlitz.vrf.vrfProviderAddress).toBe("0x0");
  });

  test("applies the official Blitz profiles only for exact official durations", async () => {
    const baseConfig = await buildConfig({ chain: "appchain", gameType: "blitz" });
    const sixtyMinuteConfig = await buildConfig({ chain: "appchain", gameType: "blitz", durationMinutes: 60 });
    const customDurationConfig = await buildConfig({ chain: "appchain", gameType: "blitz", durationMinutes: 45 });

    expect(sixtyMinuteConfig.season.durationSeconds).toBe(3_600);
    expect(sixtyMinuteConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Donkey]).toBe(3);
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
