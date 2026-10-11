import { battleBonusBps, homecomingBps, logisticsStamina, scoutingIncrementBps } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

/** An army's XP and attribute tiers, and the game's XP rules, exactly as the native store carries them. */
export type ArmyProgressFacts = NativeRows["ArmyProgress"];
export type Attribute = "Battle" | "Logistics" | "Scouting" | "Homecoming";
export type ProgressionRulesFacts = NativeRows["ArmyProgressionRules"];

const ATTRIBUTES: readonly Attribute[] = ["Battle", "Logistics", "Scouting", "Homecoming"];

/** The army's tier in one attribute, 1 (common) to 5 (legendary). */
const attributeLevel = (progress: ArmyProgressFacts, attribute: Attribute): number =>
  ({
    Battle: progress.battle,
    Logistics: progress.logistics,
    Scouting: progress.scouting,
    Homecoming: progress.homecoming,
  })[attribute];

/** What the next tier above `tier` costs in XP, as the contract prices it; null at legendary. */
export const nextTierPrice = (rules: ProgressionRulesFacts, tier: number): number | null =>
  [rules.uncommon_xp, rules.rare_xp, rules.epic_xp, rules.legendary_xp][tier - 1] ?? null;

/** The attributes the army can Upgrade now: below legendary, with the next tier's price in hand. */
export const affordableUpgrades = (progress: ArmyProgressFacts, rules: ProgressionRulesFacts): Attribute[] =>
  ATTRIBUTES.filter((attribute) => {
    const price = nextTierPrice(rules, attributeLevel(progress, attribute));
    return price !== null && progress.xp >= price;
  });

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
export const ATTRIBUTE_LOOK: Record<Attribute, { atTier: (tier: number) => number; unit: "%" | "" }> = {
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

const gain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** What going from one tier of an attribute to another gives, "+20%" or "+1.5". */
export const attributeGain = (attribute: Attribute, from: number, to: number): string => {
  const { atTier, unit } = ATTRIBUTE_LOOK[attribute];
  return `+${gain.format(atTier(to) - atTier(from))}${unit}`;
};
