type EntryOverlayPhase = "handoff" | "scene_warmup" | "slow" | "timed_out" | "ready";

export const getSceneWarmupProgress = (elapsedMs: number): number => {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 82;
  const bounded = Math.min(1, elapsedMs / 10_000);
  const progress = 82 + Math.round(13 * Math.sqrt(bounded));
  return Math.min(95, Math.max(82, progress));
};

export const resolveEntryOverlayPhase = ({
  isReady,
  hasNavigated,
  isSlow,
  didSafetyTimeout,
}: {
  isReady: boolean;
  hasNavigated: boolean;
  isSlow: boolean;
  didSafetyTimeout: boolean;
}): EntryOverlayPhase => {
  if (isReady) return "ready";
  if (didSafetyTimeout) return "timed_out";
  if (!hasNavigated) return "handoff";
  if (isSlow) return "slow";
  return "scene_warmup";
};
