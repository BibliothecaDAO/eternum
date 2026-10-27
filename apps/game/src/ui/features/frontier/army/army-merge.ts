import { heldSkillPoints } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { attributeTiers } from "@/ui/features/frontier/attributes/attributes";

type Progress = NativeRows["ArmyProgress"];
type Rules = NativeRows["ArmyProgressionRules"];

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
  const sourceValue = sourceProgress && rules ? sourceProgress.xp : undefined;
  const targetValue = targetProgress && rules ? targetProgress.xp : undefined;
  const confirmLoss = !!(
    sourceProgress &&
    targetProgress &&
    rules &&
    (sourceProgress.xp - targetProgress.xp >= rules.common_xp ||
      attributeTiers(sourceProgress).some((rank, index) => rank > attributeTiers(targetProgress)[index]!) ||
      heldSkillPoints(sourceProgress).some((count, index) => count > heldSkillPoints(targetProgress)[index]!))
  );
  const total = sourceCount + targetCount;
  const fullFits = known && targetCap !== null && total <= targetCap;
  const partialMax = Math.min(Math.max(0, sourceCount - 1), Math.max(0, (targetCap ?? 0) - targetCount));
  return {
    known,
    confirmLoss,
    sourceValue,
    targetValue,
    partialMax,
    fullFits,
  };
};
