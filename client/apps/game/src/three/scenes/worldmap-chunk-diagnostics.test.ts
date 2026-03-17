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
    expect(diagnostics.tileFetchStarted).toBe(0);
    expect(diagnostics.tileFetchSucceeded).toBe(0);
    expect(diagnostics.tileFetchFailed).toBe(0);
    expect(diagnostics.prefetchQueued).toBe(0);
    expect(diagnostics.prefetchSkipped).toBe(0);
    expect(diagnostics.prefetchExecuted).toBe(0);
    expect(diagnostics.boundsSwitchRequested).toBe(0);
    expect(diagnostics.boundsSwitchApplied).toBe(0);
    expect(diagnostics.boundsSwitchSkippedSameSignature).toBe(0);
    expect(diagnostics.boundsSwitchStaleDropped).toBe(0);
    expect(diagnostics.boundsSwitchSkippedStaleToken).toBe(0);
    expect(diagnostics.boundsSwitchFailed).toBe(0);
    expect(diagnostics.duplicateTileCacheInvalidated).toBe(0);
    expect(diagnostics.duplicateTileReconcileRequested).toBe(0);
    expect(diagnostics.switchDurationMsTotal).toBe(0);
    expect(diagnostics.switchDurationMsMax).toBe(0);
    expect(diagnostics.switchDurationMsSamples).toEqual([]);
    expect(diagnostics.managerDurationMsTotal).toBe(0);
    expect(diagnostics.managerDurationMsMax).toBe(0);
    expect(diagnostics.managerDurationMsSamples).toEqual([]);
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
      "tile_fetch_started",
      "tile_fetch_succeeded",
      "tile_fetch_failed",
      "prefetch_queued",
      "prefetch_skipped",
      "prefetch_executed",
      "bounds_switch_requested",
      "bounds_switch_applied",
      "bounds_switch_skipped_same_signature",
      "bounds_switch_stale_dropped",
      "bounds_switch_skipped_stale_token",
      "bounds_switch_failed",
      "refresh_requested",
      "refresh_executed",
      "refresh_superseded",
      "duplicate_tile_cache_invalidated",
      "duplicate_tile_reconcile_requested",
    ];

    events.forEach((event) => recordChunkDiagnosticsEvent(diagnostics, event));

    expect(diagnostics.transitionStarted).toBe(1);
    expect(diagnostics.transitionCommitted).toBe(1);
    expect(diagnostics.transitionRolledBack).toBe(1);
    expect(diagnostics.transitionPrepareStaleDropped).toBe(1);
    expect(diagnostics.managerUpdateStarted).toBe(1);
    expect(diagnostics.managerUpdateSkippedStale).toBe(1);
    expect(diagnostics.managerUpdateFailed).toBe(1);
    expect(diagnostics.tileFetchStarted).toBe(1);
    expect(diagnostics.tileFetchSucceeded).toBe(1);
    expect(diagnostics.tileFetchFailed).toBe(1);
    expect(diagnostics.prefetchQueued).toBe(1);
    expect(diagnostics.prefetchSkipped).toBe(1);
    expect(diagnostics.prefetchExecuted).toBe(1);
    expect(diagnostics.boundsSwitchRequested).toBe(1);
    expect(diagnostics.boundsSwitchApplied).toBe(1);
    expect(diagnostics.boundsSwitchSkippedSameSignature).toBe(1);
    expect(diagnostics.boundsSwitchStaleDropped).toBe(1);
    expect(diagnostics.boundsSwitchSkippedStaleToken).toBe(1);
    expect(diagnostics.boundsSwitchFailed).toBe(1);
    expect(diagnostics.refreshRequested).toBe(1);
    expect(diagnostics.refreshExecuted).toBe(1);
    expect(diagnostics.refreshSuperseded).toBe(1);
    expect(diagnostics.duplicateTileCacheInvalidated).toBe(1);
    expect(diagnostics.duplicateTileReconcileRequested).toBe(1);
  });

  it("accumulates switch and manager durations", () => {
    const diagnostics = createWorldmapChunkDiagnostics();

    recordChunkDiagnosticsEvent(diagnostics, "switch_duration_recorded", { durationMs: 12.5 });
    recordChunkDiagnosticsEvent(diagnostics, "switch_duration_recorded", { durationMs: 4.5 });
    recordChunkDiagnosticsEvent(diagnostics, "manager_duration_recorded", { durationMs: 6 });
    recordChunkDiagnosticsEvent(diagnostics, "manager_duration_recorded", { durationMs: 9 });

    expect(diagnostics.switchDurationMsTotal).toBeCloseTo(17);
    expect(diagnostics.switchDurationMsMax).toBeCloseTo(12.5);
    expect(diagnostics.switchDurationMsSamples).toEqual([12.5, 4.5]);
    expect(diagnostics.managerDurationMsTotal).toBeCloseTo(15);
    expect(diagnostics.managerDurationMsMax).toBeCloseTo(9);
    expect(diagnostics.managerDurationMsSamples).toEqual([6, 9]);
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
});

describe("worldmap-chunk-diagnostics – Stage 0: terrain commit and refresh reason events", () => {
  it("records terrain_visible_commit events", () => {
    const diagnostics = createWorldmapChunkDiagnostics();

    recordChunkDiagnosticsEvent(diagnostics, "terrain_visible_commit" as WorldmapChunkDiagnosticsEvent);
    recordChunkDiagnosticsEvent(diagnostics, "terrain_visible_commit" as WorldmapChunkDiagnosticsEvent);

    // Stage 0: new counter field for tracking terrain commits to visible scene
    expect(diagnostics).toHaveProperty("terrainVisibleCommit", 2);
  });

  it("records refresh_reason breakdown events", () => {
    const diagnostics = createWorldmapChunkDiagnostics();

    const refreshReasonEvents = [
      "refresh_reason_default",
      "refresh_reason_hydrated_chunk",
      "refresh_reason_duplicate_tile",
    ] as WorldmapChunkDiagnosticsEvent[];

    refreshReasonEvents.forEach((event) => recordChunkDiagnosticsEvent(diagnostics, event));
    recordChunkDiagnosticsEvent(diagnostics, "refresh_reason_duplicate_tile" as WorldmapChunkDiagnosticsEvent);

    // Stage 0: each refresh reason gets its own counter
    expect(diagnostics).toHaveProperty("refreshReasonDefault", 1);
    expect(diagnostics).toHaveProperty("refreshReasonHydratedChunk", 1);
    expect(diagnostics).toHaveProperty("refreshReasonDuplicateTile", 2);
  });

  it("records duplicate tile reconcile mode breakdown events", () => {
    const diagnostics = createWorldmapChunkDiagnostics();

    recordChunkDiagnosticsEvent(
      diagnostics,
      "duplicate_tile_reconcile_mode_invalidate_only" as WorldmapChunkDiagnosticsEvent,
    );
    recordChunkDiagnosticsEvent(
      diagnostics,
      "duplicate_tile_reconcile_mode_local_reconcile" as WorldmapChunkDiagnosticsEvent,
    );
    recordChunkDiagnosticsEvent(
      diagnostics,
      "duplicate_tile_reconcile_mode_atomic_refresh" as WorldmapChunkDiagnosticsEvent,
    );

    // Stage 0: per-mode counters for duplicate tile reconciliation
    expect(diagnostics).toHaveProperty("duplicateTileReconcileModeInvalidateOnly", 1);
    expect(diagnostics).toHaveProperty("duplicateTileReconcileModeLocalReconcile", 1);
    expect(diagnostics).toHaveProperty("duplicateTileReconcileModeAtomicRefresh", 1);
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
});
