import { ResourceInputs, ResourceOutputs } from "./common";

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

export const scaleResourceOutputs = (resourceOutputs: ResourceOutputs, multiplier: number) => {
  const multipliedCosts: ResourceOutputs = {};

  for (const buildingType in resourceOutputs) {
    multipliedCosts[buildingType] = resourceOutputs[buildingType] * multiplier;
  }
  return multipliedCosts;
};
