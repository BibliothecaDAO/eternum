import { type ClientComponents } from "@/dojo/createClientComponents";
import { GRAMS_PER_KG } from "@/ui/constants";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";
import { type ComponentValue } from "@dojoengine/recs";

export const getRemainingCapacity = (
  army: ComponentValue<ClientComponents["Army"]["schema"]>,
  capacity: ComponentValue<ClientComponents["CapacityConfig"]["schema"]>,
  armyWeight: ComponentValue<ClientComponents["Weight"]["schema"]> | undefined,
) => {
  return getArmyTotalCapacity(army, capacity) - getArmyWeight(armyWeight);
};

export const getArmyTotalCapacity = (
  army: ComponentValue<ClientComponents["Army"]["schema"]>,
  capacity: ComponentValue<ClientComponents["CapacityConfig"]["schema"]>,
) => {
  return (capacity.weight_gram / BigInt(GRAMS_PER_KG)) * getArmyNumberOfTroops(army);
};

const getArmyWeight = (weight: ComponentValue<ClientComponents["Weight"]["schema"]> | undefined) => {
  if (!weight) return 0n;
  return weight.value / BigInt(EternumGlobalConfig.resources.resourcePrecision);
};

export const getArmyNumberOfTroops = (army: ComponentValue<ClientComponents["Army"]["schema"]>) => {
  const knights = army.troops.knight_count || 0n;
  const crossbowmen = army.troops.crossbowman_count || 0n;
  const paladins = army.troops.paladin_count || 0n;
  return (knights + crossbowmen + paladins) / BigInt(EternumGlobalConfig.resources.resourcePrecision);
};
