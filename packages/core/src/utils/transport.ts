import { divideByPrecision } from ".";
import { ClientConfigManager } from "..";
import { CapacityConfigCategory } from "../constants";
import { Resource } from "../types";

export const calculateDonkeysNeeded = (orderWeight: number): number => {
  const configManager = ClientConfigManager.instance();
  const donkeyCapacityGrams = configManager.getCapacityConfig(CapacityConfigCategory.Donkey);

  return Math.ceil(divideByPrecision(orderWeight) / donkeyCapacityGrams);
};

export const getTotalResourceWeight = (resources: Array<Resource | undefined>) => {
  const configManager = ClientConfigManager.instance();

  return resources.reduce(
    (total, resource) =>
      total + (resource ? resource.amount * configManager.getResourceWeight(resource.resourceId) || 0 : 0),
    0,
  );
};
