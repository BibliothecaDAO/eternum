export const WORLDMAP_CHUNK_DIAGNOSTICS_CONTRACT_VERSION = 2;

export type WorldmapChunkDiagnosticsEvent =
  | "transition_started"
  | "transition_committed"
  | "transition_rolled_back"
  | "transition_prepare_stale_dropped"
  | "manager_update_started"
  | "manager_update_skipped_stale"
  | "manager_update_failed"
  | "critical_manager_catch_up_started"
  | "critical_manager_catch_up_failed"
  | "projection_sync_started"
  | "projection_sync_succeeded"
  | "projection_sync_failed"
  | "prefetch_queued"
  | "prefetch_skipped"
  | "prefetch_executed"
  | "refresh_requested"
  | "refresh_executed"
  | "refresh_superseded"
  | "switch_duration_recorded"
  | "terrain_source_ready_duration_recorded"
  | "terrain_commit_duration_recorded"
  | "terrain_first_complete_page_duration_recorded"
  | "terrain_window_convergence_duration_recorded"
  | "terrain_first_rendered_frame_duration_recorded"
  | "manager_duration_recorded"
  | "manager_catch_up_duration_recorded"
  | "critical_manager_catch_up_duration_recorded"
  | "prepared_chunk_prewarm_hit"
  | "prepared_chunk_prewarm_miss"
  | "terrain_window_converged"
  | "refresh_reason_default"
  | "refresh_reason_hydrated_chunk"
  | "stale_terrain_refresh_dropped"
  | "terrain_bounds_recovery"
  | "cache_reject_fingerprint";

export interface WorldmapChunkDiagnostics {
  contractVersion: typeof WORLDMAP_CHUNK_DIAGNOSTICS_CONTRACT_VERSION;
  transitionStarted: number;
  transitionCommitted: number;
  transitionRolledBack: number;
  transitionPrepareStaleDropped: number;
  managerUpdateStarted: number;
  managerUpdateSkippedStale: number;
  managerUpdateFailed: number;
  criticalManagerCatchUpStarted: number;
  criticalManagerCatchUpFailed: number;
  projectionSyncStarted: number;
  projectionSyncSucceeded: number;
  projectionSyncFailed: number;
  prefetchQueued: number;
  prefetchSkipped: number;
  prefetchExecuted: number;
  refreshRequested: number;
  refreshExecuted: number;
  refreshSuperseded: number;
  terrainWindowConverged: number;
  refreshReasonDefault: number;
  refreshReasonHydratedChunk: number;
  staleTerrainRefreshDropped: number;
  terrainBoundsRecovery: number;
  cacheRejectFingerprint: number;
  switchDurationMsTotal: number;
  switchDurationMsMax: number;
  switchDurationMsSamples: number[];
  terrainSourceReadyDurationMsTotal: number;
  terrainSourceReadyDurationMsMax: number;
  terrainSourceReadyDurationMsSamples: number[];
  terrainCommitDurationMsTotal: number;
  terrainCommitDurationMsMax: number;
  terrainCommitDurationMsSamples: number[];
  terrainFirstCompletePageDurationMsTotal: number;
  terrainFirstCompletePageDurationMsMax: number;
  terrainFirstCompletePageDurationMsSamples: number[];
  terrainWindowConvergenceDurationMsTotal: number;
  terrainWindowConvergenceDurationMsMax: number;
  terrainWindowConvergenceDurationMsSamples: number[];
  terrainFirstRenderedFrameDurationMsTotal: number;
  terrainFirstRenderedFrameDurationMsMax: number;
  terrainFirstRenderedFrameDurationMsSamples: number[];
  managerDurationMsTotal: number;
  managerDurationMsMax: number;
  managerDurationMsSamples: number[];
  managerCatchUpDurationMsTotal: number;
  managerCatchUpDurationMsMax: number;
  managerCatchUpDurationMsSamples: number[];
  criticalManagerCatchUpDurationMsTotal: number;
  criticalManagerCatchUpDurationMsMax: number;
  criticalManagerCatchUpDurationMsSamples: number[];
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
    contractVersion: WORLDMAP_CHUNK_DIAGNOSTICS_CONTRACT_VERSION,
    transitionStarted: 0,
    transitionCommitted: 0,
    transitionRolledBack: 0,
    transitionPrepareStaleDropped: 0,
    managerUpdateStarted: 0,
    managerUpdateSkippedStale: 0,
    managerUpdateFailed: 0,
    criticalManagerCatchUpStarted: 0,
    criticalManagerCatchUpFailed: 0,
    projectionSyncStarted: 0,
    projectionSyncSucceeded: 0,
    projectionSyncFailed: 0,
    prefetchQueued: 0,
    prefetchSkipped: 0,
    prefetchExecuted: 0,
    refreshRequested: 0,
    refreshExecuted: 0,
    refreshSuperseded: 0,
    terrainWindowConverged: 0,
    refreshReasonDefault: 0,
    refreshReasonHydratedChunk: 0,
    staleTerrainRefreshDropped: 0,
    terrainBoundsRecovery: 0,
    cacheRejectFingerprint: 0,
    switchDurationMsTotal: 0,
    switchDurationMsMax: 0,
    switchDurationMsSamples: [],
    terrainSourceReadyDurationMsTotal: 0,
    terrainSourceReadyDurationMsMax: 0,
    terrainSourceReadyDurationMsSamples: [],
    terrainCommitDurationMsTotal: 0,
    terrainCommitDurationMsMax: 0,
    terrainCommitDurationMsSamples: [],
    terrainFirstCompletePageDurationMsTotal: 0,
    terrainFirstCompletePageDurationMsMax: 0,
    terrainFirstCompletePageDurationMsSamples: [],
    terrainWindowConvergenceDurationMsTotal: 0,
    terrainWindowConvergenceDurationMsMax: 0,
    terrainWindowConvergenceDurationMsSamples: [],
    terrainFirstRenderedFrameDurationMsTotal: 0,
    terrainFirstRenderedFrameDurationMsMax: 0,
    terrainFirstRenderedFrameDurationMsSamples: [],
    managerDurationMsTotal: 0,
    managerDurationMsMax: 0,
    managerDurationMsSamples: [],
    managerCatchUpDurationMsTotal: 0,
    managerCatchUpDurationMsMax: 0,
    managerCatchUpDurationMsSamples: [],
    criticalManagerCatchUpDurationMsTotal: 0,
    criticalManagerCatchUpDurationMsMax: 0,
    criticalManagerCatchUpDurationMsSamples: [],
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

function resolveDuration(options: WorldmapChunkDiagnosticsEventOptions | undefined): number | null {
  const durationMs = options?.durationMs;
  return typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : null;
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
    case "critical_manager_catch_up_started":
      diagnostics.criticalManagerCatchUpStarted += 1;
      break;
    case "critical_manager_catch_up_failed":
      diagnostics.criticalManagerCatchUpFailed += 1;
      break;
    case "projection_sync_started":
      diagnostics.projectionSyncStarted += 1;
      break;
    case "projection_sync_succeeded":
      diagnostics.projectionSyncSucceeded += 1;
      break;
    case "projection_sync_failed":
      diagnostics.projectionSyncFailed += 1;
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
    case "prepared_chunk_prewarm_hit":
      diagnostics.preparedChunkPrewarmHit += 1;
      break;
    case "prepared_chunk_prewarm_miss":
      diagnostics.preparedChunkPrewarmMiss += 1;
      break;
    case "terrain_window_converged":
      diagnostics.terrainWindowConverged += 1;
      break;
    case "refresh_reason_default":
      diagnostics.refreshReasonDefault += 1;
      break;
    case "refresh_reason_hydrated_chunk":
      diagnostics.refreshReasonHydratedChunk += 1;
      break;
    case "stale_terrain_refresh_dropped":
      diagnostics.staleTerrainRefreshDropped += 1;
      break;
    case "terrain_bounds_recovery":
      diagnostics.terrainBoundsRecovery += 1;
      break;
    case "cache_reject_fingerprint":
      diagnostics.cacheRejectFingerprint += 1;
      break;
    case "switch_duration_recorded": {
      const durationMs = resolveDuration(options);
      if (durationMs === null) break;
      diagnostics.switchDurationMsTotal += durationMs;
      diagnostics.switchDurationMsMax = Math.max(diagnostics.switchDurationMsMax, durationMs);
      recordDurationSample(diagnostics.switchDurationMsSamples, durationMs);
      break;
    }
    case "terrain_source_ready_duration_recorded": {
      const durationMs = resolveDuration(options);
      if (durationMs === null) break;
      diagnostics.terrainSourceReadyDurationMsTotal += durationMs;
      diagnostics.terrainSourceReadyDurationMsMax = Math.max(diagnostics.terrainSourceReadyDurationMsMax, durationMs);
      recordDurationSample(diagnostics.terrainSourceReadyDurationMsSamples, durationMs);
      break;
    }
    case "terrain_commit_duration_recorded": {
      const durationMs = resolveDuration(options);
      if (durationMs === null) break;
      diagnostics.terrainCommitDurationMsTotal += durationMs;
      diagnostics.terrainCommitDurationMsMax = Math.max(diagnostics.terrainCommitDurationMsMax, durationMs);
      recordDurationSample(diagnostics.terrainCommitDurationMsSamples, durationMs);
      break;
    }
    case "terrain_first_complete_page_duration_recorded": {
      const durationMs = resolveDuration(options);
      if (durationMs === null) break;
      diagnostics.terrainFirstCompletePageDurationMsTotal += durationMs;
      diagnostics.terrainFirstCompletePageDurationMsMax = Math.max(
        diagnostics.terrainFirstCompletePageDurationMsMax,
        durationMs,
      );
      recordDurationSample(diagnostics.terrainFirstCompletePageDurationMsSamples, durationMs);
      break;
    }
    case "terrain_window_convergence_duration_recorded": {
      const durationMs = resolveDuration(options);
      if (durationMs === null) break;
      diagnostics.terrainWindowConvergenceDurationMsTotal += durationMs;
      diagnostics.terrainWindowConvergenceDurationMsMax = Math.max(
        diagnostics.terrainWindowConvergenceDurationMsMax,
        durationMs,
      );
      recordDurationSample(diagnostics.terrainWindowConvergenceDurationMsSamples, durationMs);
      break;
    }
    case "terrain_first_rendered_frame_duration_recorded": {
      const durationMs = resolveDuration(options);
      if (durationMs === null) break;
      diagnostics.terrainFirstRenderedFrameDurationMsTotal += durationMs;
      diagnostics.terrainFirstRenderedFrameDurationMsMax = Math.max(
        diagnostics.terrainFirstRenderedFrameDurationMsMax,
        durationMs,
      );
      recordDurationSample(diagnostics.terrainFirstRenderedFrameDurationMsSamples, durationMs);
      break;
    }
    case "manager_duration_recorded": {
      const durationMs = resolveDuration(options);
      if (durationMs === null) break;
      diagnostics.managerDurationMsTotal += durationMs;
      diagnostics.managerDurationMsMax = Math.max(diagnostics.managerDurationMsMax, durationMs);
      recordDurationSample(diagnostics.managerDurationMsSamples, durationMs);
      break;
    }
    case "manager_catch_up_duration_recorded": {
      const durationMs = resolveDuration(options);
      if (durationMs === null) break;
      diagnostics.managerCatchUpDurationMsTotal += durationMs;
      diagnostics.managerCatchUpDurationMsMax = Math.max(diagnostics.managerCatchUpDurationMsMax, durationMs);
      recordDurationSample(diagnostics.managerCatchUpDurationMsSamples, durationMs);
      break;
    }
    case "critical_manager_catch_up_duration_recorded": {
      const durationMs = resolveDuration(options);
      if (durationMs === null) break;
      diagnostics.criticalManagerCatchUpDurationMsTotal += durationMs;
      diagnostics.criticalManagerCatchUpDurationMsMax = Math.max(
        diagnostics.criticalManagerCatchUpDurationMsMax,
        durationMs,
      );
      recordDurationSample(diagnostics.criticalManagerCatchUpDurationMsSamples, durationMs);
      break;
    }
  }
}
