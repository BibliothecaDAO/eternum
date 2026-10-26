import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { attributeTiers, nextTierPrice } from "@/ui/features/frontier/attributes/attributes";

type Progress = NativeRows["ArmyProgress"];
type Rules = NativeRows["ArmyProgressionRules"];

/** Includes trained tiers: the value of the progress kept, not a history of personally earned XP. */
export const progressionValue = (progress: Progress, rules: Rules): number =>
  attributeTiers(progress).reduce((value, tier) => {
    for (let at = 1; at < tier; at++) value += nextTierPrice(rules, at)!;
    return value;
  }, progress.xp);

/** Every transfer keeps the chosen target, within that army's capacity. */
export const explorerTransferPlan = ({
  sourceCount,
  targetCount,
  targetCap,
  sourceProgress,
  targetProgress,
  rules,
}: {
  sourceCount: number;
  targetCount: number;
  targetCap: number | null;
  sourceProgress?: Progress;
  targetProgress?: Progress;
  rules?: Rules;
}) => {
  const known = !!(sourceProgress && targetProgress && rules);
  const sourceValue = sourceProgress && rules ? progressionValue(sourceProgress, rules) : undefined;
  const targetValue = targetProgress && rules ? progressionValue(targetProgress, rules) : undefined;
  // A first upgrade's worth of extra progression is a meaningful loss; tiny gaps need no extra click.
  const confirmLoss =
    sourceValue !== undefined &&
    targetValue !== undefined &&
    rules !== undefined &&
    sourceValue > targetValue &&
    sourceValue - targetValue >= rules.uncommon_xp;
  const total = sourceCount + targetCount;
  const fullFits = known && targetCap !== null && total <= targetCap;
  const partialMax = Math.min(Math.max(0, sourceCount - 1), Math.max(0, (targetCap ?? 0) - targetCount));
  return {
    known,
    confirmLoss,
    sourceValue,
    partialMax,
    fullFits,
  };
};
