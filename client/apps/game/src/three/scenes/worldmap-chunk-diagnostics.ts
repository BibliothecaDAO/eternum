export type WorldmapChunkDiagnosticsEvent =
  | "transition_started"
  | "transition_committed"
  | "transition_rolled_back"
  | "transition_prepare_stale_dropped"
  | "manager_update_started"
  | "manager_update_skipped_stale"
  | "manager_update_failed"
  | "tile_fetch_started"
  | "tile_fetch_succeeded"
  | "tile_fetch_failed"
  | "prefetch_queued"
  | "prefetch_skipped"
  | "prefetch_executed"
  | "bounds_switch_requested"
  | "bounds_switch_applied"
  | "bounds_switch_skipped_same_signature"
  | "bounds_switch_stale_dropped"
  | "bounds_switch_skipped_stale_token"
  | "bounds_switch_failed"
  | "refresh_requested"
  | "refresh_executed"
  | "refresh_superseded"
  | "duplicate_tile_cache_invalidated"
  | "duplicate_tile_reconcile_requested"
  | "switch_duration_recorded"
  | "manager_duration_recorded";

export interface WorldmapChunkDiagnostics {
  transitionStarted: number;
  transitionCommitted: number;
  transitionRolledBack: number;
  transitionPrepareStaleDropped: number;
  managerUpdateStarted: number;
  managerUpdateSkippedStale: number;
  managerUpdateFailed: number;
  tileFetchStarted: number;
  tileFetchSucceeded: number;
  tileFetchFailed: number;
  prefetchQueued: number;
  prefetchSkipped: number;
  prefetchExecuted: number;
  boundsSwitchRequested: number;
  boundsSwitchApplied: number;
  boundsSwitchSkippedSameSignature: number;
  boundsSwitchStaleDropped: number;
  boundsSwitchSkippedStaleToken: number;
  boundsSwitchFailed: number;
  refreshRequested: number;
  refreshExecuted: number;
  refreshSuperseded: number;
  duplicateTileCacheInvalidated: number;
  duplicateTileReconcileRequested: number;
  switchDurationMsTotal: number;
  switchDurationMsMax: number;
  switchDurationMsSamples: number[];
  managerDurationMsTotal: number;
  managerDurationMsMax: number;
  managerDurationMsSamples: number[];
  updatedAtMs: number;
}

interface WorldmapChunkDiagnosticsEventOptions {
  durationMs?: number;
}

const MAX_DURATION_SAMPLES = 512;

export function createWorldmapChunkDiagnostics(): WorldmapChunkDiagnostics {
  return {
    transitionStarted: 0,
    transitionCommitted: 0,
    transitionRolledBack: 0,
    transitionPrepareStaleDropped: 0,
    managerUpdateStarted: 0,
    managerUpdateSkippedStale: 0,
    managerUpdateFailed: 0,
    tileFetchStarted: 0,
    tileFetchSucceeded: 0,
    tileFetchFailed: 0,
    prefetchQueued: 0,
    prefetchSkipped: 0,
    prefetchExecuted: 0,
    boundsSwitchRequested: 0,
    boundsSwitchApplied: 0,
    boundsSwitchSkippedSameSignature: 0,
    boundsSwitchStaleDropped: 0,
    boundsSwitchSkippedStaleToken: 0,
    boundsSwitchFailed: 0,
    refreshRequested: 0,
    refreshExecuted: 0,
    refreshSuperseded: 0,
    duplicateTileCacheInvalidated: 0,
    duplicateTileReconcileRequested: 0,
    switchDurationMsTotal: 0,
    switchDurationMsMax: 0,
    switchDurationMsSamples: [],
    managerDurationMsTotal: 0,
    managerDurationMsMax: 0,
    managerDurationMsSamples: [],
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
    case "transition_prepare_stale_dropped":
      diagnostics.transitionPrepareStaleDropped += 1;
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
    case "bounds_switch_requested":
      diagnostics.boundsSwitchRequested += 1;
      break;
    case "bounds_switch_applied":
      diagnostics.boundsSwitchApplied += 1;
      break;
    case "bounds_switch_skipped_same_signature":
      diagnostics.boundsSwitchSkippedSameSignature += 1;
      break;
    case "bounds_switch_stale_dropped":
      diagnostics.boundsSwitchStaleDropped += 1;
      break;
    case "bounds_switch_skipped_stale_token":
      diagnostics.boundsSwitchSkippedStaleToken += 1;
      break;
    case "bounds_switch_failed":
      diagnostics.boundsSwitchFailed += 1;
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
    case "duplicate_tile_cache_invalidated":
      diagnostics.duplicateTileCacheInvalidated += 1;
      break;
    case "duplicate_tile_reconcile_requested":
      diagnostics.duplicateTileReconcileRequested += 1;
      break;
    case "switch_duration_recorded": {
      const durationMs = options?.durationMs ?? 0;
      diagnostics.switchDurationMsTotal += durationMs;
      diagnostics.switchDurationMsMax = Math.max(diagnostics.switchDurationMsMax, durationMs);
      diagnostics.switchDurationMsSamples.push(durationMs);
      if (diagnostics.switchDurationMsSamples.length > MAX_DURATION_SAMPLES) {
        diagnostics.switchDurationMsSamples.shift();
      }
      break;
    }
    case "manager_duration_recorded": {
      const durationMs = options?.durationMs ?? 0;
      diagnostics.managerDurationMsTotal += durationMs;
      diagnostics.managerDurationMsMax = Math.max(diagnostics.managerDurationMsMax, durationMs);
      diagnostics.managerDurationMsSamples.push(durationMs);
      if (diagnostics.managerDurationMsSamples.length > MAX_DURATION_SAMPLES) {
        diagnostics.managerDurationMsSamples.shift();
      }
      break;
    }
  }
}
