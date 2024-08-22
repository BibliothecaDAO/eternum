import { RESOURCE_INPUTS } from "../constants";
import { ResourceInputs, ResourceOutputs } from "../types";

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

export const EXPLORATION_COSTS_SCALED: Resource[] = scaleResources(
  EXPLORATION_COSTS,
  EternumGlobalConfig.resources.resourceMultiplier,
);

export const STRUCTURE_COSTS_SCALED: ResourceInputs = scaleResourceInputs(
  STRUCTURE_COSTS,
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

