import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/balance.gen";

export const logisticsStamina = (tier: number): number => {
  if (!Number.isInteger(tier) || tier < 0 || tier > nativeRuleConstants.ATTRIBUTE_CAP)
    throw new Error(`Invalid Logistics tier ${tier}`);
  return nativeRuleConstants.LOGISTICS_STEP_STAMINA * tier;
};
