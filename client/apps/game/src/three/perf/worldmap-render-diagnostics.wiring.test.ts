import { beforeEach, describe, expect, it } from "vitest";

import {
  incrementWorldmapRenderCounter,
  incrementWorldmapRenderUploadBytes,
  recordWorldmapRenderDuration,
  resetWorldmapRenderDiagnostics,
  setWorldmapRenderGauge,
  snapshotWorldmapRenderDiagnostics,
} from "./worldmap-render-diagnostics";

describe("worldmap render diagnostics wiring", () => {
  beforeEach(() => {
    resetWorldmapRenderDiagnostics();
  });

  it("records duration metrics and reflects them in the snapshot", () => {
    recordWorldmapRenderDuration("updateVisibleChunks", 12.5);
    recordWorldmapRenderDuration("performChunkSwitch", 3.0);
    recordWorldmapRenderDuration("chunkTerrainReadyMs", 8.0);
    recordWorldmapRenderDuration("chunkTerrainCommitMs", 5.0);
    recordWorldmapRenderDuration("chunkManagerCatchUpMs", 2.0);
    recordWorldmapRenderDuration("updateManagersForChunk", 1.5);
    recordWorldmapRenderDuration("executeRenderForChunk", 7.0);
    recordWorldmapRenderDuration("performVisibleStructuresUpdate", 4.0);
    recordWorldmapRenderDuration("globalSpatialTileOptScanMs", 6.0);
    recordWorldmapRenderDuration("workerFindPath", 6.0);
    recordWorldmapRenderDuration("createPath", 9.0);

    const snapshot = snapshotWorldmapRenderDiagnostics();

    expect(snapshot.durations.updateVisibleChunks.count).toBe(1);
    expect(snapshot.durations.updateVisibleChunks.totalMs).toBe(12.5);
    expect(snapshot.durations.performChunkSwitch.count).toBe(1);
    expect(snapshot.durations.chunkTerrainReadyMs.count).toBe(1);
    expect(snapshot.durations.chunkTerrainCommitMs.count).toBe(1);
    expect(snapshot.durations.chunkManagerCatchUpMs.count).toBe(1);
    expect(snapshot.durations.updateManagersForChunk.count).toBe(1);
    expect(snapshot.durations.executeRenderForChunk.count).toBe(1);
    expect(snapshot.durations.performVisibleStructuresUpdate.count).toBe(1);
    expect(snapshot.durations.globalSpatialTileOptScanMs.count).toBe(1);
    expect(snapshot.durations.workerFindPath.count).toBe(1);
    expect(snapshot.durations.createPath.count).toBe(1);
  });

  it("records counter metrics and reflects them in the snapshot", () => {
    incrementWorldmapRenderCounter("chunkRefreshRequests", 3);
    incrementWorldmapRenderCounter("updateVisibleChunksCalls", 1);
    incrementWorldmapRenderCounter("preparedChunkPrewarmHits", 5);
    incrementWorldmapRenderCounter("preparedChunkPrewarmMisses", 2);
    incrementWorldmapRenderCounter("globalSpatialRecsHydratedStructures", 4);
    incrementWorldmapRenderCounter("spatialBoundsSwitchRequests", 2);
    incrementWorldmapRenderCounter("spatialBoundsSwitchApplied", 1);
    incrementWorldmapRenderCounter("spatialBoundsSwitchSkipped", 3);
    incrementWorldmapRenderCounter("spatialStreamUpdates", 7);
    incrementWorldmapRenderCounter("controlsChangeEvents", 10);
    incrementWorldmapRenderCounter("zoomTransitionsStarted", 1);

    const snapshot = snapshotWorldmapRenderDiagnostics();

    expect(snapshot.counters.chunkRefreshRequests).toBe(3);
    expect(snapshot.counters.updateVisibleChunksCalls).toBe(1);
    expect(snapshot.counters.preparedChunkPrewarmHits).toBe(5);
    expect(snapshot.counters.preparedChunkPrewarmMisses).toBe(2);
    expect(snapshot.counters.globalSpatialRecsHydratedStructures).toBe(4);
    expect(snapshot.counters.spatialBoundsSwitchRequests).toBe(2);
    expect(snapshot.counters.spatialBoundsSwitchApplied).toBe(1);
    expect(snapshot.counters.spatialBoundsSwitchSkipped).toBe(3);
    expect(snapshot.counters.spatialStreamUpdates).toBe(7);
    expect(snapshot.counters.controlsChangeEvents).toBe(10);
    expect(snapshot.counters.zoomTransitionsStarted).toBe(1);
  });

  it("records upload byte metrics", () => {
    incrementWorldmapRenderUploadBytes("cachedChunkReplay", 1024);

    const snapshot = snapshotWorldmapRenderDiagnostics();

    expect(snapshot.uploadBytes.cachedChunkReplay).toBe(1024);
  });

  it("records global spatial hydration gauges", () => {
    setWorldmapRenderGauge("globalSpatialTileOptRecs", 1200);
    setWorldmapRenderGauge("globalSpatialHydrationCandidates", 84);
    setWorldmapRenderGauge("spatialSubscriptionMinCol", 100);
    setWorldmapRenderGauge("spatialSubscriptionMaxCol", 180);
    setWorldmapRenderGauge("spatialSubscriptionMinRow", 200);
    setWorldmapRenderGauge("spatialSubscriptionMaxRow", 260);
    setWorldmapRenderGauge("spatialSubscriptionModelCount", 7);

    const snapshot = snapshotWorldmapRenderDiagnostics();

    expect(snapshot.gauges.globalSpatialTileOptRecs).toBe(1200);
    expect(snapshot.gauges.globalSpatialHydrationCandidates).toBe(84);
    expect(snapshot.gauges.spatialSubscriptionMinCol).toBe(100);
    expect(snapshot.gauges.spatialSubscriptionMaxCol).toBe(180);
    expect(snapshot.gauges.spatialSubscriptionMinRow).toBe(200);
    expect(snapshot.gauges.spatialSubscriptionMaxRow).toBe(260);
    expect(snapshot.gauges.spatialSubscriptionModelCount).toBe(7);
  });

  it("reset clears all recorded state", () => {
    recordWorldmapRenderDuration("updateVisibleChunks", 10);
    incrementWorldmapRenderCounter("chunkRefreshRequests", 5);
    incrementWorldmapRenderUploadBytes("cachedChunkReplay", 512);

    resetWorldmapRenderDiagnostics();

    const snapshot = snapshotWorldmapRenderDiagnostics();

    expect(snapshot.durations.updateVisibleChunks.count).toBe(0);
    expect(snapshot.counters.chunkRefreshRequests).toBe(0);
    expect(snapshot.uploadBytes.cachedChunkReplay).toBe(0);
  });
});
