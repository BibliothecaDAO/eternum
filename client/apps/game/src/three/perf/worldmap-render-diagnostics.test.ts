import { beforeEach, describe, expect, it } from "vitest";
import {
  createWorldmapZoomTelemetrySummary,
  incrementWorldmapForceRefreshReason,
  incrementWorldmapRenderCounter,
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
    setWorldmapRenderGauge("activePaths", 17);
    setWorldmapRenderGauge("visibleArmies", 301);
    incrementWorldmapRenderCounter("controlsChangeEvents", 4);
    incrementWorldmapRenderCounter("chunkRefreshRequests", 3);
    incrementWorldmapRenderCounter("updateVisibleChunksCalls", 2);
    incrementWorldmapRenderCounter("zoomTransitionsStarted", 2);
    incrementWorldmapRenderCounter("zoomTransitionsCompleted");
    incrementWorldmapRenderCounter("zoomTransitionsCancelled");
    incrementWorldmapRenderCounter("workerFindPathCalls");
    incrementWorldmapRenderCounter("pathCreateCalls", 2);
    incrementWorldmapForceRefreshReason("duplicate_tile");
    incrementWorldmapForceRefreshReason("duplicate_tile");
    incrementWorldmapForceRefreshReason("structure_count_change");

    const snapshot = snapshotWorldmapRenderDiagnostics();

    expect(snapshot.durations.updateVisibleChunks.count).toBe(2);
    expect(snapshot.durations.updateVisibleChunks.totalMs).toBeCloseTo(20);
    expect(snapshot.durations.updateVisibleChunks.maxMs).toBeCloseTo(12.5);
    expect(snapshot.durations.updateVisibleChunks.samples).toEqual([12.5, 7.5]);
    expect(snapshot.durations.workerFindPath.count).toBe(1);
    expect(snapshot.gauges.activePaths).toBe(17);
    expect(snapshot.gauges.visibleArmies).toBe(301);
    expect(snapshot.counters.controlsChangeEvents).toBe(4);
    expect(snapshot.counters.chunkRefreshRequests).toBe(3);
    expect(snapshot.counters.updateVisibleChunksCalls).toBe(2);
    expect(snapshot.counters.zoomTransitionsStarted).toBe(2);
    expect(snapshot.counters.zoomTransitionsCompleted).toBe(1);
    expect(snapshot.counters.zoomTransitionsCancelled).toBe(1);
    expect(snapshot.counters.workerFindPathCalls).toBe(1);
    expect(snapshot.counters.pathCreateCalls).toBe(2);
    expect(snapshot.forceRefreshReasons.duplicate_tile).toBe(2);
    expect(snapshot.forceRefreshReasons.structure_count_change).toBe(1);
  });

  it("resets back to zeroed state", () => {
    recordWorldmapRenderDuration("createPath", 3);
    setWorldmapRenderGauge("activeLabels", 4);
    incrementWorldmapRenderCounter("controlsChangeEvents");
    incrementWorldmapRenderCounter("pathCreateCalls");
    incrementWorldmapForceRefreshReason("visibility_recovery");

    resetWorldmapRenderDiagnostics();
    const snapshot = snapshotWorldmapRenderDiagnostics();

    expect(snapshot.durations.createPath.count).toBe(0);
    expect(snapshot.gauges.activeLabels).toBe(0);
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
});
