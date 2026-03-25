const MIN_STALE_EXECUTION_THRESHOLD_MS = 90_000;

export const DEFAULT_TURN_TIMEOUT_MS = 45_000;

export function resolveTurnTimeoutMs(
  runtimeConfig: Record<string, unknown> | null | undefined,
  envDefault: number | undefined,
): number {
  if (typeof runtimeConfig?.turnTimeoutMs === "number" && runtimeConfig.turnTimeoutMs > 0) {
    return runtimeConfig.turnTimeoutMs;
  }

  if (typeof envDefault === "number" && Number.isFinite(envDefault) && envDefault > 0) {
    return envDefault;
  }

  return DEFAULT_TURN_TIMEOUT_MS;
}

export function resolveStaleExecutionThresholdMs(turnTimeoutMs: number): number {
  return Math.max(turnTimeoutMs * 2, MIN_STALE_EXECUTION_THRESHOLD_MS);
}
