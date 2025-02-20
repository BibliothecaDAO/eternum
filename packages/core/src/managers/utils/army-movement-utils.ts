import { type ComponentValue } from "@dojoengine/recs";
import { configManager } from "..";
import { CapacityConfig, RESOURCE_PRECISION, ResourcesIds } from "../../constants";
import { ClientComponents } from "../../dojo/create-client-components";
import { Troops, TroopType } from "../../types";
import { divideByPrecision, gramToKg } from "../../utils";

export const getRemainingCapacityInKg = (
  army: ComponentValue<ClientComponents["Army"]["schema"]>,
  armyWeight: ComponentValue<ClientComponents["Weight"]["schema"]> | undefined,
) => {
  const totalCapacity = getArmyTotalCapacityInKg(army); // in kg
  const weight = getArmyWeightInKg(armyWeight); // in kg
  return totalCapacity - weight; // in kg
};

export const getArmyTotalCapacityInKg = (army: ComponentValue<ClientComponents["Army"]["schema"]>) => {
  // Convert weight_gram to kg and multiply by number of troops
  const capacity = configManager.getCapacityConfig(CapacityConfig.Army);
  return BigInt(gramToKg(Number(capacity))) * getArmyNumberOfTroops(army); // in kg
};

const getArmyWeightInKg = (weight: ComponentValue<ClientComponents["Weight"]["schema"]> | undefined) => {
  if (!weight) return 0n;
  return BigInt(gramToKg(Number(weight.value))); // in kg
};

export const getArmyNumberOfTroops = (army: ComponentValue<ClientComponents["Army"]["schema"]>) => {
  const knights = army.troops.knight_count || 0n;
  const crossbowmen = army.troops.crossbowman_count || 0n;
  const paladins = army.troops.paladin_count || 0n;
  return (knights + crossbowmen + paladins) / BigInt(RESOURCE_PRECISION);
};

export const computeTravelFoodCosts = (troops: Troops) => {
  let foodConsumption;
  const troopCount = divideByPrecision(troops.count);

  switch (troops.type) {
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
  const troopCount = divideByPrecision(troops.count);

  switch (troops.type) {
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
