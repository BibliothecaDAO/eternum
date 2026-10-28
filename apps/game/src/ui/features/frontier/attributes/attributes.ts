import { formatFigure } from "@bibliothecadao/types";
import {
  battleBonusBps,
  homecomingBps,
  logisticsStamina,
  scoutingIncrementBps,
  lowestFittingPoint,
} from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import { type Attribute, ATTRIBUTE_LIST, type AttributeKey } from "../army/army-detail";

/** An army's XP and attribute tiers, and the game's XP rules, exactly as the native store carries them. */
export type ArmyProgressFacts = NativeRows["ArmyProgress"];
/** The army's rank in every attribute, 0 (untrained) to 5 (legendary). */
export const attributeTiers = (progress: ArmyProgressFacts): Record<AttributeKey, number> =>
  Object.fromEntries(ATTRIBUTE_LIST.map(({ key }) => [key, progress[key]])) as Record<AttributeKey, number>;

/** Attributes for which the army holds a fitting point. */
export const availableRankUps = (progress: ArmyProgressFacts): Attribute[] =>
  ATTRIBUTE_LIST.filter(({ key }) => lowestFittingPoint(progress, progress[key] + 1) !== undefined).map(
    ({ attribute }) => attribute,
  );

/** Lifetime XP earned between two readings. */
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
    // Cumulative on one kind across all five ranks.
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
