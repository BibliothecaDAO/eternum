import { BuildingType, ID, ResourceCost, ResourcesIds } from "@bibliothecadao/types";
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

export const getConsumedBy = (resourceProduced: ResourcesIds) => {
  return Object.entries(configManager.complexSystemResourceInputs)
    .map(([resourceId, inputs]) => {
      const resource = inputs.find(
        (input: { resource: number; amount: number }) => input.resource === resourceProduced,
      );
      if (resource) {
        return Number(resourceId);
      }
    })
    .filter(Boolean);
};

export const getBuildingCosts = (
  realmEntityId: ID,
  store: NativeFactStore,
  buildingCategory: BuildingType,
  useSimpleCost: boolean,
) => {
  const buildingBaseCostPercentIncrease = configManager.getBuildingBaseCostPercentIncrease() / 10000;

  const buildingQuantity = getBuildingQuantity(realmEntityId, buildingCategory, store);

  let updatedCosts: ResourceCost[] = [];

  let costs = useSimpleCost
    ? configManager.simpleBuildingCosts[Number(buildingCategory)]
    : configManager.complexBuildingCosts[Number(buildingCategory)];

  if (!costs) return undefined;

  costs.forEach((cost) => {
    const baseCost = cost.amount;
    const percentageAdditionalCost = baseCost * buildingBaseCostPercentIncrease;
    const scaleFactor = Math.max(0, buildingQuantity ?? 0 - 1);
    const totalCost = baseCost + scaleFactor * scaleFactor * percentageAdditionalCost;
    updatedCosts.push({ resource: cost.resource, amount: totalCost });
  });
  return updatedCosts;
};
