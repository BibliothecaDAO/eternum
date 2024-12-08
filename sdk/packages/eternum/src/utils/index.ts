import {
  BUILDING_COSTS,
  EternumGlobalConfig,
  HYPERSTRUCTURE_CONSTRUCTION_COSTS,
  HYPERSTRUCTURE_CREATION_COSTS,
  HYPERSTRUCTURE_TOTAL_COSTS,
  QUEST_RESOURCES,
  REALM_UPGRADE_COSTS,
  RESOURCE_BUILDING_COSTS,
  RESOURCE_INPUTS,
  RESOURCE_OUTPUTS,
  ResourcesIds,
  STRUCTURE_COSTS,
} from "../constants";

import { ResourceCostMinMax, ResourceInputs, ResourceOutputs } from "../types";
export * from "./battleSimulation";
export * from "./leaderboard";

export const scaleResourceOutputs = (resourceOutputs: ResourceOutputs, multiplier: number) => {
  let multipliedCosts: ResourceOutputs = {};

  for (let buildingType in resourceOutputs) {
    multipliedCosts[buildingType] = resourceOutputs[buildingType] * multiplier;
  }
  return multipliedCosts;
};

export const uniqueResourceInputs = (resourcesProduced: number[]): number[] => {
  let uniqueResourceInputs: number[] = [];

  for (let resourceProduced of resourcesProduced) {
    for (let resourceInput of RESOURCE_INPUTS[resourceProduced]) {
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
): ResourceInputs => {
  for (let resourceInput of uniqueResourceInputs(resourcesOnRealm).filter(
    (id) => id != ResourcesIds.Wheat && id != ResourcesIds.Fish,
  )) {
    for (let questType in questResources) {
      questResources[questType] = questResources[questType].map((questResource) => {
        if (questResource.resource === resourceInput) {
          return {
            ...questResource,
            amount: questResource.amount * EternumGlobalConfig.resources.startingResourcesInputProductionFactor,
          };
        }
        return questResource;
      });
    }
  }
  return questResources;
};

export const getQuestResources = (resourcesOnRealm: number[]): ResourceInputs => {
  let QUEST_RESOURCES_SCALED: ResourceInputs = scaleResourceInputs(
    QUEST_RESOURCES,
    EternumGlobalConfig.resources.resourceMultiplier,
  );
  return applyInputProductionFactor(QUEST_RESOURCES_SCALED, resourcesOnRealm);
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

export const RESOURCE_BUILDING_COSTS_SCALED: ResourceInputs = scaleResourceInputs(
  RESOURCE_BUILDING_COSTS,
  EternumGlobalConfig.resources.resourceMultiplier,
);

export const RESOURCE_OUTPUTS_SCALED: ResourceOutputs = scaleResourceOutputs(
  RESOURCE_OUTPUTS,
  EternumGlobalConfig.resources.resourceMultiplier,
);

export const BUILDING_COSTS_SCALED: ResourceInputs = scaleResourceInputs(
  BUILDING_COSTS,
  EternumGlobalConfig.resources.resourceMultiplier,
);

export const RESOURCE_INPUTS_SCALED: ResourceInputs = scaleResourceInputs(
  RESOURCE_INPUTS,
  EternumGlobalConfig.resources.resourceMultiplier,
);

export const STRUCTURE_COSTS_SCALED: ResourceInputs = scaleResourceInputs(
  STRUCTURE_COSTS,
  EternumGlobalConfig.resources.resourceMultiplier,
);

export const REALM_UPGRADE_COSTS_SCALED: ResourceInputs = scaleResourceInputs(
  REALM_UPGRADE_COSTS,
  EternumGlobalConfig.resources.resourceMultiplier,
);
export const HYPERSTRUCTURE_CONSTRUCTION_COSTS_SCALED: { resource: number; amount: number }[] = scaleResources(
  HYPERSTRUCTURE_CONSTRUCTION_COSTS,
  EternumGlobalConfig.resources.resourceMultiplier,
);

export const HYPERSTRUCTURE_CREATION_COSTS_SCALED: { resource: number; amount: number }[] = scaleResources(
  HYPERSTRUCTURE_CREATION_COSTS,
  EternumGlobalConfig.resources.resourceMultiplier,
);

export const HYPERSTRUCTURE_TOTAL_COSTS_SCALED: { resource: number; amount: number }[] = scaleResources(
  HYPERSTRUCTURE_TOTAL_COSTS,
  EternumGlobalConfig.resources.resourceMultiplier,
);
