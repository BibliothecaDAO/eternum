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
  | "terrain_ready_duration_recorded"
  | "terrain_commit_duration_recorded"
  | "first_visible_commit_duration_recorded"
  | "manager_duration_recorded"
  | "manager_catch_up_duration_recorded"
  | "prepared_chunk_prewarm_hit"
  | "prepared_chunk_prewarm_miss"
  | "terrain_visible_commit"
  | "refresh_reason_default"
  | "refresh_reason_hydrated_chunk"
  | "refresh_reason_duplicate_tile"
  | "refresh_reason_tile_overlap_repair"
  | "duplicate_tile_reconcile_mode_invalidate_only"
  | "duplicate_tile_reconcile_mode_local_reconcile"
  | "duplicate_tile_reconcile_mode_atomic_refresh"
  | "stale_terrain_refresh_dropped"
  | "terrain_bounds_recovery"
  | "tile_hydration_drain_completed"
  | "cache_reject_fingerprint";

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
  terrainVisibleCommit: number;
  refreshReasonDefault: number;
  refreshReasonHydratedChunk: number;
  refreshReasonDuplicateTile: number;
  refreshReasonTileOverlapRepair: number;
  duplicateTileReconcileModeInvalidateOnly: number;
  duplicateTileReconcileModeLocalReconcile: number;
  duplicateTileReconcileModeAtomicRefresh: number;
  staleTerrainRefreshDropped: number;
  terrainBoundsRecovery: number;
  tileHydrationDrainCompleted: number;
  cacheRejectFingerprint: number;
  switchDurationMsTotal: number;
  switchDurationMsMax: number;
  switchDurationMsSamples: number[];
  terrainReadyDurationMsTotal: number;
  terrainReadyDurationMsMax: number;
  terrainReadyDurationMsSamples: number[];
  terrainCommitDurationMsTotal: number;
  terrainCommitDurationMsMax: number;
  terrainCommitDurationMsSamples: number[];
  firstVisibleCommitDurationMsTotal: number;
  firstVisibleCommitDurationMsMax: number;
  firstVisibleCommitDurationMsSamples: number[];
  managerDurationMsTotal: number;
  managerDurationMsMax: number;
  managerDurationMsSamples: number[];
  managerCatchUpDurationMsTotal: number;
  managerCatchUpDurationMsMax: number;
  managerCatchUpDurationMsSamples: number[];
  preparedChunkPrewarmHit: number;
  preparedChunkPrewarmMiss: number;
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
    terrainVisibleCommit: 0,
    refreshReasonDefault: 0,
    refreshReasonHydratedChunk: 0,
    refreshReasonDuplicateTile: 0,
    refreshReasonTileOverlapRepair: 0,
    duplicateTileReconcileModeInvalidateOnly: 0,
    duplicateTileReconcileModeLocalReconcile: 0,
    duplicateTileReconcileModeAtomicRefresh: 0,
    staleTerrainRefreshDropped: 0,
    terrainBoundsRecovery: 0,
    tileHydrationDrainCompleted: 0,
    cacheRejectFingerprint: 0,
    switchDurationMsTotal: 0,
    switchDurationMsMax: 0,
    switchDurationMsSamples: [],
    terrainReadyDurationMsTotal: 0,
    terrainReadyDurationMsMax: 0,
    terrainReadyDurationMsSamples: [],
    terrainCommitDurationMsTotal: 0,
    terrainCommitDurationMsMax: 0,
    terrainCommitDurationMsSamples: [],
    firstVisibleCommitDurationMsTotal: 0,
    firstVisibleCommitDurationMsMax: 0,
    firstVisibleCommitDurationMsSamples: [],
    managerDurationMsTotal: 0,
    managerDurationMsMax: 0,
    managerDurationMsSamples: [],
    managerCatchUpDurationMsTotal: 0,
    managerCatchUpDurationMsMax: 0,
    managerCatchUpDurationMsSamples: [],
    preparedChunkPrewarmHit: 0,
    preparedChunkPrewarmMiss: 0,
    updatedAtMs: Date.now(),
  };
}

function recordDurationSample(samples: number[], durationMs: number): number[] {
  samples.push(durationMs);
  if (samples.length > MAX_DURATION_SAMPLES) {
    samples.shift();
  }
  return samples;
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
    case "prepared_chunk_prewarm_hit":
      diagnostics.preparedChunkPrewarmHit += 1;
      break;
    case "prepared_chunk_prewarm_miss":
      diagnostics.preparedChunkPrewarmMiss += 1;
      break;
    case "terrain_visible_commit":
      diagnostics.terrainVisibleCommit += 1;
      break;
    case "refresh_reason_default":
      diagnostics.refreshReasonDefault += 1;
      break;
    case "refresh_reason_hydrated_chunk":
      diagnostics.refreshReasonHydratedChunk += 1;
      break;
    case "refresh_reason_duplicate_tile":
      diagnostics.refreshReasonDuplicateTile += 1;
      break;
    case "refresh_reason_tile_overlap_repair":
      diagnostics.refreshReasonTileOverlapRepair += 1;
      break;
    case "duplicate_tile_reconcile_mode_invalidate_only":
      diagnostics.duplicateTileReconcileModeInvalidateOnly += 1;
      break;
    case "duplicate_tile_reconcile_mode_local_reconcile":
      diagnostics.duplicateTileReconcileModeLocalReconcile += 1;
      break;
    case "duplicate_tile_reconcile_mode_atomic_refresh":
      diagnostics.duplicateTileReconcileModeAtomicRefresh += 1;
      break;
    case "stale_terrain_refresh_dropped":
      diagnostics.staleTerrainRefreshDropped += 1;
      break;
    case "terrain_bounds_recovery":
      diagnostics.terrainBoundsRecovery += 1;
      break;
    case "tile_hydration_drain_completed":
      diagnostics.tileHydrationDrainCompleted += 1;
      break;
    case "cache_reject_fingerprint":
      diagnostics.cacheRejectFingerprint += 1;
      break;
    case "switch_duration_recorded": {
      const durationMs = options?.durationMs ?? 0;
      diagnostics.switchDurationMsTotal += durationMs;
      diagnostics.switchDurationMsMax = Math.max(diagnostics.switchDurationMsMax, durationMs);
      recordDurationSample(diagnostics.switchDurationMsSamples, durationMs);
      break;
    }
    case "terrain_ready_duration_recorded": {
      const durationMs = options?.durationMs ?? 0;
      diagnostics.terrainReadyDurationMsTotal += durationMs;
      diagnostics.terrainReadyDurationMsMax = Math.max(diagnostics.terrainReadyDurationMsMax, durationMs);
      recordDurationSample(diagnostics.terrainReadyDurationMsSamples, durationMs);
      break;
    }
    case "terrain_commit_duration_recorded": {
      const durationMs = options?.durationMs ?? 0;
      diagnostics.terrainCommitDurationMsTotal += durationMs;
      diagnostics.terrainCommitDurationMsMax = Math.max(diagnostics.terrainCommitDurationMsMax, durationMs);
      recordDurationSample(diagnostics.terrainCommitDurationMsSamples, durationMs);
      break;
    }
    case "first_visible_commit_duration_recorded": {
      const durationMs = options?.durationMs ?? 0;
      diagnostics.firstVisibleCommitDurationMsTotal += durationMs;
      diagnostics.firstVisibleCommitDurationMsMax = Math.max(diagnostics.firstVisibleCommitDurationMsMax, durationMs);
      recordDurationSample(diagnostics.firstVisibleCommitDurationMsSamples, durationMs);
      break;
    }
    case "manager_duration_recorded": {
      const durationMs = options?.durationMs ?? 0;
      diagnostics.managerDurationMsTotal += durationMs;
      diagnostics.managerDurationMsMax = Math.max(diagnostics.managerDurationMsMax, durationMs);
      recordDurationSample(diagnostics.managerDurationMsSamples, durationMs);
      break;
    }
    case "manager_catch_up_duration_recorded": {
      const durationMs = options?.durationMs ?? 0;
      diagnostics.managerCatchUpDurationMsTotal += durationMs;
      diagnostics.managerCatchUpDurationMsMax = Math.max(diagnostics.managerCatchUpDurationMsMax, durationMs);
      recordDurationSample(diagnostics.managerCatchUpDurationMsSamples, durationMs);
      break;
    }
  }
}
