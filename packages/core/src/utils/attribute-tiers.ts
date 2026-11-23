import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/balance.gen";

export const logisticsStamina = (bar: number, tier: number): number => {
  if (!Number.isInteger(tier) || tier < 0 || tier > nativeRuleConstants.ATTRIBUTE_CAP)
    throw new Error(`Invalid Logistics tier ${tier}`);
  return Math.floor((bar * nativeRuleConstants.LOGISTICS_STEP_PERCENT * tier) / 100);
};
