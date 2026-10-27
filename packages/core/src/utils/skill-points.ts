import { nativeRuleConstants, type NativeRows } from "../client";

export type SkillPointRank = 1 | 2 | 3 | 4 | 5;
export type SkillPointChoice =
  | { kind: "Battle" | "Logistics" | "Homecoming"; value: undefined }
  | { kind: "Scouting"; value: { kind: "Camp" | "Rift" | "Beasts"; value: undefined } }
  | { kind: "Stamina"; value: SkillPointRank };

type Progress = NativeRows["ArmyProgress"];
type Rules = NativeRows["ArmyProgressionRules"];

export const SKILL_POINT_RANKS: readonly SkillPointRank[] = [1, 2, 3, 4, 5];

export const heldSkillPoints = (progress: Progress): readonly number[] => [
  progress.common_points,
  progress.uncommon_points,
  progress.rare_points,
  progress.epic_points,
  progress.legendary_points,
];

export const lowestFittingPoint = (progress: Progress, nextRank: number): SkillPointRank | undefined => {
  const held = heldSkillPoints(progress);
  return SKILL_POINT_RANKS.find((rank) => rank >= nextRank && held[rank - 1]! > 0);
};

const skillPointThresholds = (rules: Rules): readonly number[] => [
  rules.common_xp,
  rules.uncommon_xp,
  rules.rare_xp,
  rules.epic_xp,
  rules.legendary_xp,
];

/** The next milestone stays visible after all sides reach V: points still recover stamina. */
export const nextSkillPoint = (
  xp: number,
  rules: Rules,
): { rank: SkillPointRank; at: number; from: number; share: number } => {
  const thresholds = skillPointThresholds(rules);
  const cycle = rules.legendary_xp;
  const base = Math.floor(xp / cycle) * cycle;
  const inCycle = xp % cycle;
  const index = thresholds.findIndex((at) => at > inCycle);
  if (index < 0 || cycle <= 0) throw new Error("Invalid skill point thresholds");
  const at = base + thresholds[index]!;
  const from = base + (index === 0 ? 0 : thresholds[index - 1]!);
  return { rank: (index + 1) as SkillPointRank, at, from, share: (xp - from) / (at - from) };
};

export const skillPointRefill = (rank: SkillPointRank, staminaOnly = false): number =>
  (nativeRuleConstants.SKILL_POINT_REFILL_BASE + rank * nativeRuleConstants.SKILL_POINT_REFILL_STEP) *
  (staminaOnly ? 2 : 1);
