import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { BuildingType, RESOURCE_PRECISION, resources, ResourcesIds } from "../constants";
import { ClientComponents } from "../dojo";
import { ResourceManager } from "../managers";
import { ID, ProductionByLaborParams, Resource, ResourceCostMinMax, ResourceInputs, ResourceOutputs } from "../types";
import { unpackValue } from "./packed-data";

// used for entities that don't have any production
export const getInventoryResources = (entityId: ID, components: ClientComponents): Resource[] => {
  return resources
    .map(({ id }) => {
      const resourceManager = new ResourceManager(components, entityId, id);
      const balance = resourceManager.balance();
      if (balance > 0) {
        return { resourceId: id, amount: Number(balance) };
      }
      return undefined;
    })
    .filter((resource): resource is Resource => resource !== undefined);
};

// for entities that have production like realms
export const getBalance = (
  entityId: ID,
  resourceId: ResourcesIds,
  currentDefaultTick: number,
  components: ClientComponents,
) => {
  const resourceManager = new ResourceManager(components, entityId, resourceId);
  return { balance: resourceManager.balanceWithProduction(currentDefaultTick), resourceId };
};

export const getResourceProductionInfo = (entityId: ID, resourceId: ResourcesIds, components: ClientComponents) => {
  const resourceManager = new ResourceManager(components, entityId, resourceId);
  return resourceManager.getProduction();
};

export const getResourcesFromBalance = (
  entityId: ID,
  currentDefaultTick: number,
  components: ClientComponents,
): Resource[] => {
  // const weight = getComponentValue(components.Weight, getEntityIdFromKeys([BigInt(entityId)]));
  // const hasWeightlessResources = configManager
  //   .getWeightLessResources()
  //   .some(
  //     (resourceId) =>
  //       (getComponentValue(components.Resource, getEntityIdFromKeys([BigInt(entityId), BigInt(resourceId)]))?.balance ??
  //         0n) > 0n,
  //   );
  // if (!weight?.value && !hasWeightlessResources) return [];
  // todo: improve optimisation
  const resourceIds = resources.map((r) => r.id);
  return resourceIds
    .map((id) => {
      const resourceManager = new ResourceManager(components, entityId, id);
      const balance = resourceManager.balanceWithProduction(currentDefaultTick);
      return { resourceId: id, amount: balance };
    })
    .filter((r) => r.amount > 0);
};

export const getQuestResources = (realmEntityId: ID, components: ClientComponents) => {
  const realm = getComponentValue(components.Realm, getEntityIdFromKeys([BigInt(realmEntityId)]));
  const resourcesProduced = realm ? unpackValue(realm.produced_resources) : [];

  // todo: fix
  return getStartingResources(resourcesProduced, [], []);
};

export const isResourceProductionBuilding = (buildingId: BuildingType) => {
  return (
    buildingId === BuildingType.Resource ||
    buildingId === BuildingType.Farm ||
    buildingId === BuildingType.FishingVillage ||
    buildingId === BuildingType.Barracks ||
    buildingId === BuildingType.ArcheryRange ||
    buildingId === BuildingType.Stable
  );
};

export const scaleResourceInputs = (resourceInputs: ResourceInputs, multiplier: number) => {
  let multipliedCosts: ResourceInputs = {};

  for (let buildingType in resourceInputs) {
    multipliedCosts[buildingType] = resourceInputs[buildingType].map((resourceInput) => ({
      ...resourceInput,
      amount: resourceInput.amount * multiplier,
    }));
  }

  return multipliedCosts;
};

export const scaleResources = (resources: any[], multiplier: number): any[] => {
  return resources.map((resource) => ({
    ...resource,
    amount: resource.amount * multiplier,
  }));
};

export const uniqueResourceInputs = (
  resourcesProduced: number[],
  resourceProductionInputResources: ResourceInputs,
): number[] => {
  let uniqueResourceInputs: number[] = [];

  for (let resourceProduced of resourcesProduced) {
    for (let resourceInput of resourceProductionInputResources[resourceProduced]) {
      if (!uniqueResourceInputs.includes(resourceInput.resource)) {
        uniqueResourceInputs.push(resourceInput.resource);
      }
    }
  }

  return uniqueResourceInputs;
};

export const applyInputProductionFactor = (
  questResources: ResourceInputs,
  resourcesOnRealm: number[],
  resourceProductionInputResources: ResourceInputs,
): ResourceInputs => {
  for (let resourceInput of uniqueResourceInputs(resourcesOnRealm, resourceProductionInputResources).filter(
    (id) => id != ResourcesIds.Wheat && id != ResourcesIds.Fish,
  )) {
    for (let questType in questResources) {
      questResources[questType] = questResources[questType].map((questResource) => {
        if (questResource.resource === resourceInput) {
          return {
            ...questResource,
            amount: questResource.amount * RESOURCE_PRECISION,
          };
        }
        return questResource;
      });
    }
  }
  return questResources;
};

export const getStartingResources = (
  resourcesOnRealm: number[],
  questResources: ResourceInputs,
  resourceProductionInputResources: ResourceInputs,
): ResourceInputs => {
  let QUEST_RESOURCES_SCALED: ResourceInputs = scaleResourceInputs(questResources, RESOURCE_PRECISION);
  return applyInputProductionFactor(QUEST_RESOURCES_SCALED, resourcesOnRealm, resourceProductionInputResources);
};

export const scaleResourceCostMinMax = (
  resourceCost: ResourceCostMinMax[],
  multiplier: number,
): ResourceCostMinMax[] => {
  return resourceCost.map((resource) => ({
    ...resource,
    min_amount: resource.min_amount * multiplier,
    max_amount: resource.max_amount * multiplier,
  }));
};

export const scaleResourceOutputs = (resourceOutputs: ResourceOutputs, multiplier: number) => {
  let multipliedCosts: ResourceOutputs = {};

  for (let buildingType in resourceOutputs) {
    multipliedCosts[buildingType] = resourceOutputs[buildingType] * multiplier;
  }
  return multipliedCosts;
};

export const scaleResourceProductionByLaborParams = (config: ProductionByLaborParams, multiplier: number) => {
  let multipliedValues: ProductionByLaborParams = {};

  for (let buildingType in config) {
    multipliedValues[buildingType] = {
      ...config[buildingType],
      wheat_burn_per_labor: config[buildingType].wheat_burn_per_labor * multiplier,
      fish_burn_per_labor: config[buildingType].fish_burn_per_labor * multiplier,
    };
  }
  return multipliedValues;
};
