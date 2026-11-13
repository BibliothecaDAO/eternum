import { nativeRuleConstants, type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { BuildingType, ID, ResourcesIds, StructureType } from "@bibliothecadao/types";
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
 * Unknown without a structure, or before this client holds its Structure fact: the count it scales by is unknown too.
 */
export const getBuildingCosts = (
  realmEntityId: ID | undefined,
  store: NativeFactStore,
  buildingCategory: BuildingType,
  useSimpleCost: boolean,
) => {
  if (realmEntityId === undefined) return undefined;
  if (!store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: realmEntityId })) return undefined;
  const costs = configManager.getBuildingCosts(buildingCategory, useSimpleCost);
  if (!costs) return undefined;

  const increase = configManager.getBuildingBaseCostPercentIncrease() / 10000;
  const standing = countedBuildingsStanding(realmEntityId, buildingCategory, store);
  return costs.map((cost) => ({
    resource: cost.resource,
    amount: cost.amount + standing * standing * cost.amount * increase,
  }));
};

/**
 * How a building's price has risen at a realm, as the contract charges it: the copies of its type that already stand
 * (a board's own labor producer is not a Workshop) and what they multiply the base price by, one plus their square
 * times the preset's increase.
 */
export const buildingCostRise = (
  realmEntityId: ID,
  buildingCategory: BuildingType,
  store: NativeFactStore,
): { standing: number; times: number } => {
  const increase = configManager.getBuildingBaseCostPercentIncrease() / 10000;
  const standing = countedBuildingsStanding(realmEntityId, buildingCategory, store);
  return { standing, times: 1 + standing * standing * increase };
};

const countedBuildingsStanding = (realmEntityId: ID, buildingCategory: BuildingType, store: NativeFactStore) => {
  const standing = getBuildingQuantity(realmEntityId, buildingCategory, store);
  const hasBoard = store.get("BoardRules", { game_id: configManager.getActiveGameId() }) !== undefined;
  return hasBoard && buildingCategory === BuildingType.ResourceLabor ? Math.max(0, standing - 1) : standing;
};

export type StorehouseAvailability = "open" | "built" | { level: number } | { unavailable: true };

/** The contract's town Storehouse gate, shared by the picker and every construction entrypoint. */
export const storehouseAvailability = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
): StorehouseAvailability | undefined => {
  const board = store.get("BoardRules", { game_id: realm.game_id });
  const counts = store.get("StructureBuildings", { game_id: realm.game_id, entity_id: realm.entity_id });
  if (!board || !counts) return undefined;
  if (board.town === null || realm.base.category !== StructureType.Realm) return { unavailable: true };
  const standing = getBuildingCount(BuildingType.Storehouse, [
    counts.packed_counts_1,
    counts.packed_counts_2,
    counts.packed_counts_3,
  ]);
  if (standing > 0) return "built";
  return realm.base.level < nativeRuleConstants.TOWN_STOREHOUSE_LEVEL
    ? { level: nativeRuleConstants.TOWN_STOREHOUSE_LEVEL }
    : "open";
};
