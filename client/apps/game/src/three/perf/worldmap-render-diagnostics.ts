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
  | "structureAssetPrewarmMs"
  | "presentationCommittedMs"
  | "presentationSkewMs"
  | "workerFindPath"
  | "createPath";

export type WorldmapRenderGauge = "activePaths" | "visibleArmies" | "visibleStructures" | "activeLabels";
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
  | "staleTerrainCacheFingerprintRejectCount"
  | "preparedChunkPrewarmHits"
  | "preparedChunkPrewarmMisses"
  | "postCommitManagerCatchUpImmediate"
  | "postCommitManagerCatchUpDeferred";

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
  | "structure_count_change"
  | "hydrated_chunk"
  | "terrain_self_heal"
  | "offscreen_chunk"
  | "tile_overlap_repair"
  | "shortcut"
  | "army_dead";

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
    staleTerrainCacheFingerprintRejectCount: 0,
    preparedChunkPrewarmHits: 0,
    preparedChunkPrewarmMisses: 0,
    postCommitManagerCatchUpImmediate: 0,
    postCommitManagerCatchUpDeferred: 0,
  },
  forceRefreshReasons: {
    default: 0,
    visibility_recovery: 0,
    duplicate_tile: 0,
    structure_count_change: 0,
    hydrated_chunk: 0,
    terrain_self_heal: 0,
    offscreen_chunk: 0,
    tile_overlap_repair: 0,
    shortcut: 0,
    army_dead: 0,
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
  diagnosticsState.gauges[gauge] = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
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
