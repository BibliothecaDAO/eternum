import type { GameSyncRuntimeMetrics } from "@bibliothecadao/eternum/game-sync";

interface SyncMetricsWindow {
  __eternumSyncMetrics?: GameSyncRuntimeMetrics;
}

/**
 * `?dev` mirror of the sync runtime counters: live rows received vs component writes applied (the L1
 * amplification ratio), batch apply times, recovery duration. Read it as `window.__eternumSyncMetrics`.
 */
export const publishSyncMetrics = (metrics: GameSyncRuntimeMetrics): void => {
  if (typeof window === "undefined") return;
  (window as typeof window & SyncMetricsWindow).__eternumSyncMetrics = metrics;
};
