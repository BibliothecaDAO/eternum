import { getComponentValue } from "@dojoengine/recs";
import { ClientComponents, configManager, getBuildingCount, getEntityIdFromKeys, ResourcesIds } from "..";
import { BuildingType } from "../constants/structures";
import { ID, ResourceCost } from "../types/common";

export const getBuildingQuantity = (entityId: ID, buildingType: BuildingType, components: ClientComponents) => {
  const structureBuildings = getComponentValue(components.StructureBuildings, getEntityIdFromKeys([BigInt(entityId)]));

  const buildingCount = getBuildingCount(buildingType, structureBuildings?.packed_counts || 0n);
  return buildingCount;
};

export const getConsumedBy = (resourceProduced: ResourcesIds) => {
  return Object.entries(configManager.resourceInputs)
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

export const getResourceBuildingCosts = (realmEntityId: ID, components: ClientComponents, resourceId: ResourcesIds) => {
  const buildingGeneralConfig = configManager.getBuildingGeneralConfig();
  if (!buildingGeneralConfig) {
    return;
  }
  const buildingType = resourceIdToBuildingCategory(resourceId);

  const buildingQuantity = getBuildingQuantity(realmEntityId, buildingType, components);

  let updatedCosts: ResourceCost[] = [];

  configManager.resourceBuildingCosts[Number(resourceId)].forEach((cost) => {
    const baseCost = cost.amount;
    const percentageAdditionalCost = (baseCost * (buildingGeneralConfig.base_cost_percent_increase / 100)) / 100;
    const scaleFactor = Math.max(0, buildingQuantity ?? 0 - 1);
    const totalCost = baseCost + scaleFactor * scaleFactor * percentageAdditionalCost;
    updatedCosts.push({ resource: cost.resource, amount: totalCost });
  });
  return updatedCosts;
};

export const getBuildingCosts = (realmEntityId: ID, components: ClientComponents, buildingCategory: BuildingType) => {
  const buildingBaseCostPercentIncrease = configManager.getBuildingBaseCostPercentIncrease();

  const buildingQuantity = getBuildingQuantity(realmEntityId, buildingCategory, components);

  let updatedCosts: ResourceCost[] = [];

  configManager.buildingCosts[Number(buildingCategory)].forEach((cost) => {
    const baseCost = cost.amount;
    const percentageAdditionalCost = (baseCost * (buildingBaseCostPercentIncrease / 100)) / 100;
    const scaleFactor = Math.max(0, buildingQuantity ?? 0 - 1);
    const totalCost = baseCost + scaleFactor * scaleFactor * percentageAdditionalCost;
    updatedCosts.push({ resource: cost.resource, amount: totalCost });
  });
  return updatedCosts;
};

export const resourceIdToBuildingCategory = (resourceId: ResourcesIds): BuildingType => {
  if (resourceId === ResourcesIds.Wheat) {
    return BuildingType.Farm;
  }
  if (resourceId === ResourcesIds.Fish) {
    return BuildingType.FishingVillage;
  }
  if (resourceId > 0 && resourceId < 22) {
    return BuildingType.Resource;
  }
  if (resourceId === ResourcesIds.Donkey) {
    return BuildingType.Market;
  }
  if (resourceId === ResourcesIds.Knight) {
    return BuildingType.Barracks1;
  }
  if (resourceId === ResourcesIds.KnightT2) {
    return BuildingType.Barracks2;
  }
  if (resourceId === ResourcesIds.KnightT3) {
    return BuildingType.Barracks3;
  }
  if (resourceId === ResourcesIds.Crossbowman) {
    return BuildingType.ArcheryRange1;
  }
  if (resourceId === ResourcesIds.CrossbowmanT2) {
    return BuildingType.ArcheryRange2;
  }
  if (resourceId === ResourcesIds.CrossbowmanT3) {
    return BuildingType.ArcheryRange3;
  }
  if (resourceId === ResourcesIds.Paladin) {
    return BuildingType.Stable1;
  }
  if (resourceId === ResourcesIds.PaladinT2) {
    return BuildingType.Stable2;
  }
  if (resourceId === ResourcesIds.PaladinT3) {
    return BuildingType.Stable3;
  }
  return BuildingType.None;
};
