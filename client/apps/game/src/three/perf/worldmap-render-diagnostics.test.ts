import { beforeEach, describe, expect, it } from "vitest";
import {
  createWorldmapZoomTelemetrySummary,
  incrementWorldmapForceRefreshReason,
  incrementWorldmapRenderCounter,
  incrementWorldmapRenderUploadBytes,
  recordWorldmapRenderDuration,
  resetWorldmapRenderDiagnostics,
  setWorldmapRenderGauge,
  snapshotWorldmapRenderDiagnostics,
} from "./worldmap-render-diagnostics";

describe("worldmap-render-diagnostics", () => {
  beforeEach(() => {
    resetWorldmapRenderDiagnostics();
  });

  it("tracks duration series, gauges, counters, and force-refresh reasons", () => {
    recordWorldmapRenderDuration("updateVisibleChunks", 12.5);
    recordWorldmapRenderDuration("updateVisibleChunks", 7.5);
    recordWorldmapRenderDuration("workerFindPath", 5);
    recordWorldmapRenderDuration("terrainPreparedMs", 14);
    recordWorldmapRenderDuration("tileHydrationDrainMs" as any, 11);
    recordWorldmapRenderDuration("structureHydrationDrainMs", 9);
    recordWorldmapRenderDuration("structureAssetPrewarmMs", 4);
    recordWorldmapRenderDuration("presentationCommittedMs", 23);
    recordWorldmapRenderDuration("presentationSkewMs", 0.5);
    setWorldmapRenderGauge("activePaths", 17);
    setWorldmapRenderGauge("visibleArmies", 301);
    incrementWorldmapRenderUploadBytes("cachedChunkReplay", 256);
    incrementWorldmapRenderCounter("controlsChangeEvents", 4);
    incrementWorldmapRenderCounter("chunkRefreshRequests", 3);
    incrementWorldmapRenderCounter("updateVisibleChunksCalls", 2);
    incrementWorldmapRenderCounter("zoomTransitionsStarted", 2);
    incrementWorldmapRenderCounter("zoomTransitionsCompleted");
    incrementWorldmapRenderCounter("zoomTransitionsCancelled");
    incrementWorldmapRenderCounter("workerFindPathCalls");
    incrementWorldmapRenderCounter("pathCreateCalls", 2);
    incrementWorldmapRenderCounter("terrainVisibleOverlapRepairCount" as any);
    incrementWorldmapRenderCounter("terrainVisibleReplaceCount" as any, 2);
    incrementWorldmapRenderCounter("terrainVisibleAppendCount" as any, 3);
    incrementWorldmapRenderCounter("terrainVisibleRebuildCount" as any, 4);
    incrementWorldmapRenderCounter("staleTerrainCacheFingerprintRejectCount" as any, 5);
    incrementWorldmapForceRefreshReason("duplicate_tile");
    incrementWorldmapForceRefreshReason("duplicate_tile");
    incrementWorldmapForceRefreshReason("structure_count_change");
    incrementWorldmapForceRefreshReason("tile_overlap_repair" as any);

    const snapshot = snapshotWorldmapRenderDiagnostics();

    expect(snapshot.durations.updateVisibleChunks.count).toBe(2);
    expect(snapshot.durations.updateVisibleChunks.totalMs).toBeCloseTo(20);
    expect(snapshot.durations.updateVisibleChunks.maxMs).toBeCloseTo(12.5);
    expect(snapshot.durations.updateVisibleChunks.samples).toEqual([12.5, 7.5]);
    expect(snapshot.durations.workerFindPath.count).toBe(1);
    expect(snapshot.durations.terrainPreparedMs.samples).toEqual([14]);
    expect(snapshot.durations).toHaveProperty("tileHydrationDrainMs");
    expect((snapshot.durations as any).tileHydrationDrainMs.samples).toEqual([11]);
    expect(snapshot.durations.structureHydrationDrainMs.samples).toEqual([9]);
    expect(snapshot.durations.structureAssetPrewarmMs.samples).toEqual([4]);
    expect(snapshot.durations.presentationCommittedMs.samples).toEqual([23]);
    expect(snapshot.durations.presentationSkewMs.samples).toEqual([0.5]);
    expect(snapshot.gauges.activePaths).toBe(17);
    expect(snapshot.gauges.visibleArmies).toBe(301);
    expect(snapshot.uploadBytes.cachedChunkReplay).toBe(256);
    expect(snapshot.counters.controlsChangeEvents).toBe(4);
    expect(snapshot.counters.chunkRefreshRequests).toBe(3);
    expect(snapshot.counters.updateVisibleChunksCalls).toBe(2);
    expect(snapshot.counters.zoomTransitionsStarted).toBe(2);
    expect(snapshot.counters.zoomTransitionsCompleted).toBe(1);
    expect(snapshot.counters.zoomTransitionsCancelled).toBe(1);
    expect(snapshot.counters.workerFindPathCalls).toBe(1);
    expect(snapshot.counters.pathCreateCalls).toBe(2);
    expect(snapshot.counters).toHaveProperty("terrainVisibleOverlapRepairCount", 1);
    expect(snapshot.counters).toHaveProperty("terrainVisibleReplaceCount", 2);
    expect(snapshot.counters).toHaveProperty("terrainVisibleAppendCount", 3);
    expect(snapshot.counters).toHaveProperty("terrainVisibleRebuildCount", 4);
    expect(snapshot.counters).toHaveProperty("staleTerrainCacheFingerprintRejectCount", 5);
    expect(snapshot.forceRefreshReasons.duplicate_tile).toBe(2);
    expect(snapshot.forceRefreshReasons.structure_count_change).toBe(1);
    expect(snapshot.forceRefreshReasons).toHaveProperty("tile_overlap_repair", 1);
  });

  it("resets back to zeroed state", () => {
    recordWorldmapRenderDuration("createPath", 3);
    setWorldmapRenderGauge("activeLabels", 4);
    incrementWorldmapRenderUploadBytes("cachedChunkReplay", 16);
    incrementWorldmapRenderCounter("controlsChangeEvents");
    incrementWorldmapRenderCounter("pathCreateCalls");
    incrementWorldmapForceRefreshReason("visibility_recovery");

    resetWorldmapRenderDiagnostics();
    const snapshot = snapshotWorldmapRenderDiagnostics();

    expect(snapshot.durations.createPath.count).toBe(0);
    expect(snapshot.gauges.activeLabels).toBe(0);
    expect(snapshot.uploadBytes.cachedChunkReplay).toBe(0);
    expect(snapshot.counters.controlsChangeEvents).toBe(0);
    expect(snapshot.counters.pathCreateCalls).toBe(0);
    expect(snapshot.forceRefreshReasons.visibility_recovery).toBe(0);
  });

  it("caps stored duration samples to the latest bounded window", () => {
    for (let index = 1; index <= 600; index += 1) {
      recordWorldmapRenderDuration("performChunkSwitch", index);
    }

    const snapshot = snapshotWorldmapRenderDiagnostics();

    expect(snapshot.durations.performChunkSwitch.samples).toHaveLength(512);
    expect(snapshot.durations.performChunkSwitch.samples[0]).toBe(89);
    expect(snapshot.durations.performChunkSwitch.samples[511]).toBe(600);
  });

  it("summarizes zoom telemetry counters for a close-medium-far sequence", () => {
    incrementWorldmapRenderCounter("controlsChangeEvents", 9);
    incrementWorldmapRenderCounter("chunkRefreshRequests", 2);
    incrementWorldmapRenderCounter("updateVisibleChunksCalls", 1);
    incrementWorldmapRenderCounter("zoomTransitionsStarted", 2);
    incrementWorldmapRenderCounter("zoomTransitionsCompleted", 2);

    const summary = createWorldmapZoomTelemetrySummary(snapshotWorldmapRenderDiagnostics());

    expect(summary.controlsChangeEvents).toBe(9);
    expect(summary.chunkRefreshRequests).toBe(2);
    expect(summary.updateVisibleChunksCalls).toBe(1);
    expect(summary.zoomTransitions.started).toBe(2);
    expect(summary.zoomTransitions.completed).toBe(2);
    expect(summary.zoomTransitions.cancelled).toBe(0);
  });

  it("tracks terrain visible commit count via dedicated counter", () => {
    // Stage 0: new counter type for terrain commits to the visible scene.
    // This counter is critical for verifying that biome deltas actually
    // result in a terrain commit rather than being silently dropped.
    incrementWorldmapRenderCounter("terrainVisibleCommits" as any);
    incrementWorldmapRenderCounter("terrainVisibleCommits" as any);
    incrementWorldmapRenderCounter("terrainVisibleCommits" as any);

    const snapshot = snapshotWorldmapRenderDiagnostics();

    // The counter type must be added to WorldmapRenderCounter union
    expect(snapshot.counters).toHaveProperty("terrainVisibleCommits", 3);
  });

  it("tracks terrain commit with refresh reason breakdown", () => {
    // Stage 0: each terrain commit should be attributable to a refresh reason.
    // This enables diagnosing whether duplicate tile biome deltas actually
    // trigger terrain commits.
    incrementWorldmapForceRefreshReason("duplicate_tile");
    incrementWorldmapRenderCounter("terrainVisibleCommits" as any);

    incrementWorldmapForceRefreshReason("hydrated_chunk");
    incrementWorldmapRenderCounter("terrainVisibleCommits" as any);

    const snapshot = snapshotWorldmapRenderDiagnostics();

    expect(snapshot.counters).toHaveProperty("terrainVisibleCommits", 2);
    expect(snapshot.forceRefreshReasons.duplicate_tile).toBe(1);
    expect(snapshot.forceRefreshReasons.hydrated_chunk).toBe(1);
  });

  it("tracks duplicate tile authoritative state updates as a separate counter", () => {
    // Stage 0: when a biome delta is written to authoritative state BEFORE
    // reconcile scheduling, we need a counter to verify it happened.
    incrementWorldmapRenderCounter("duplicateTileAuthoritativeUpdates" as any);

    const snapshot = snapshotWorldmapRenderDiagnostics();

    expect(snapshot.counters).toHaveProperty("duplicateTileAuthoritativeUpdates", 1);
  });
});
