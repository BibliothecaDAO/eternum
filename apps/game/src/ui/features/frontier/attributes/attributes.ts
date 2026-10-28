import { formatFigure } from "@bibliothecadao/types";
import { battleBonusBps, homecomingBps, logisticsStamina, scoutingIncrementBps } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import { type Attribute, ATTRIBUTE_LIST, type AttributeKey } from "../army/army-detail";

/** An army's XP and attribute tiers, and the game's XP rules, exactly as the native store carries them. */
export type ArmyProgressFacts = NativeRows["ArmyProgress"];
type ProgressionRulesFacts = NativeRows["ArmyProgressionRules"];

/** The army's tier in each attribute, 1 (common) to 5 (legendary), by its field on the progress. */
export const attributeTiers = (progress: ArmyProgressFacts): Record<AttributeKey, number> =>
  Object.fromEntries(ATTRIBUTE_LIST.map(({ key }) => [key, progress[key]])) as Record<AttributeKey, number>;

/**
 * What the army's XP goes toward next: the cheapest tier it can still buy, which is the next tier of its lowest
 * attribute (every attribute shares the contract's one price table). None once all four are legendary.
 */
export const nextTierGoal = (
  progress: ArmyProgressFacts,
  rules: ProgressionRulesFacts,
): { price: number; tier: number } | undefined => {
  const lowest = Math.min(...Object.values(attributeTiers(progress)));
  const price = nextTierPrice(rules, lowest);
  return price === null ? undefined : { price, tier: lowest + 1 };
};

/** What the next tier above `tier` costs in XP, as the contract prices it; null at legendary. */
export const nextTierPrice = (rules: ProgressionRulesFacts, tier: number): number | null =>
  [rules.uncommon_xp, rules.rare_xp, rules.epic_xp, rules.legendary_xp][tier - 1] ?? null;

/** The attributes the army can Upgrade now: below legendary, with the next tier's price in hand. */
export const affordableUpgrades = (progress: ArmyProgressFacts, rules: ProgressionRulesFacts): Attribute[] =>
  ATTRIBUTE_LIST.filter(({ key }) => {
    const price = nextTierPrice(rules, progress[key]);
    return price !== null && progress.xp >= price;
  }).map(({ attribute }) => attribute);

/** The XP an army earned between two readings; an Upgrade spends XP and earns none. */
export const xpGained = (before: Pick<ArmyProgressFacts, "xp">, after: Pick<ArmyProgressFacts, "xp">): number =>
  Math.max(0, after.xp - before.xp);

/** Where a chosen attribute's card lands: the army's attribute badge. */
export const attributeBadgeTarget = (explorerId: number): string => `attributes-${explorerId}`;

/**
 * What each attribute gives at a tier, as the contract's constants apply it: damage in percent and
 * stamina from their tier tables, the chosen kind's find rate in percent of its base, and the share of surviving troops
 * returned home at the day's end in percent.
 */
const ATTRIBUTE_LOOK: Record<Attribute, { atTier: (tier: number) => number; unit: "%" | "" }> = {
  Battle: { atTier: (tier) => battleBonusBps(tier) / 100, unit: "%" },
  Logistics: { atTier: logisticsStamina, unit: "" },
  Scouting: {
    // Cumulative on one kind: +10%, +30%, +60%, +100%.
    atTier: (tier) =>
      Array.from({ length: tier }, (_, index) => scoutingIncrementBps(index + 1)).reduce((sum, bps) => sum + bps, 0) /
      100,
    unit: "%",
  },
  Homecoming: {
    atTier: (tier) => homecomingBps(tier) / 100,
    unit: "%",
  },
};

/** What going from one tier of an attribute to another gives, "+20%" or "+1.5". */
export const attributeGain = (attribute: Attribute, from: number, to: number): string => {
  const { atTier, unit } = ATTRIBUTE_LOOK[attribute];
  return `+${formatFigure(atTier(to) - atTier(from))}${unit}`;
};
