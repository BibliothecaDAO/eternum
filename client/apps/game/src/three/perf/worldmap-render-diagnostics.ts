const MAX_DURATION_SAMPLES = 512;

export type WorldmapRenderDurationMetric =
  | "updateVisibleChunks"
  | "performChunkSwitch"
  | "updateManagersForChunk"
  | "executeRenderForChunk"
  | "performVisibleStructuresUpdate"
  | "terrainPreparedMs"
  | "chunkTerrainReadyMs"
  | "chunkTerrainCommitMs"
  | "chunkManagerCatchUpMs"
  | "tileHydrationDrainMs"
  | "structureHydrationDrainMs"
  | "globalSpatialTileOptScanMs"
  | "structureAssetPrewarmMs"
  | "presentationCommittedMs"
  | "presentationSkewMs"
  | "workerFindPath"
  | "createPath";

export type WorldmapRenderGauge =
  | "activePaths"
  | "visibleArmies"
  | "visibleStructures"
  | "activeLabels"
  | "globalSpatialTileOptRecs"
  | "globalSpatialHydrationCandidates"
  | "spatialSubscriptionMinCol"
  | "spatialSubscriptionMaxCol"
  | "spatialSubscriptionMinRow"
  | "spatialSubscriptionMaxRow"
  | "spatialSubscriptionModelCount";
export type WorldmapRenderUploadMetric = "cachedChunkReplay";

export type WorldmapRenderCounter =
  | "workerFindPathCalls"
  | "workerFindPathBypasses"
  | "pathCreateCalls"
  | "controlsChangeEvents"
  | "chunkRefreshRequests"
  | "updateVisibleChunksCalls"
  | "zoomTransitionsStarted"
  | "zoomTransitionsCompleted"
  | "zoomTransitionsCancelled"
  | "terrainVisibleCommits"
  | "duplicateTileAuthoritativeUpdates"
  | "terrainVisibleOverlapRepairCount"
  | "terrainVisibleReplaceCount"
  | "terrainVisibleAppendCount"
  | "terrainVisibleRebuildCount"
  | "terrainShellStarted"
  | "terrainShellCommitted"
  | "terrainShellReplaced"
  | "terrainCompositeRebuilt"
  | "terrainShellStaleDropped"
  | "visualWindowResolved"
  | "visualPageQueued"
  | "visualPageBuilt"
  | "visualPageCommitted"
  | "visualPageReplaced"
  | "visualPageEvicted"
  | "visualPageStaleDropped"
  | "visualPageBudgetExhausted"
  | "staleTerrainCacheFingerprintRejectCount"
  | "preparedChunkPrewarmHits"
  | "preparedChunkPrewarmMisses"
  | "globalSpatialRecsHydratedTiles"
  | "globalSpatialRecsHydratedChests"
  | "globalSpatialRecsHydratedStructures"
  | "spatialBoundsSwitchRequests"
  | "spatialBoundsSwitchApplied"
  | "spatialBoundsSwitchSkipped"
  | "spatialBoundsSwitchFailures"
  | "spatialStreamUpdates"
  | "spatialTileOptRecsApplied"
  | "spatialTileOptReadyTimeouts"
  | "spatialTileOptStreamReceived"
  | "postCommitManagerCatchUpImmediate"
  | "postCommitManagerCatchUpDeferred"
  | "pendingArmyRemovalCancelledByTileRecovery"
  | "pendingArmyRemovalCancelledByDelete"
  | "pendingArmyRemovalCancelledBySuperseded"
  | "pendingArmyRemovalCancelledByExplorerTroopsZero"
  | "pendingArmyRemovalCancelledByExplorerTroopsLiveRecovery"
  | "pendingArmyRemovalCancelledByRecsSweep"
  | "armyAuthoritativeSweepConfirmedDead"
  | "armyAuthoritativeSweepReapplied"
  | "armyAuthoritativeSweepFailed"
  | "armyAuthoritativeSweepSlowOp"
  | "armyRecsSweepSlowPass"
  | "armyRecsSweepRemovedDeadZero"
  | "armyRecsSweepRemovedDeadMissing"
  | "armyRecsSweepSnappedPosition"
  | "armyRecsSweepRestoredAlive"
  | "armyRenderIntegrityHealOrphanSlot"
  | "armyRenderIntegrityHealVisibleUndrawn";

export interface WorldmapZoomTelemetrySummary {
  controlsChangeEvents: number;
  chunkRefreshRequests: number;
  updateVisibleChunksCalls: number;
  zoomTransitions: {
    started: number;
    completed: number;
    cancelled: number;
  };
}

export type WorldmapForceRefreshReason =
  | "default"
  | "visibility_recovery"
  | "duplicate_tile"
  | "deferred_transition_tile"
  | "structure_count_change"
  | "hydrated_chunk"
  | "terrain_self_heal"
  | "offscreen_chunk"
  | "tile_overlap_repair"
  | "shortcut"
  | "army_dead"
  | "reconnect"
  | "manager_recovery";

export interface WorldmapRenderDurationStats {
  count: number;
  totalMs: number;
  maxMs: number;
  samples: number[];
}

export interface WorldmapRenderDiagnosticsSnapshot {
  durations: Record<WorldmapRenderDurationMetric, WorldmapRenderDurationStats>;
  gauges: Record<WorldmapRenderGauge, number>;
  uploadBytes: Record<WorldmapRenderUploadMetric, number>;
  counters: Record<WorldmapRenderCounter, number>;
  forceRefreshReasons: Record<WorldmapForceRefreshReason, number>;
  updatedAtMs: number;
}

const createDurationStats = (): WorldmapRenderDurationStats => ({
  count: 0,
  totalMs: 0,
  maxMs: 0,
  samples: [],
});

const createDiagnosticsState = (): WorldmapRenderDiagnosticsSnapshot => ({
  durations: {
    updateVisibleChunks: createDurationStats(),
    performChunkSwitch: createDurationStats(),
    updateManagersForChunk: createDurationStats(),
    executeRenderForChunk: createDurationStats(),
    performVisibleStructuresUpdate: createDurationStats(),
    terrainPreparedMs: createDurationStats(),
    chunkTerrainReadyMs: createDurationStats(),
    chunkTerrainCommitMs: createDurationStats(),
    chunkManagerCatchUpMs: createDurationStats(),
    tileHydrationDrainMs: createDurationStats(),
    structureHydrationDrainMs: createDurationStats(),
    globalSpatialTileOptScanMs: createDurationStats(),
    structureAssetPrewarmMs: createDurationStats(),
    presentationCommittedMs: createDurationStats(),
    presentationSkewMs: createDurationStats(),
    workerFindPath: createDurationStats(),
    createPath: createDurationStats(),
  },
  gauges: {
    activePaths: 0,
    visibleArmies: 0,
    visibleStructures: 0,
    activeLabels: 0,
    globalSpatialTileOptRecs: 0,
    globalSpatialHydrationCandidates: 0,
    spatialSubscriptionMinCol: 0,
    spatialSubscriptionMaxCol: 0,
    spatialSubscriptionMinRow: 0,
    spatialSubscriptionMaxRow: 0,
    spatialSubscriptionModelCount: 0,
  },
  uploadBytes: {
    cachedChunkReplay: 0,
  },
  counters: {
    workerFindPathCalls: 0,
    workerFindPathBypasses: 0,
    pathCreateCalls: 0,
    controlsChangeEvents: 0,
    chunkRefreshRequests: 0,
    updateVisibleChunksCalls: 0,
    zoomTransitionsStarted: 0,
    zoomTransitionsCompleted: 0,
    zoomTransitionsCancelled: 0,
    terrainVisibleCommits: 0,
    duplicateTileAuthoritativeUpdates: 0,
    terrainVisibleOverlapRepairCount: 0,
    terrainVisibleReplaceCount: 0,
    terrainVisibleAppendCount: 0,
    terrainVisibleRebuildCount: 0,
    terrainShellStarted: 0,
    terrainShellCommitted: 0,
    terrainShellReplaced: 0,
    terrainCompositeRebuilt: 0,
    terrainShellStaleDropped: 0,
    visualWindowResolved: 0,
    visualPageQueued: 0,
    visualPageBuilt: 0,
    visualPageCommitted: 0,
    visualPageReplaced: 0,
    visualPageEvicted: 0,
    visualPageStaleDropped: 0,
    visualPageBudgetExhausted: 0,
    staleTerrainCacheFingerprintRejectCount: 0,
    preparedChunkPrewarmHits: 0,
    preparedChunkPrewarmMisses: 0,
    globalSpatialRecsHydratedTiles: 0,
    globalSpatialRecsHydratedChests: 0,
    globalSpatialRecsHydratedStructures: 0,
    spatialBoundsSwitchRequests: 0,
    spatialBoundsSwitchApplied: 0,
    spatialBoundsSwitchSkipped: 0,
    spatialBoundsSwitchFailures: 0,
    spatialStreamUpdates: 0,
    spatialTileOptRecsApplied: 0,
    spatialTileOptReadyTimeouts: 0,
    spatialTileOptStreamReceived: 0,
    postCommitManagerCatchUpImmediate: 0,
    postCommitManagerCatchUpDeferred: 0,
    pendingArmyRemovalCancelledByTileRecovery: 0,
    pendingArmyRemovalCancelledByDelete: 0,
    pendingArmyRemovalCancelledBySuperseded: 0,
    pendingArmyRemovalCancelledByExplorerTroopsZero: 0,
    pendingArmyRemovalCancelledByExplorerTroopsLiveRecovery: 0,
    pendingArmyRemovalCancelledByRecsSweep: 0,
    armyAuthoritativeSweepConfirmedDead: 0,
    armyAuthoritativeSweepReapplied: 0,
    armyAuthoritativeSweepFailed: 0,
    armyAuthoritativeSweepSlowOp: 0,
    armyRecsSweepSlowPass: 0,
    armyRecsSweepRemovedDeadZero: 0,
    armyRecsSweepRemovedDeadMissing: 0,
    armyRecsSweepSnappedPosition: 0,
    armyRecsSweepRestoredAlive: 0,
    armyRenderIntegrityHealOrphanSlot: 0,
    armyRenderIntegrityHealVisibleUndrawn: 0,
  },
  forceRefreshReasons: {
    default: 0,
    visibility_recovery: 0,
    duplicate_tile: 0,
    deferred_transition_tile: 0,
    structure_count_change: 0,
    hydrated_chunk: 0,
    terrain_self_heal: 0,
    offscreen_chunk: 0,
    tile_overlap_repair: 0,
    shortcut: 0,
    army_dead: 0,
    reconnect: 0,
    manager_recovery: 0,
  },
  updatedAtMs: Date.now(),
});

let diagnosticsState = createDiagnosticsState();

export function recordWorldmapRenderDuration(metric: WorldmapRenderDurationMetric, durationMs: number): void {
  const normalizedDuration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  const stats = diagnosticsState.durations[metric];
  stats.count += 1;
  stats.totalMs += normalizedDuration;
  stats.maxMs = Math.max(stats.maxMs, normalizedDuration);
  stats.samples.push(normalizedDuration);
  if (stats.samples.length > MAX_DURATION_SAMPLES) {
    stats.samples.shift();
  }
  diagnosticsState.updatedAtMs = Date.now();
}

export function setWorldmapRenderGauge(gauge: WorldmapRenderGauge, value: number): void {
  const nextValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  if (diagnosticsState.gauges[gauge] === nextValue) {
    return;
  }

  diagnosticsState.gauges[gauge] = nextValue;
  diagnosticsState.updatedAtMs = Date.now();
}

export function incrementWorldmapRenderCounter(counter: WorldmapRenderCounter, amount: number = 1): void {
  diagnosticsState.counters[counter] += Math.max(0, Math.floor(amount));
  diagnosticsState.updatedAtMs = Date.now();
}

export function incrementWorldmapRenderUploadBytes(metric: WorldmapRenderUploadMetric, amount: number): void {
  diagnosticsState.uploadBytes[metric] += Math.max(0, Math.floor(amount));
  diagnosticsState.updatedAtMs = Date.now();
}

export function incrementWorldmapForceRefreshReason(reason: WorldmapForceRefreshReason): void {
  diagnosticsState.forceRefreshReasons[reason] += 1;
  diagnosticsState.updatedAtMs = Date.now();
}

export function snapshotWorldmapRenderDiagnostics(): WorldmapRenderDiagnosticsSnapshot {
  return {
    durations: Object.fromEntries(
      Object.entries(diagnosticsState.durations).map(([metric, stats]) => [
        metric,
        {
          ...stats,
          samples: [...stats.samples],
        },
      ]),
    ) as WorldmapRenderDiagnosticsSnapshot["durations"],
    gauges: { ...diagnosticsState.gauges },
    uploadBytes: { ...diagnosticsState.uploadBytes },
    counters: { ...diagnosticsState.counters },
    forceRefreshReasons: { ...diagnosticsState.forceRefreshReasons },
    updatedAtMs: diagnosticsState.updatedAtMs,
  };
}

export function createWorldmapZoomTelemetrySummary(
  snapshot: WorldmapRenderDiagnosticsSnapshot,
): WorldmapZoomTelemetrySummary {
  return {
    controlsChangeEvents: snapshot.counters.controlsChangeEvents,
    chunkRefreshRequests: snapshot.counters.chunkRefreshRequests,
    updateVisibleChunksCalls: snapshot.counters.updateVisibleChunksCalls,
    zoomTransitions: {
      started: snapshot.counters.zoomTransitionsStarted,
      completed: snapshot.counters.zoomTransitionsCompleted,
      cancelled: snapshot.counters.zoomTransitionsCancelled,
    },
  };
}

export function resetWorldmapRenderDiagnostics(): void {
  diagnosticsState = createDiagnosticsState();
}
