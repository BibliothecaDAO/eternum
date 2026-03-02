const clampNonNegative = (value: number): number => Math.max(0, value);

const normalizeLiveLeft = (liveLeft: number | null | undefined): number | null => {
  if (liveLeft == null) {
    return null;
  }

  return clampNonNegative(liveLeft);
};

/**
 * Use the freshest live value when available; otherwise fallback to UI state.
 */
export const resolveForgeSeedRemaining = (uiLeft: number, liveLeft: number | null | undefined): number => {
  const normalizedLiveLeft = normalizeLiveLeft(liveLeft);
  if (normalizedLiveLeft != null) {
    return normalizedLiveLeft;
  }

  return clampNonNegative(uiLeft);
};

/**
 * During an active forge-all run, only trust downward sync from live data.
 * Upward adjustments are handled in the post-zero settle recheck phase.
 */
export const reconcileActiveForgeRemaining = (remaining: number, liveLeft: number | null | undefined): number => {
  const normalizedLiveLeft = normalizeLiveLeft(liveLeft);
  if (normalizedLiveLeft == null) {
    return clampNonNegative(remaining);
  }

  return Math.min(clampNonNegative(remaining), normalizedLiveLeft);
};
