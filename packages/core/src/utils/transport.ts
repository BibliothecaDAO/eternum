import { kgToGram } from ".";
import { ClientConfigManager, configManager } from "..";
import { CapacityConfig } from "../constants";
import { Resource } from "../types";

export const calculateDonkeysNeeded = (orderWeightKg: number): number => {
  const donkeyCapacityKg = configManager.getCapacityConfigKg(CapacityConfig.Donkey);

  return Math.ceil(orderWeightKg / donkeyCapacityKg);
};

// grams
export const getTotalResourceWeightGrams = (resources: Array<Resource | undefined>) => {
  const configManager = ClientConfigManager.instance();

  return resources.reduce(
    (total, resource) =>
      total + (resource ? resource.amount * kgToGram(configManager.getResourceWeightKg(resource.resourceId) || 0) : 0),
    0,
  );
};
