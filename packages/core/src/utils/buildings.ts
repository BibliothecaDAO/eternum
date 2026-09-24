import { BuildingType, ID, ResourcesIds } from "@bibliothecadao/types";
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
  return costs.map((cost) => ({
    resource: cost.resource,
    amount: cost.amount + scale * scale * cost.amount * increase,
  }));
};

const countedBuildingsStanding = (realmEntityId: ID, buildingCategory: BuildingType, store: NativeFactStore) => {
  const standing = getBuildingQuantity(realmEntityId, buildingCategory, store);
  const hasBoard = store.get("BoardRules", { game_id: configManager.getActiveGameId() }) !== undefined;
  return hasBoard && buildingCategory === BuildingType.ResourceLabor ? Math.max(0, standing - 1) : standing;
};
