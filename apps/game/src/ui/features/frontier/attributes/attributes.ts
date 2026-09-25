import { Eye, Flag, Footprints, Swords } from "@/ui/design-system/atoms/game-icons";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

/** An army's progress, its pending offer and the game's XP rules, exactly as the native store carries them. */
export type ArmyProgressFacts = NativeRows["ArmyProgress"];
export type AttributeOfferFacts = NonNullable<ArmyProgressFacts["pending"]>;
export type Attribute = AttributeOfferFacts["choices"][number];
export type ProgressionRulesFacts = NativeRows["ArmyProgressionRules"];

export const ATTRIBUTES: readonly Attribute[] = ["Battle", "Logistics", "Scouting", "Support"];

export const MAX_ATTRIBUTE_LEVEL = 5;

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

/** Each attribute's icon and its effect in one line (design §3.4). */
export const ATTRIBUTE_LOOK: Record<Attribute, { icon: typeof Swords; effect: string }> = {
  Battle: { icon: Swords, effect: "+10% damage dealt a level" },
  Logistics: { icon: Footprints, effect: "+30 max stamina a level" },
  Scouting: { icon: Eye, effect: "+1.5 points on camp and rift odds a level" },
  Support: { icon: Flag, effect: "+10% realm production a level, until midnight" },
};
