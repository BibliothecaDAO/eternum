import { researchedBuildingTier } from "./realm-research";
import { BuildingType, ID, ResourcesIds, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import { configManager, getBuildingCount } from "..";

export const getBuildingQuantity = (entityId: ID, buildingType: BuildingType, store: NativeFactStore) => {
  const structureBuildings = store.get("StructureBuildings", {
    game_id: configManager.getActiveGameId(),
    entity_id: entityId,
  });

  const buildingCount = getBuildingCount(buildingType, [
    structureBuildings?.packed_counts_1 || 0n,
    structureBuildings?.packed_counts_2 || 0n,
    structureBuildings?.packed_counts_3 || 0n,
  ]);
  return buildingCount;
};

export const getConsumedBy = (resourceProduced: ResourcesIds) =>
  configManager
    .producibleResources()
    .filter((resourceId) =>
      configManager.getRecipeInputs(resourceId, false)!.some((input) => input.resource === resourceProduced),
    );

/**
 * What the next building of a category costs, as the chain charges it (construction.cairo pay_building_costs): each base
 * cost grows by the increase percent times the square of the buildings of that category already standing. On a
 * realm board the realm's own workshop comes with it, so the chain does not count it among the workshops standing.
 */
export const getBuildingCosts = (
  realmEntityId: ID,
  store: NativeFactStore,
  buildingCategory: BuildingType,
  useSimpleCost: boolean,
) => {
  const costs = configManager.getBuildingCosts(buildingCategory, useSimpleCost);
  if (!costs) return undefined;

  const increase = configManager.getBuildingBaseCostPercentIncrease() / 10000;
  const scale = countedBuildingsStanding(realmEntityId, buildingCategory, store);
  const result = costs.map((cost) => ({
    resource: cost.resource,
    amount: cost.amount + scale * scale * cost.amount * increase,
  }));
  const gameId = configManager.getActiveGameId();
  if (store.get("BoardRules", { game_id: gameId })) {
    const tier = researchedBuildingTier(store, gameId, realmEntityId, buildingCategory);
    if (tier === undefined) return undefined;
    let upgrades = 0n;
    for (let next = 2; next <= tier; next++) {
      upgrades += store.require("BuildingTierRule", {
        game_id: gameId,
        category: buildingCategory,
        tier: next,
      }).labor_upgrade_cost;
    }
    if (upgrades > 0n) {
      const labor = result.find((cost) => cost.resource === ResourcesIds.Labor);
      if (!labor) throw new Error("Research building has no labor base cost");
      labor.amount += Number(upgrades) / RESOURCE_PRECISION;
    }
  }
  return result;
};

const countedBuildingsStanding = (realmEntityId: ID, buildingCategory: BuildingType, store: NativeFactStore) => {
  const standing = getBuildingQuantity(realmEntityId, buildingCategory, store);
  const hasBoard = store.get("BoardRules", { game_id: configManager.getActiveGameId() }) !== undefined;
  return hasBoard && buildingCategory === BuildingType.ResourceLabor ? Math.max(0, standing - 1) : standing;
};
