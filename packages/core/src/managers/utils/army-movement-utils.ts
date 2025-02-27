import { configManager } from "..";
import { CapacityConfig, ResourcesIds } from "../../constants";
import { Troops, TroopType } from "../../types";
import { divideByPrecision, gramToKg } from "../../utils";

// troop count without precision
export const getRemainingCapacityInKg = (troopsCount: number, weightInKg: number) => {
  const totalCapacity = getArmyTotalCapacityInKg(troopsCount); // in kg
  return totalCapacity - BigInt(weightInKg); // in kg
};

// number of troops needs to be divided by precision
export const getArmyTotalCapacityInKg = (troopsCount: number) => {
  // Convert weight_gram to kg and multiply by number of troops
  const capacity = configManager.getCapacityConfig(CapacityConfig.Army);
  return BigInt(gramToKg(Number(capacity))) * BigInt(troopsCount); // in kg
};

export const computeTravelFoodCosts = (troops: Troops) => {
  let foodConsumption;
  const troopCount = divideByPrecision(Number(troops.count));

  switch (troops.category) {
    case TroopType.Paladin:
      foodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Paladin);
      break;
    case TroopType.Knight:
      foodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Knight);
      break;
    case TroopType.Crossbowman:
      foodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Crossbowman);
      break;
    default:
      throw new Error("Invalid troop type");
  }

  const wheatPayAmount = foodConsumption.travelWheatBurnAmount * troopCount;
  const fishPayAmount = foodConsumption.travelFishBurnAmount * troopCount;

  return {
    wheatPayAmount,
    fishPayAmount,
  };
};

export const computeExploreFoodCosts = (troops: Troops) => {
  let foodConsumption;
  const troopCount = divideByPrecision(Number(troops.count));

  switch (troops.category) {
    case TroopType.Paladin:
      foodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Paladin);
      break;
    case TroopType.Knight:
      foodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Knight);
      break;
    case TroopType.Crossbowman:
      foodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Crossbowman);
      break;
    default:
      throw new Error("Invalid troop type");
  }

  const wheatPayAmount = foodConsumption.exploreWheatBurnAmount * troopCount;
  const fishPayAmount = foodConsumption.exploreFishBurnAmount * troopCount;

  return {
    wheatPayAmount,
    fishPayAmount,
  };
};
