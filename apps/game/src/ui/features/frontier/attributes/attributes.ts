import { nativeRuleConstants, type NativeRows } from "@bibliothecadao/eternum/game-client";

/** An army's progress, its pending offer and the game's XP rules, exactly as the native store carries them. */
export type ArmyProgressFacts = NativeRows["ArmyProgress"];
export type AttributeOfferFacts = NonNullable<ArmyProgressFacts["pending"]>;
export type Attribute = AttributeOfferFacts["choices"][number];
export type ProgressionRulesFacts = NativeRows["ArmyProgressionRules"];

/** The contract's attribute cap: levels past it are lost. */
export const MAX_ATTRIBUTE_LEVEL = nativeRuleConstants.ATTRIBUTE_CAP;

/** Whether an army can take a new offer, as the contract checks: none waiting, and an attribute below the cap. */
export const canReceiveOffer = (progress: ArmyProgressFacts): boolean =>
  progress.pending === null &&
  [progress.battle, progress.logistics, progress.scouting, progress.support].some(
    (level) => level < MAX_ATTRIBUTE_LEVEL,
  );

/** The army's level in one attribute. */
export const attributeLevel = (progress: ArmyProgressFacts, attribute: Attribute): number =>
  ({
    Battle: progress.battle,
    Logistics: progress.logistics,
    Scouting: progress.scouting,
    Support: progress.support,
  })[attribute];

/**
 * How far an army is into its level, where level L costs `level_step_xp × L`. While an offer waits, XP keeps banking
 * past the threshold and the level holds, so the bar stops at full.
 */
export const levelProgress = (progress: Pick<ArmyProgressFacts, "level" | "xp">, rules: ProgressionRulesFacts) => {
  const needed = rules.level_step_xp * progress.level;
  return { into: Math.min(progress.xp, needed), needed };
};

/**
 * The picks banked behind an army's waiting offer (backend shapes v6): that offer already spent its level's threshold,
 * and the XP it keeps earning meanwhile buys one more level and offer per threshold it covers, each claimed after the
 * pick before it.
 */
export const bankedPicks = (
  progress: Pick<ArmyProgressFacts, "level" | "xp">,
  rules: ProgressionRulesFacts,
): number => {
  let picks = 0;
  let xp = progress.xp;
  for (let level = progress.level; xp >= rules.level_step_xp * level; level += 1) {
    xp -= rules.level_step_xp * level;
    picks += 1;
  }
  return picks;
};

/** The XP an army earned between two readings, across however many levels it crossed; a pick alone earns none. */
export const xpGained = (
  before: Pick<ArmyProgressFacts, "level" | "xp">,
  after: Pick<ArmyProgressFacts, "level" | "xp">,
  rules: ProgressionRulesFacts,
): number => {
  if (after.level === before.level) return after.xp - before.xp;
  let gained = levelProgress(before, rules).needed - before.xp + after.xp;
  for (let level = before.level + 1; level < after.level; level += 1) gained += rules.level_step_xp * level;
  return gained;
};

/** What changed in an army's progress between two readings: the XP it earned and the levels it gained. */
export const progressChange = (
  before: Pick<ArmyProgressFacts, "level" | "xp">,
  after: Pick<ArmyProgressFacts, "level" | "xp">,
  rules: ProgressionRulesFacts,
) => ({ xp: xpGained(before, after, rules), levels: after.level - before.level });

/** Where a chosen attribute's card lands: the army's attribute badge. */
export const attributeBadgeTarget = (explorerId: number): string => `attributes-${explorerId}`;

/**
 * Each attribute's glyph and what one level of it gives, as the contract's constants apply it: damage in percent,
 * stamina, camp and rift odds in points, and the home realm's production in percent for the day.
 */
export const ATTRIBUTE_LOOK: Record<Attribute, { glyph: string; perLevel: { value: number; unit: "%" | "" } }> = {
  Battle: {
    glyph: "/images/frontier/attributes/battle.svg",
    perLevel: { value: nativeRuleConstants.ATTRIBUTE_DAMAGE_PERCENT, unit: "%" },
  },
  Logistics: {
    glyph: "/images/frontier/attributes/logistics.svg",
    perLevel: { value: nativeRuleConstants.ATTRIBUTE_STAMINA, unit: "" },
  },
  Scouting: {
    glyph: "/images/frontier/attributes/scouting.svg",
    perLevel: { value: nativeRuleConstants.ATTRIBUTE_SCOUTING_BPS / 100, unit: "" },
  },
  Support: {
    glyph: "/images/frontier/attributes/support.svg",
    perLevel: { value: nativeRuleConstants.ATTRIBUTE_SUPPORT_PERCENT, unit: "%" },
  },
};

const gain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** What taking `levels` more of an attribute gives, "+20%" or "+1.5". */
export const attributeGain = (attribute: Attribute, levels: number): string => {
  const { perLevel } = ATTRIBUTE_LOOK[attribute];
  return `+${gain.format(levels * perLevel.value)}${perLevel.unit}`;
};
