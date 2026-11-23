import type { NativeRows } from "@bibliothecadao/eternum/game-client";

type Progress = NativeRows["ArmyProgress"];

export const explorerTransferPlan = ({
  sourceCount,
  targetCount,
  targetCap,
  sourceProgress,
  targetProgress,
}: {
  sourceCount: number;
  targetCount: number;
  targetCap: number | null;
  sourceProgress?: Progress;
  targetProgress?: Progress;
}) => {
  const known = sourceProgress !== undefined && targetProgress !== undefined;
  return {
    known,
    confirmLoss:
      known &&
      (sourceProgress.logistics > targetProgress.logistics ||
        sourceProgress.oath_slots > targetProgress.oath_slots ||
        sourceProgress.oaths !== 0),
    fullFits: known && targetCap !== null && sourceCount + targetCount <= targetCap,
    partialMax: Math.min(Math.max(0, sourceCount - 1), Math.max(0, (targetCap ?? 0) - targetCount)),
  };
};
