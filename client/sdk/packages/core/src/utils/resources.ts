import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { BuildingType, RESOURCE_PRECISION, resources, ResourcesIds } from "../constants";
import { ClientComponents } from "../dojo";
import { ResourceManager } from "../modelManager";
import { configManager } from "../modelManager/ConfigManager";
import { ID, Resource, ResourceInputs } from "../types";
import { unpackResources } from "./packed-data";

// used for entities that don't have any production
export const getInventoryResources = (entityId: ID, components: ClientComponents): Resource[] => {
  return resources
    .map(({ id }) => {
      const resource = getComponentValue(components.Resource, getEntityIdFromKeys([BigInt(entityId), BigInt(id)]));
      if (resource?.balance !== undefined && resource.balance > 0n) {
        return { resourceId: id, amount: Number(resource.balance) };
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
  return { balance: resourceManager.balance(currentDefaultTick), resourceId };
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
  const weight = getComponentValue(components.Weight, getEntityIdFromKeys([BigInt(entityId)]));
  const hasWeightlessResources = configManager
    .getWeightLessResources()
    .some(
      (resourceId) =>
        (getComponentValue(components.Resource, getEntityIdFromKeys([BigInt(entityId), BigInt(resourceId)]))?.balance ??
          0n) > 0n,
    );
  if (!weight?.value && !hasWeightlessResources) return [];
  const resourceIds = resources.map((r) => r.id);
  return resourceIds
    .map((id) => {
      const resourceManager = new ResourceManager(components, entityId, id);
      const balance = resourceManager.balance(currentDefaultTick);
      return { resourceId: id, amount: balance };
    })
    .filter((r) => r.amount > 0);
};

export const getQuestResources = (realmEntityId: ID, components: ClientComponents, config: any) => {
  const realm = getComponentValue(components.Realm, getEntityIdFromKeys([BigInt(realmEntityId)]));
  const resourcesProduced = realm ? unpackResources(realm.produced_resources) : [];
  return getStartingResources(resourcesProduced, config.questResources, config.resources.resourceInputs);
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

export function multiplyByPrecision(value: number): number {
  return Math.floor(value * RESOURCE_PRECISION);
}

export function divideByPrecision(value: number): number {
  return value / RESOURCE_PRECISION;
}
