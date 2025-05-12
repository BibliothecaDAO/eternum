import {
  type ClientComponents,
  type HyperstructureResourceCostMinMax,
  type ID,
  RESOURCE_PRECISION,
  type Resource,
  type ResourceCostMinMax,
  type ResourceInputs,
  type ResourceOutputs,
  ResourcesIds,
  StructureType,
  resources,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ResourceManager } from "../managers";
import { unpackValue } from "./packed-data";

// used for entities that don't have any production
export const getInventoryResources = (entityId: ID, components: ClientComponents): Resource[] => {
  return resources
    .map(({ id }) => {
      const resourceManager = new ResourceManager(components, entityId);
      const balance = resourceManager.balance(id);
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
  const resourceManager = new ResourceManager(components, entityId);
  return {
    balance: resourceManager.balanceWithProduction(currentDefaultTick, resourceId).balance,
    resourceId,
  };
};

export const getQuestResources = (realmEntityId: ID, components: ClientComponents) => {
  const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(realmEntityId)]));
  const resourcesProduced = structure ? unpackValue(structure.resources_packed) : [];

  // todo: fix
  return getStartingResources(resourcesProduced, [], []);
};

export const scaleResourceInputs = (resourceInputs: ResourceInputs, multiplier: number) => {
  const multipliedCosts: ResourceInputs = {};

  for (const buildingType in resourceInputs) {
    multipliedCosts[buildingType] = resourceInputs[buildingType].map((resourceInput) => ({
      ...resourceInput,
      amount: Math.round(resourceInput.amount * multiplier),
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
  const uniqueResourceInputs: number[] = [];

  for (const resourceProduced of resourcesProduced) {
    for (const resourceInput of resourceProductionInputResources[resourceProduced]) {
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
  for (const resourceInput of uniqueResourceInputs(resourcesOnRealm, resourceProductionInputResources).filter(
    (id) => id != ResourcesIds.Wheat && id != ResourcesIds.Fish,
  )) {
    for (const questType in questResources) {
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
  const QUEST_RESOURCES_SCALED: ResourceInputs = scaleResourceInputs(questResources, RESOURCE_PRECISION);
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

export const scaleHyperstructureConstructionCostMinMax = (
  resourceCost: HyperstructureResourceCostMinMax[],
  multiplier: number,
): HyperstructureResourceCostMinMax[] => {
  return resourceCost.map((resource) => ({
    ...resource,
    min_amount: resource.min_amount * multiplier,
    max_amount: resource.max_amount * multiplier,
  }));
};

export const scaleResourceOutputs = (resourceOutputs: ResourceOutputs, multiplier: number) => {
  const multipliedCosts: ResourceOutputs = {};

  for (const buildingType in resourceOutputs) {
    multipliedCosts[buildingType] = resourceOutputs[buildingType] * multiplier;
  }
  return multipliedCosts;
};

export const isMilitaryResource = (resourceId: ResourcesIds) => {
  return (
    resourceId === ResourcesIds.Knight ||
    resourceId === ResourcesIds.KnightT2 ||
    resourceId === ResourcesIds.KnightT3 ||
    resourceId === ResourcesIds.Paladin ||
    resourceId === ResourcesIds.PaladinT2 ||
    resourceId === ResourcesIds.PaladinT3 ||
    resourceId === ResourcesIds.Crossbowman ||
    resourceId === ResourcesIds.CrossbowmanT2 ||
    resourceId === ResourcesIds.CrossbowmanT3
  );
};

export const canTransferMilitaryResources = (fromEntityId: ID, toEntityId: ID, components: ClientComponents) => {
  const fromStructure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(fromEntityId)]));

  const toStructure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(toEntityId)]));

  // If from structure is a village, can only transfer to its connected realm
  if (fromStructure?.category === StructureType.Village) {
    return toStructure?.entity_id === fromStructure.metadata.village_realm;
  }

  // If to structure is a village, can only transfer from its connected realm
  if (toStructure?.category === StructureType.Village) {
    return fromStructure?.entity_id === toStructure.metadata.village_realm;
  }

  // Otherwise, transfer is allowed
  return true;
};
