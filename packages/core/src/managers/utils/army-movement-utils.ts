import { type ComponentValue } from "@dojoengine/recs";
import { configManager } from "..";
import { RESOURCE_PRECISION, ResourcesIds } from "../../constants";
import { ClientComponents } from "../../dojo/create-client-components";
import { divideByPrecision, gramToKg } from "../../utils";

export const getRemainingCapacityInKg = (
  army: ComponentValue<ClientComponents["Army"]["schema"]>,
  capacity: ComponentValue<ClientComponents["CapacityConfig"]["schema"]>,
  armyWeight: ComponentValue<ClientComponents["Weight"]["schema"]> | undefined,
) => {
  const totalCapacity = getArmyTotalCapacityInKg(army, capacity); // in kg
  const weight = getArmyWeightInKg(armyWeight); // in kg
  console.log({ totalCapacity, weight });
  return totalCapacity - weight; // in kg
};

export const getArmyTotalCapacityInKg = (
  army: ComponentValue<ClientComponents["Army"]["schema"]>,
  capacity: ComponentValue<ClientComponents["CapacityConfig"]["schema"]>,
) => {
  // Convert weight_gram to kg and multiply by number of troops
  return BigInt(gramToKg(Number(capacity.weight_gram))) * getArmyNumberOfTroops(army); // in kg
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

export const computeTravelFoodCosts = (
  troops: ComponentValue<ClientComponents["Army"]["schema"]["troops"]> | undefined,
) => {
  const paladinFoodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Paladin);
  const knightFoodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Knight);
  const crossbowmanFoodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Crossbowman);

  const paladinCount = divideByPrecision(Number(troops?.paladin_count));
  const knightCount = divideByPrecision(Number(troops?.knight_count));
  const crossbowmanCount = divideByPrecision(Number(troops?.crossbowman_count));

  const paladinWheatConsumption = paladinFoodConsumption.travelWheatBurnAmount * paladinCount;
  const knightWheatConsumption = knightFoodConsumption.travelWheatBurnAmount * knightCount;
  const crossbowmanWheatConsumption = crossbowmanFoodConsumption.travelWheatBurnAmount * crossbowmanCount;

  const paladinFishConsumption = paladinFoodConsumption.travelFishBurnAmount * paladinCount;
  const knightFishConsumption = knightFoodConsumption.travelFishBurnAmount * knightCount;
  const crossbowmanFishConsumption = crossbowmanFoodConsumption.travelFishBurnAmount * crossbowmanCount;

  const wheatPayAmount = paladinWheatConsumption + knightWheatConsumption + crossbowmanWheatConsumption;
  const fishPayAmount = paladinFishConsumption + knightFishConsumption + crossbowmanFishConsumption;

  return {
    wheatPayAmount,
    fishPayAmount,
  };
};

export const computeExploreFoodCosts = (
  troops: ComponentValue<ClientComponents["Army"]["schema"]["troops"]> | undefined,
) => {
  const paladinFoodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Paladin);
  const knightFoodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Knight);
  const crossbowmanFoodConsumption = configManager.getTravelFoodCostConfig(ResourcesIds.Crossbowman);

  const paladinCount = divideByPrecision(Number(troops?.paladin_count));
  const knightCount = divideByPrecision(Number(troops?.knight_count));
  const crossbowmanCount = divideByPrecision(Number(troops?.crossbowman_count));

  const paladinWheatConsumption = paladinFoodConsumption.exploreWheatBurnAmount * paladinCount;
  const knightWheatConsumption = knightFoodConsumption.exploreWheatBurnAmount * knightCount;
  const crossbowmanWheatConsumption = crossbowmanFoodConsumption.exploreWheatBurnAmount * crossbowmanCount;

  const paladinFishConsumption = paladinFoodConsumption.exploreFishBurnAmount * paladinCount;
  const knightFishConsumption = knightFoodConsumption.exploreFishBurnAmount * knightCount;
  const crossbowmanFishConsumption = crossbowmanFoodConsumption.exploreFishBurnAmount * crossbowmanCount;

  const wheatPayAmount = paladinWheatConsumption + knightWheatConsumption + crossbowmanWheatConsumption;
  const fishPayAmount = paladinFishConsumption + knightFishConsumption + crossbowmanFishConsumption;

  return {
    wheatPayAmount,
    fishPayAmount,
  };
};
