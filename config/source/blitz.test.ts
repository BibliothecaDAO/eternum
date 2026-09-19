import { BuildingType, RealmLevels, ResourcesIds } from "@bibliothecadao/types";
import { describe, expect, test } from "bun:test";
import {
  applyBlitzBalanceProfile,
  resolveBlitzBalanceProfileIdFromDurationMinutes,
  resolveBlitzBalanceProfileIdFromDurationSeconds,
} from "./blitz";
import { getConfigFromNetwork, resolveBlitzConfigForDuration } from "../utils/utils";

function findStartingResourceAmount(
  resources: Array<{ resource: ResourcesIds; amount: number }>,
  resourceId: ResourcesIds,
): number | undefined {
  return resources.find((resource) => resource.resource === resourceId)?.amount;
}

function findCampStartingResourceAmount(
  resources: Array<{ resource: ResourcesIds; min_amount: number; max_amount: number }>,
  resourceId: ResourcesIds,
): { min_amount: number; max_amount: number } | undefined {
  return resources.find((resource) => resource.resource === resourceId);
}

function findBlitzExplorationReward(
  rewards: Array<{ rewardId: ResourcesIds; amount: number; probabilityBps: number }>,
  rewardId: ResourcesIds,
  amount: number,
) {
  return rewards.find((reward) => reward.rewardId === rewardId && reward.amount === amount);
}

describe("Blitz balance profiles", () => {
  test("resolves official profile ids from duration values", () => {
    expect(resolveBlitzBalanceProfileIdFromDurationMinutes(60)).toBe("official-60");
    expect(resolveBlitzBalanceProfileIdFromDurationMinutes(90)).toBe("official-90");
    expect(resolveBlitzBalanceProfileIdFromDurationMinutes(45)).toBeNull();

    expect(resolveBlitzBalanceProfileIdFromDurationSeconds(3_600)).toBe("official-60");
    expect(resolveBlitzBalanceProfileIdFromDurationSeconds(5_400)).toBe("official-90");
    expect(resolveBlitzBalanceProfileIdFromDurationSeconds(1_800)).toBeNull();
  });

  test("applies the official 60-minute profile across the owned config domains", () => {
    const baseConfig = getConfigFromNetwork("appchain", "blitz");
    const profiledConfig = applyBlitzBalanceProfile(baseConfig, "official-60");

    expect(profiledConfig.season.durationSeconds).toBe(3_600);
    expect(profiledConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood]).toBe(2);
    expect(profiledConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Labor]).toBe(2);
    expect(profiledConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Donkey]).toBe(3);
    expect(profiledConfig.buildings.simpleBuildingCost[BuildingType.ResourceCopper]?.[0]?.amount).toBe(540);
    expect(profiledConfig.realmUpgradeCosts[RealmLevels.Kingdom]?.[0]?.amount).toBe(720);
    expect(findStartingResourceAmount(profiledConfig.startingResources, ResourcesIds.Labor)).toBe(1_500);
    expect(findStartingResourceAmount(profiledConfig.startingResources, ResourcesIds.Knight)).toBe(3_500);
    expect(findCampStartingResourceAmount(profiledConfig.campStartingResources, ResourcesIds.Labor)).toMatchObject({
      min_amount: 5_000,
      max_amount: 5_000,
    });
    expect(profiledConfig.blitz.exploration.rewardProfileId).toBe("official-60");
    expect(findBlitzExplorationReward(profiledConfig.blitz.exploration.rewards, ResourcesIds.Essence, 150)).toEqual({
      rewardId: ResourcesIds.Essence,
      amount: 150,
      probabilityBps: 3_500,
    });
    expect(findBlitzExplorationReward(profiledConfig.blitz.exploration.rewards, ResourcesIds.Donkey, 500)).toEqual({
      rewardId: ResourcesIds.Donkey,
      amount: 500,
      probabilityBps: 500,
    });
    expect(profiledConfig.hyperstructures.hyperstructureConstructionCost).toEqual([]);
    expect(profiledConfig.exploration.relicDiscoveryIntervalSeconds).toBe(
      baseConfig.exploration.relicDiscoveryIntervalSeconds,
    );
  });

  test("keeps the base blitz config for non-official durations", () => {
    const baseConfig = getConfigFromNetwork("appchain", "blitz");
    const resolvedConfig = resolveBlitzConfigForDuration("appchain", 45);

    expect(baseConfig.troop.limit.mercenariesTroopUpperBound).toBe(1_600);
    expect(resolvedConfig.season.durationSeconds).toBe(baseConfig.season.durationSeconds);
    expect(resolvedConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood]).toBe(
      baseConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood],
    );
    expect(resolvedConfig.troop.limit.mercenariesTroopUpperBound).toBe(
      baseConfig.troop.limit.mercenariesTroopUpperBound,
    );
    expect(resolvedConfig.buildings.simpleBuildingCost[BuildingType.ResourceCopper]?.[0]?.amount).toBe(
      baseConfig.buildings.simpleBuildingCost[BuildingType.ResourceCopper]?.[0]?.amount,
    );
    expect(resolvedConfig.blitz.exploration.rewardProfileId).toBe("official-90");
    expect(resolvedConfig.blitz.exploration.rewards).toEqual(baseConfig.blitz.exploration.rewards);
  });

  test("resolves the official 90-minute blitz config from duration", () => {
    const resolvedConfig = resolveBlitzConfigForDuration("appchain", 90);

    expect(resolvedConfig.season.durationSeconds).toBe(5_400);
    expect(resolvedConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood]).toBe(1);
    expect(findStartingResourceAmount(resolvedConfig.startingResources, ResourcesIds.Knight)).toBe(1_500);
    expect(resolvedConfig.blitz.exploration.rewardProfileId).toBe("official-90");
    expect(findBlitzExplorationReward(resolvedConfig.blitz.exploration.rewards, ResourcesIds.Essence, 100)).toEqual({
      rewardId: ResourcesIds.Essence,
      amount: 100,
      probabilityBps: 3_000,
    });
    expect(findBlitzExplorationReward(resolvedConfig.blitz.exploration.rewards, ResourcesIds.Paladin, 1_000)).toEqual({
      rewardId: ResourcesIds.Paladin,
      amount: 1_000,
      probabilityBps: 200,
    });
  });
});
