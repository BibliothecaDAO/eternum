import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";

const LOGISTICS_STAMINA = [
  0,
  nativeRuleConstants.LOGISTICS_COMMON_STAMINA,
  nativeRuleConstants.LOGISTICS_UNCOMMON_STAMINA,
  nativeRuleConstants.LOGISTICS_RARE_STAMINA,
  nativeRuleConstants.LOGISTICS_EPIC_STAMINA,
  nativeRuleConstants.LOGISTICS_LEGENDARY_STAMINA,
];

export const logisticsStamina = (tier: number): number => {
  const stamina = LOGISTICS_STAMINA[tier];
  if (!Number.isInteger(tier) || stamina === undefined) throw new Error(`Invalid Logistics tier ${tier}`);
  return stamina;
};
