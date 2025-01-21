import { RESOURCE_PRECISION, ResourcesIds } from "../constants";
import { ResourceCostMinMax, ResourceInputs, ResourceOutputs } from "../types";

export * from "./army";
export * from "./battle-simulator";
export * from "./entities";
export * from "./guild";
export * from "./leaderboard";
export * from "./packed-data";
export * from "./players";
export * from "./realm";
export * from "./resources";
export * from "./structure";
export * from "./transport";
export * from "./utils";

export const gramToKg = (value: number) => {
  return value / 1000;
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

export const scaleResourceOutputs = (resourceOutputs: ResourceOutputs, multiplier: number) => {
  let multipliedCosts: ResourceOutputs = {};

  for (let buildingType in resourceOutputs) {
    multipliedCosts[buildingType] = resourceOutputs[buildingType] * multiplier;
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

export function multiplyByPrecision(value: number): number {
  return Math.floor(value * RESOURCE_PRECISION);
}

export function divideByPrecision(value: number): number {
  return value / RESOURCE_PRECISION;
}
