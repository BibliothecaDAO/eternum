export function getMinEffectCleanupDelayMs(effectStartedAtMs: number, nowMs: number, minimumVisibleMs: number): number {
  if (minimumVisibleMs <= 0) {
    return 0;
  }

  const elapsedMs = Math.max(0, nowMs - effectStartedAtMs);
  return Math.max(0, minimumVisibleMs - elapsedMs);
}
