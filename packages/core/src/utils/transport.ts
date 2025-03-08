import { divideByPrecision, kgToGram } from ".";
import { ClientConfigManager } from "..";
import { CapacityConfig } from "../constants";
import { Resource } from "../types";

export const calculateDonkeysNeeded = (orderWeight: number): number => {
  const configManager = ClientConfigManager.instance();
  const donkeyCapacityGrams = configManager.getCapacityConfig(CapacityConfig.Donkey);

  return Math.ceil(divideByPrecision(orderWeight) / donkeyCapacityGrams);
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
