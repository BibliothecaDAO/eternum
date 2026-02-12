export type WorldmapChunkDiagnosticsEvent =
  | "transition_started"
  | "transition_committed"
  | "transition_rolled_back"
  | "manager_update_started"
  | "manager_update_skipped_stale"
  | "manager_update_failed"
  | "tile_fetch_started"
  | "tile_fetch_succeeded"
  | "tile_fetch_failed"
  | "prefetch_queued"
  | "prefetch_skipped"
  | "prefetch_executed"
  | "refresh_requested"
  | "refresh_executed"
  | "refresh_superseded"
  | "switch_duration_recorded"
  | "manager_duration_recorded";

export interface WorldmapChunkDiagnostics {
  transitionStarted: number;
  transitionCommitted: number;
  transitionRolledBack: number;
  managerUpdateStarted: number;
  managerUpdateSkippedStale: number;
  managerUpdateFailed: number;
  tileFetchStarted: number;
  tileFetchSucceeded: number;
  tileFetchFailed: number;
  prefetchQueued: number;
  prefetchSkipped: number;
  prefetchExecuted: number;
  refreshRequested: number;
  refreshExecuted: number;
  refreshSuperseded: number;
  switchDurationMsTotal: number;
  switchDurationMsMax: number;
  managerDurationMsTotal: number;
  managerDurationMsMax: number;
  updatedAtMs: number;
}

interface WorldmapChunkDiagnosticsEventOptions {
  durationMs?: number;
}

export function createWorldmapChunkDiagnostics(): WorldmapChunkDiagnostics {
  return {
    transitionStarted: 0,
    transitionCommitted: 0,
    transitionRolledBack: 0,
    managerUpdateStarted: 0,
    managerUpdateSkippedStale: 0,
    managerUpdateFailed: 0,
    tileFetchStarted: 0,
    tileFetchSucceeded: 0,
    tileFetchFailed: 0,
    prefetchQueued: 0,
    prefetchSkipped: 0,
    prefetchExecuted: 0,
    refreshRequested: 0,
    refreshExecuted: 0,
    refreshSuperseded: 0,
    switchDurationMsTotal: 0,
    switchDurationMsMax: 0,
    managerDurationMsTotal: 0,
    managerDurationMsMax: 0,
    updatedAtMs: Date.now(),
  };
}

export function recordChunkDiagnosticsEvent(
  diagnostics: WorldmapChunkDiagnostics,
  event: WorldmapChunkDiagnosticsEvent,
  options?: WorldmapChunkDiagnosticsEventOptions,
): void {
  diagnostics.updatedAtMs = Date.now();

  switch (event) {
    case "transition_started":
      diagnostics.transitionStarted += 1;
      break;
    case "transition_committed":
      diagnostics.transitionCommitted += 1;
      break;
    case "transition_rolled_back":
      diagnostics.transitionRolledBack += 1;
      break;
    case "manager_update_started":
      diagnostics.managerUpdateStarted += 1;
      break;
    case "manager_update_skipped_stale":
      diagnostics.managerUpdateSkippedStale += 1;
      break;
    case "manager_update_failed":
      diagnostics.managerUpdateFailed += 1;
      break;
    case "tile_fetch_started":
      diagnostics.tileFetchStarted += 1;
      break;
    case "tile_fetch_succeeded":
      diagnostics.tileFetchSucceeded += 1;
      break;
    case "tile_fetch_failed":
      diagnostics.tileFetchFailed += 1;
      break;
    case "prefetch_queued":
      diagnostics.prefetchQueued += 1;
      break;
    case "prefetch_skipped":
      diagnostics.prefetchSkipped += 1;
      break;
    case "prefetch_executed":
      diagnostics.prefetchExecuted += 1;
      break;
    case "refresh_requested":
      diagnostics.refreshRequested += 1;
      break;
    case "refresh_executed":
      diagnostics.refreshExecuted += 1;
      break;
    case "refresh_superseded":
      diagnostics.refreshSuperseded += 1;
      break;
    case "switch_duration_recorded": {
      const durationMs = options?.durationMs ?? 0;
      diagnostics.switchDurationMsTotal += durationMs;
      diagnostics.switchDurationMsMax = Math.max(diagnostics.switchDurationMsMax, durationMs);
      break;
    }
    case "manager_duration_recorded": {
      const durationMs = options?.durationMs ?? 0;
      diagnostics.managerDurationMsTotal += durationMs;
      diagnostics.managerDurationMsMax = Math.max(diagnostics.managerDurationMsMax, durationMs);
      break;
    }
  }
}
