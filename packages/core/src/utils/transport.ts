import { configManager } from "..";
import { CapacityConfig, Resource } from "@bibliothecadao/types";

export const calculateDonkeysNeeded = (orderWeightKg: number): number => {
  const donkeyCapacityKg = configManager.getCapacityConfigKg(CapacityConfig.Donkey);

  return Math.ceil(orderWeightKg / donkeyCapacityKg);
};

// kg
// without resource precision
export const getTotalResourceWeightKg = (resources: Array<Resource | undefined>) => {
  return resources.reduce(
    (total, resource) =>
      total + (resource ? resource.amount * configManager.getResourceWeightKg(resource.resourceId) : 0),
    0,
  );
};
