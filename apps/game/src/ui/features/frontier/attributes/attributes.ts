import { battleBonusBps, logisticsStamina } from "@bibliothecadao/eternum";
import { nativeRuleConstants, type NativeRows } from "@bibliothecadao/eternum/game-client";

/** An army's XP and attribute tiers, and the game's XP rules, exactly as the native store carries them. */
export type ArmyProgressFacts = NativeRows["ArmyProgress"];
export type Attribute = "Battle" | "Logistics" | "Scouting" | "Support";
export type ProgressionRulesFacts = NativeRows["ArmyProgressionRules"];

export const ATTRIBUTES: readonly Attribute[] = ["Battle", "Logistics", "Scouting", "Support"];

/** The contract's top tier, legendary. */
export const MAX_ATTRIBUTE_LEVEL = nativeRuleConstants.ATTRIBUTE_CAP;

/** The army's tier in one attribute, 1 (common) to 5 (legendary). */
export const attributeLevel = (progress: ArmyProgressFacts, attribute: Attribute): number =>
  ({
    Battle: progress.battle,
    Logistics: progress.logistics,
    Scouting: progress.scouting,
    Support: progress.support,
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
 * Each attribute's glyph and what it gives at a tier, as the contract's constants apply it: damage in percent and
 * stamina from their tier tables, camp and rift odds in points, and the home realm's production in percent for the day.
 */
export const ATTRIBUTE_LOOK: Record<Attribute, { glyph: string; atTier: (tier: number) => number; unit: "%" | "" }> = {
  Battle: { glyph: "/images/frontier/attributes/battle.svg", atTier: (tier) => battleBonusBps(tier) / 100, unit: "%" },
  Logistics: { glyph: "/images/frontier/attributes/logistics.svg", atTier: logisticsStamina, unit: "" },
  Scouting: {
    glyph: "/images/frontier/attributes/scouting.svg",
    atTier: (tier) => ((tier - 1) * nativeRuleConstants.ATTRIBUTE_SCOUTING_BPS) / 100,
    unit: "",
  },
  Support: {
    glyph: "/images/frontier/attributes/support.svg",
    atTier: (tier) => (tier - 1) * nativeRuleConstants.ATTRIBUTE_SUPPORT_PERCENT,
    unit: "%",
  },
};

const gain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** What going from one tier of an attribute to another gives, "+20%" or "+1.5". */
export const attributeGain = (attribute: Attribute, from: number, to: number): string => {
  const { atTier, unit } = ATTRIBUTE_LOOK[attribute];
  return `+${gain.format(atTier(to) - atTier(from))}${unit}`;
};
