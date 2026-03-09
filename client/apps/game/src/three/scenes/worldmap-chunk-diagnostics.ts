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
  | "terrain_candidate_built"
  | "terrain_candidate_rejected"
  | "terrain_candidate_promoted"
  | "terrain_cache_reuse_attempted"
  | "terrain_cache_reuse_rejected"
  | "terrain_reconcile_requested"
  | "terrain_reconcile_dropped_stale"
  | "terrain_fallback_recovery_started"
  | "switch_duration_recorded"
  | "manager_duration_recorded";

export type WorldmapRefreshRequestSource =
  | "controls_change"
  | "pending_movement_fallback"
  | "pending_movement_selection"
  | "duplicate_tile"
  | "remove_explored"
  | "structure_bounds"
  | "perf_simulation"
  | "unknown";

export type WorldmapRefreshRequestSourceCounts = Record<WorldmapRefreshRequestSource, number>;

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
  forcedRefreshRequested: number;
  refreshRequestedBySource: WorldmapRefreshRequestSourceCounts;
  refreshExecuted: number;
  refreshSuperseded: number;
  duplicateTileCacheInvalidated: number;
  duplicateTileReconcileRequested: number;
  terrainCandidateBuilt: number;
  terrainCandidateRejected: number;
  terrainCandidatePromoted: number;
  terrainCacheReuseAttempted: number;
  terrainCacheReuseRejected: number;
  terrainReconcileRequested: number;
  terrainReconcileDroppedStale: number;
  terrainFallbackRecoveryStarted: number;
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
  source?: WorldmapRefreshRequestSource;
  force?: boolean;
}

const MAX_DURATION_SAMPLES = 512;

function createRefreshRequestSourceCounts(): WorldmapRefreshRequestSourceCounts {
  return {
    controls_change: 0,
    pending_movement_fallback: 0,
    pending_movement_selection: 0,
    duplicate_tile: 0,
    remove_explored: 0,
    structure_bounds: 0,
    perf_simulation: 0,
    unknown: 0,
  };
}

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
    forcedRefreshRequested: 0,
    refreshRequestedBySource: createRefreshRequestSourceCounts(),
    refreshExecuted: 0,
    refreshSuperseded: 0,
    duplicateTileCacheInvalidated: 0,
    duplicateTileReconcileRequested: 0,
    terrainCandidateBuilt: 0,
    terrainCandidateRejected: 0,
    terrainCandidatePromoted: 0,
    terrainCacheReuseAttempted: 0,
    terrainCacheReuseRejected: 0,
    terrainReconcileRequested: 0,
    terrainReconcileDroppedStale: 0,
    terrainFallbackRecoveryStarted: 0,
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
      if (options?.force) {
        diagnostics.forcedRefreshRequested += 1;
      }
      diagnostics.refreshRequestedBySource[options?.source ?? "unknown"] += 1;
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
    case "terrain_candidate_built":
      diagnostics.terrainCandidateBuilt += 1;
      break;
    case "terrain_candidate_rejected":
      diagnostics.terrainCandidateRejected += 1;
      break;
    case "terrain_candidate_promoted":
      diagnostics.terrainCandidatePromoted += 1;
      break;
    case "terrain_cache_reuse_attempted":
      diagnostics.terrainCacheReuseAttempted += 1;
      break;
    case "terrain_cache_reuse_rejected":
      diagnostics.terrainCacheReuseRejected += 1;
      break;
    case "terrain_reconcile_requested":
      diagnostics.terrainReconcileRequested += 1;
      break;
    case "terrain_reconcile_dropped_stale":
      diagnostics.terrainReconcileDroppedStale += 1;
      break;
    case "terrain_fallback_recovery_started":
      diagnostics.terrainFallbackRecoveryStarted += 1;
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
