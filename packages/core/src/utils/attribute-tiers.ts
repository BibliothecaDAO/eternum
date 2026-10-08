import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";

/** An attribute tier as the contract stores it: 1 (common) to 5 (legendary). */
const tierIndex = (tier: number): number => {
  if (!Number.isInteger(tier) || tier < 1 || tier > nativeRuleConstants.ATTRIBUTE_CAP)
    throw new Error(`Invalid attribute tier ${tier}`);
  return tier - 1;
};

const BATTLE_BPS = [
  0,
  nativeRuleConstants.BATTLE_UNCOMMON_BPS,
  nativeRuleConstants.BATTLE_RARE_BPS,
  nativeRuleConstants.BATTLE_EPIC_BPS,
  nativeRuleConstants.BATTLE_LEGENDARY_BPS,
];
const SCOUTING_BPS = [
  0,
  nativeRuleConstants.SCOUTING_UNCOMMON_BPS,
  nativeRuleConstants.SCOUTING_RARE_BPS,
  nativeRuleConstants.SCOUTING_EPIC_BPS,
  nativeRuleConstants.SCOUTING_LEGENDARY_BPS,
];
const HOMECOMING_BPS = [
  0,
  nativeRuleConstants.HOMECOMING_UNCOMMON_BPS,
  nativeRuleConstants.HOMECOMING_RARE_BPS,
  nativeRuleConstants.HOMECOMING_EPIC_BPS,
  nativeRuleConstants.HOMECOMING_LEGENDARY_BPS,
];
const LOGISTICS_STAMINA = [
  0,
  nativeRuleConstants.LOGISTICS_UNCOMMON_STAMINA,
  nativeRuleConstants.LOGISTICS_RARE_STAMINA,
  nativeRuleConstants.LOGISTICS_EPIC_STAMINA,
  nativeRuleConstants.LOGISTICS_LEGENDARY_STAMINA,
];

/** Damage dealt above common at a Battle tier, in the basis points Combat reads (rules::battle_bonus_bps). */
export const battleBonusBps = (tier: number): number => BATTLE_BPS[tierIndex(tier)]!;

/**
 * What reaching a Scouting tier adds to the kind chosen for it, in basis points of that kind's base rate
 * (rules::scouting_increment_bps); common adds nothing.
 */
export const scoutingIncrementBps = (tier: number): number => SCOUTING_BPS[tierIndex(tier)]!;

/** Maximum stamina above the troop's base at a Logistics tier (rules::logistics_stamina). */
export const logisticsStamina = (tier: number): number => LOGISTICS_STAMINA[tierIndex(tier)]!;

/** The share of its surviving troops an army returns home at a Homecoming tier, in basis points (rules::homecoming_bps). */
export const homecomingBps = (tier: number): number => HOMECOMING_BPS[tierIndex(tier)]!;
