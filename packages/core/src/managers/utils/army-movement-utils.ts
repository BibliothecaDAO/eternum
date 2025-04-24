import { ResourcesIds, TroopType, type Troops } from "@bibliothecadao/types";
import { configManager } from "..";
import { divideByPrecision } from "../../utils";

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
