export type DebugCycleProgressOverride = number | null;

const MIN_CYCLE_PROGRESS = 0;
const MAX_CYCLE_PROGRESS = 100;

export const clampCycleProgress = (progress: number): number => {
  if (!Number.isFinite(progress)) {
    return MIN_CYCLE_PROGRESS;
  }

  return Math.min(Math.max(progress, MIN_CYCLE_PROGRESS), MAX_CYCLE_PROGRESS);
};

export const resolveDebuggableCycleProgress = (
  liveProgress: number,
  debugOverride: DebugCycleProgressOverride,
): number => clampCycleProgress(debugOverride ?? liveProgress);
