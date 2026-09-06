import { describe, expect, it } from "vitest";

import {
  createWorldmapChunkDiagnostics,
  recordChunkDiagnosticsEvent,
  type WorldmapChunkDiagnosticsEvent,
} from "./worldmap-chunk-diagnostics";

describe("worldmap-chunk-diagnostics", () => {
  it("starts with zeroed counters", () => {
    const diagnostics = createWorldmapChunkDiagnostics();

    expect(diagnostics.transitionStarted).toBe(0);
    expect(diagnostics.transitionCommitted).toBe(0);
    expect(diagnostics.transitionRolledBack).toBe(0);
    expect(diagnostics.transitionPrepareStaleDropped).toBe(0);
    expect(diagnostics.managerUpdateStarted).toBe(0);
    expect(diagnostics.managerUpdateSkippedStale).toBe(0);
    expect(diagnostics.criticalManagerCatchUpStarted).toBe(0);
    expect(diagnostics.criticalManagerCatchUpFailed).toBe(0);
    expect(diagnostics.projectionSyncStarted).toBe(0);
    expect(diagnostics.projectionSyncSucceeded).toBe(0);
    expect(diagnostics.projectionSyncFailed).toBe(0);
    expect(diagnostics.prefetchQueued).toBe(0);
    expect(diagnostics.prefetchSkipped).toBe(0);
    expect(diagnostics.prefetchExecuted).toBe(0);
    expect(diagnostics.switchDurationMsTotal).toBe(0);
    expect(diagnostics.switchDurationMsMax).toBe(0);
    expect(diagnostics.switchDurationMsSamples).toEqual([]);
    expect(diagnostics.terrainSourceReadyDurationMsTotal).toBe(0);
    expect(diagnostics.terrainSourceReadyDurationMsMax).toBe(0);
    expect(diagnostics.terrainSourceReadyDurationMsSamples).toEqual([]);
    expect(diagnostics.terrainCommitDurationMsTotal).toBe(0);
    expect(diagnostics.terrainCommitDurationMsMax).toBe(0);
    expect(diagnostics.terrainCommitDurationMsSamples).toEqual([]);
    expect(diagnostics.terrainFirstCompletePageDurationMsSamples).toEqual([]);
    expect(diagnostics.terrainWindowConvergenceDurationMsSamples).toEqual([]);
    expect(diagnostics.terrainFirstRenderedFrameDurationMsTotal).toBe(0);
    expect(diagnostics.terrainFirstRenderedFrameDurationMsMax).toBe(0);
    expect(diagnostics.terrainFirstRenderedFrameDurationMsSamples).toEqual([]);
    expect(diagnostics.managerDurationMsTotal).toBe(0);
    expect(diagnostics.managerDurationMsMax).toBe(0);
    expect(diagnostics.managerDurationMsSamples).toEqual([]);
    expect(diagnostics.managerCatchUpDurationMsTotal).toBe(0);
    expect(diagnostics.managerCatchUpDurationMsMax).toBe(0);
    expect(diagnostics.managerCatchUpDurationMsSamples).toEqual([]);
    expect(diagnostics.criticalManagerCatchUpDurationMsTotal).toBe(0);
    expect(diagnostics.criticalManagerCatchUpDurationMsMax).toBe(0);
    expect(diagnostics.criticalManagerCatchUpDurationMsSamples).toEqual([]);
    expect(diagnostics.preparedChunkPrewarmHit).toBe(0);
    expect(diagnostics.preparedChunkPrewarmMiss).toBe(0);
  });

  it("records event counters", () => {
    const diagnostics = createWorldmapChunkDiagnostics();
    const events: WorldmapChunkDiagnosticsEvent[] = [
      "transition_started",
      "transition_committed",
      "transition_rolled_back",
      "transition_prepare_stale_dropped",
      "manager_update_started",
      "manager_update_skipped_stale",
      "manager_update_failed",
      "critical_manager_catch_up_started",
      "critical_manager_catch_up_failed",
      "projection_sync_started",
      "projection_sync_succeeded",
      "projection_sync_failed",
      "prefetch_queued",
      "prefetch_skipped",
      "prefetch_executed",
      "refresh_requested",
      "refresh_executed",
      "refresh_superseded",
      "prepared_chunk_prewarm_hit",
      "prepared_chunk_prewarm_miss",
    ];

    events.forEach((event) => recordChunkDiagnosticsEvent(diagnostics, event));

    expect(diagnostics.transitionStarted).toBe(1);
    expect(diagnostics.transitionCommitted).toBe(1);
    expect(diagnostics.transitionRolledBack).toBe(1);
    expect(diagnostics.transitionPrepareStaleDropped).toBe(1);
    expect(diagnostics.managerUpdateStarted).toBe(1);
    expect(diagnostics.managerUpdateSkippedStale).toBe(1);
    expect(diagnostics.managerUpdateFailed).toBe(1);
    expect(diagnostics.criticalManagerCatchUpStarted).toBe(1);
    expect(diagnostics.criticalManagerCatchUpFailed).toBe(1);
    expect(diagnostics.projectionSyncStarted).toBe(1);
    expect(diagnostics.projectionSyncSucceeded).toBe(1);
    expect(diagnostics.projectionSyncFailed).toBe(1);
    expect(diagnostics.prefetchQueued).toBe(1);
    expect(diagnostics.prefetchSkipped).toBe(1);
    expect(diagnostics.prefetchExecuted).toBe(1);
    expect(diagnostics.refreshRequested).toBe(1);
    expect(diagnostics.refreshExecuted).toBe(1);
    expect(diagnostics.refreshSuperseded).toBe(1);
    expect(diagnostics.preparedChunkPrewarmHit).toBe(1);
    expect(diagnostics.preparedChunkPrewarmMiss).toBe(1);
  });

  it("accumulates switch and manager durations", () => {
    const diagnostics = createWorldmapChunkDiagnostics();

    recordChunkDiagnosticsEvent(diagnostics, "switch_duration_recorded", { durationMs: 12.5 });
    recordChunkDiagnosticsEvent(diagnostics, "switch_duration_recorded", { durationMs: 4.5 });
    recordChunkDiagnosticsEvent(diagnostics, "terrain_source_ready_duration_recorded", { durationMs: 17 });
    recordChunkDiagnosticsEvent(diagnostics, "terrain_source_ready_duration_recorded", { durationMs: 8 });
    recordChunkDiagnosticsEvent(diagnostics, "terrain_commit_duration_recorded", { durationMs: 3 });
    recordChunkDiagnosticsEvent(diagnostics, "terrain_commit_duration_recorded", { durationMs: 5 });
    recordChunkDiagnosticsEvent(diagnostics, "terrain_first_complete_page_duration_recorded", { durationMs: 11 });
    recordChunkDiagnosticsEvent(diagnostics, "terrain_window_convergence_duration_recorded", { durationMs: 16 });
    recordChunkDiagnosticsEvent(diagnostics, "terrain_first_rendered_frame_duration_recorded", { durationMs: 20 });
    recordChunkDiagnosticsEvent(diagnostics, "terrain_first_rendered_frame_duration_recorded", { durationMs: 13 });
    recordChunkDiagnosticsEvent(diagnostics, "manager_duration_recorded", { durationMs: 6 });
    recordChunkDiagnosticsEvent(diagnostics, "manager_duration_recorded", { durationMs: 9 });
    recordChunkDiagnosticsEvent(diagnostics, "manager_catch_up_duration_recorded", { durationMs: 6 });
    recordChunkDiagnosticsEvent(diagnostics, "manager_catch_up_duration_recorded", { durationMs: 9 });
    recordChunkDiagnosticsEvent(diagnostics, "critical_manager_catch_up_duration_recorded", { durationMs: 7 });
    recordChunkDiagnosticsEvent(diagnostics, "critical_manager_catch_up_duration_recorded", { durationMs: 10 });

    expect(diagnostics.switchDurationMsTotal).toBeCloseTo(17);
    expect(diagnostics.switchDurationMsMax).toBeCloseTo(12.5);
    expect(diagnostics.switchDurationMsSamples).toEqual([12.5, 4.5]);
    expect(diagnostics.terrainSourceReadyDurationMsTotal).toBeCloseTo(25);
    expect(diagnostics.terrainSourceReadyDurationMsMax).toBeCloseTo(17);
    expect(diagnostics.terrainSourceReadyDurationMsSamples).toEqual([17, 8]);
    expect(diagnostics.terrainCommitDurationMsTotal).toBeCloseTo(8);
    expect(diagnostics.terrainCommitDurationMsMax).toBeCloseTo(5);
    expect(diagnostics.terrainCommitDurationMsSamples).toEqual([3, 5]);
    expect(diagnostics.terrainFirstCompletePageDurationMsSamples).toEqual([11]);
    expect(diagnostics.terrainWindowConvergenceDurationMsSamples).toEqual([16]);
    expect(diagnostics.terrainFirstRenderedFrameDurationMsTotal).toBeCloseTo(33);
    expect(diagnostics.terrainFirstRenderedFrameDurationMsMax).toBeCloseTo(20);
    expect(diagnostics.terrainFirstRenderedFrameDurationMsSamples).toEqual([20, 13]);
    expect(diagnostics.managerDurationMsTotal).toBeCloseTo(15);
    expect(diagnostics.managerDurationMsMax).toBeCloseTo(9);
    expect(diagnostics.managerDurationMsSamples).toEqual([6, 9]);
    expect(diagnostics.managerCatchUpDurationMsTotal).toBeCloseTo(15);
    expect(diagnostics.managerCatchUpDurationMsMax).toBeCloseTo(9);
    expect(diagnostics.managerCatchUpDurationMsSamples).toEqual([6, 9]);
    expect(diagnostics.criticalManagerCatchUpDurationMsTotal).toBeCloseTo(17);
    expect(diagnostics.criticalManagerCatchUpDurationMsMax).toBeCloseTo(10);
    expect(diagnostics.criticalManagerCatchUpDurationMsSamples).toEqual([7, 10]);
  });

  it("caps duration samples to the latest bounded window", () => {
    const diagnostics = createWorldmapChunkDiagnostics();

    for (let i = 1; i <= 600; i++) {
      recordChunkDiagnosticsEvent(diagnostics, "switch_duration_recorded", { durationMs: i });
    }

    expect(diagnostics.switchDurationMsSamples).toHaveLength(512);
    expect(diagnostics.switchDurationMsSamples[0]).toBe(89);
    expect(diagnostics.switchDurationMsSamples[511]).toBe(600);
  });

  it("caps Stage 0 duration samples to the latest bounded window", () => {
    const diagnostics = createWorldmapChunkDiagnostics();

    for (let i = 1; i <= 600; i++) {
      recordChunkDiagnosticsEvent(diagnostics, "terrain_source_ready_duration_recorded", { durationMs: i });
      recordChunkDiagnosticsEvent(diagnostics, "terrain_commit_duration_recorded", { durationMs: i });
      recordChunkDiagnosticsEvent(diagnostics, "terrain_first_complete_page_duration_recorded", { durationMs: i });
      recordChunkDiagnosticsEvent(diagnostics, "terrain_window_convergence_duration_recorded", { durationMs: i });
      recordChunkDiagnosticsEvent(diagnostics, "terrain_first_rendered_frame_duration_recorded", { durationMs: i });
      recordChunkDiagnosticsEvent(diagnostics, "manager_catch_up_duration_recorded", { durationMs: i });
      recordChunkDiagnosticsEvent(diagnostics, "critical_manager_catch_up_duration_recorded", { durationMs: i });
    }

    expect(diagnostics.terrainSourceReadyDurationMsSamples).toHaveLength(512);
    expect(diagnostics.terrainSourceReadyDurationMsSamples[0]).toBe(89);
    expect(diagnostics.terrainSourceReadyDurationMsSamples[511]).toBe(600);
    expect(diagnostics.terrainCommitDurationMsSamples).toHaveLength(512);
    expect(diagnostics.terrainFirstCompletePageDurationMsSamples).toHaveLength(512);
    expect(diagnostics.terrainWindowConvergenceDurationMsSamples).toHaveLength(512);
    expect(diagnostics.terrainFirstRenderedFrameDurationMsSamples).toHaveLength(512);
    expect(diagnostics.managerCatchUpDurationMsSamples).toHaveLength(512);
    expect(diagnostics.criticalManagerCatchUpDurationMsSamples).toHaveLength(512);
  });

  it("does not turn missing or non-finite duration observations into zero samples", () => {
    const diagnostics = createWorldmapChunkDiagnostics();

    recordChunkDiagnosticsEvent(diagnostics, "terrain_first_rendered_frame_duration_recorded");
    recordChunkDiagnosticsEvent(diagnostics, "terrain_first_rendered_frame_duration_recorded", {
      durationMs: Number.NaN,
    });
    recordChunkDiagnosticsEvent(diagnostics, "terrain_first_rendered_frame_duration_recorded", {
      durationMs: Number.POSITIVE_INFINITY,
    });

    expect(diagnostics.terrainFirstRenderedFrameDurationMsSamples).toEqual([]);
  });
});

describe("worldmap-chunk-diagnostics – terrain convergence and refresh reason events", () => {
  it("records terrain_window_converged events", () => {
    const diagnostics = createWorldmapChunkDiagnostics();

    recordChunkDiagnosticsEvent(diagnostics, "terrain_window_converged" as WorldmapChunkDiagnosticsEvent);
    recordChunkDiagnosticsEvent(diagnostics, "terrain_window_converged" as WorldmapChunkDiagnosticsEvent);

    // Stage 0: new counter field for tracking terrain commits to visible scene
    expect(diagnostics).toHaveProperty("terrainWindowConverged", 2);
  });

  it("records refresh_reason breakdown events", () => {
    const diagnostics = createWorldmapChunkDiagnostics();

    const refreshReasonEvents = [
      "refresh_reason_default",
      "refresh_reason_hydrated_chunk",
    ] as WorldmapChunkDiagnosticsEvent[];

    refreshReasonEvents.forEach((event) => recordChunkDiagnosticsEvent(diagnostics, event));

    // Stage 0: each refresh reason gets its own counter
    expect(diagnostics).toHaveProperty("refreshReasonDefault", 1);
    expect(diagnostics).toHaveProperty("refreshReasonHydratedChunk", 1);
  });

  it("records stale_terrain_refresh_dropped events", () => {
    const diagnostics = createWorldmapChunkDiagnostics();

    recordChunkDiagnosticsEvent(diagnostics, "stale_terrain_refresh_dropped" as WorldmapChunkDiagnosticsEvent);
    recordChunkDiagnosticsEvent(diagnostics, "stale_terrain_refresh_dropped" as WorldmapChunkDiagnosticsEvent);
    recordChunkDiagnosticsEvent(diagnostics, "stale_terrain_refresh_dropped" as WorldmapChunkDiagnosticsEvent);

    // Stage 0: counter for stale terrain refreshes that were dropped
    expect(diagnostics).toHaveProperty("staleTerrainRefreshDropped", 3);
  });

  it("records terrain_bounds_recovery events", () => {
    const diagnostics = createWorldmapChunkDiagnostics();

    recordChunkDiagnosticsEvent(diagnostics, "terrain_bounds_recovery" as WorldmapChunkDiagnosticsEvent);

    // Stage 0: counter for terrain bounds recovery operations
    expect(diagnostics).toHaveProperty("terrainBoundsRecovery", 1);
  });

  it("records cache fingerprint reject events", () => {
    const diagnostics = createWorldmapChunkDiagnostics();

    recordChunkDiagnosticsEvent(diagnostics, "cache_reject_fingerprint" as WorldmapChunkDiagnosticsEvent);
    recordChunkDiagnosticsEvent(diagnostics, "cache_reject_fingerprint" as WorldmapChunkDiagnosticsEvent);

    expect(diagnostics).toHaveProperty("cacheRejectFingerprint", 2);
  });
});
