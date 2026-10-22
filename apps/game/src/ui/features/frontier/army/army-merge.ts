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

/** Partial transfers use the target's cap; a full merge uses the surviving army's cap. */
export const explorerTransferPlan = ({
  sourceCount,
  targetCount,
  sourceCap,
  targetCap,
  sourceProgress,
  targetProgress,
  rules,
  requiresProgress,
}: {
  sourceCount: number;
  targetCount: number;
  sourceCap: number | null;
  targetCap: number | null;
  sourceProgress?: Progress;
  targetProgress?: Progress;
  rules?: Rules;
  requiresProgress: boolean;
}) => {
  const known = !requiresProgress || !!(sourceProgress && targetProgress && rules);
  const sourceValue = sourceProgress && rules ? progressionValue(sourceProgress, rules) : undefined;
  const targetValue = targetProgress && rules ? progressionValue(targetProgress, rules) : undefined;
  const sourceWins = sourceValue !== undefined && targetValue !== undefined && sourceValue > targetValue;
  const survivorCap = sourceWins ? sourceCap : targetCap;
  const total = sourceCount + targetCount;
  const fullFits = known && survivorCap !== null && total <= survivorCap;
  const partialMax = Math.min(Math.max(0, sourceCount - 1), Math.max(0, (targetCap ?? 0) - targetCount));
  return {
    known,
    sourceWins,
    sourceValue,
    targetValue,
    survivorCap,
    maxAmount: known ? (fullFits ? sourceCount : partialMax) : 0,
    partialMax,
    fullFits,
  };
};
