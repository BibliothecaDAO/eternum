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

function findDiscoverableVillageResourceAmount(
  resources: Array<{ resource: ResourcesIds; min_amount: number; max_amount: number }>,
  resourceId: ResourcesIds,
): { min_amount: number; max_amount: number } | undefined {
  return resources.find((resource) => resource.resource === resourceId);
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
    const baseConfig = getConfigFromNetwork("slot", "blitz");
    const profiledConfig = applyBlitzBalanceProfile(baseConfig, "official-60");

    expect(profiledConfig.season.durationSeconds).toBe(3_600);
    expect(profiledConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood]).toBe(2);
    expect(profiledConfig.buildings.simpleBuildingCost[BuildingType.ResourceCopper]?.[0]?.amount).toBe(540);
    expect(profiledConfig.realmUpgradeCosts[RealmLevels.Kingdom]?.[0]?.amount).toBe(720);
    expect(findStartingResourceAmount(profiledConfig.startingResources, ResourcesIds.Labor)).toBe(1_500);
    expect(findStartingResourceAmount(profiledConfig.startingResources, ResourcesIds.Knight)).toBe(3_500);
    expect(
      findDiscoverableVillageResourceAmount(profiledConfig.discoverableVillageStartingResources, ResourcesIds.Labor),
    ).toMatchObject({
      min_amount: 5_000,
      max_amount: 5_000,
    });
    expect(profiledConfig.hyperstructures.hyperstructureConstructionCost).toEqual([]);
    expect(profiledConfig.exploration.relicDiscoveryIntervalSeconds).toBe(
      baseConfig.exploration.relicDiscoveryIntervalSeconds,
    );
  });

  test("keeps the base blitz config for non-official durations", () => {
    const baseConfig = getConfigFromNetwork("slot", "blitz");
    const resolvedConfig = resolveBlitzConfigForDuration("slot", 45);

    expect(resolvedConfig.season.durationSeconds).toBe(baseConfig.season.durationSeconds);
    expect(resolvedConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood]).toBe(
      baseConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood],
    );
    expect(resolvedConfig.buildings.simpleBuildingCost[BuildingType.ResourceCopper]?.[0]?.amount).toBe(
      baseConfig.buildings.simpleBuildingCost[BuildingType.ResourceCopper]?.[0]?.amount,
    );
  });

  test("resolves the official 90-minute blitz config from duration", () => {
    const resolvedConfig = resolveBlitzConfigForDuration("slot", 90);

    expect(resolvedConfig.season.durationSeconds).toBe(5_400);
    expect(resolvedConfig.resources.productionByComplexRecipeOutputs[ResourcesIds.Wood]).toBe(1);
    expect(findStartingResourceAmount(resolvedConfig.startingResources, ResourcesIds.Knight)).toBe(1_500);
  });
});
