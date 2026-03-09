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
    expect(diagnostics.refreshRequested).toBe(0);
    expect(diagnostics.forcedRefreshRequested).toBe(0);
    expect(diagnostics.refreshRequestedBySource).toEqual({
      controls_change: 0,
      pending_movement_fallback: 0,
      pending_movement_selection: 0,
      duplicate_tile: 0,
      remove_explored: 0,
      structure_bounds: 0,
      perf_simulation: 0,
      unknown: 0,
    });
    expect(diagnostics.duplicateTileCacheInvalidated).toBe(0);
    expect(diagnostics.duplicateTileReconcileRequested).toBe(0);
    expect((diagnostics as { terrainCandidateBuilt?: number }).terrainCandidateBuilt).toBe(0);
    expect((diagnostics as { terrainCandidateRejected?: number }).terrainCandidateRejected).toBe(0);
    expect((diagnostics as { terrainCandidatePromoted?: number }).terrainCandidatePromoted).toBe(0);
    expect((diagnostics as { terrainCacheReuseAttempted?: number }).terrainCacheReuseAttempted).toBe(0);
    expect((diagnostics as { terrainCacheReuseRejected?: number }).terrainCacheReuseRejected).toBe(0);
    expect((diagnostics as { terrainReconcileRequested?: number }).terrainReconcileRequested).toBe(0);
    expect((diagnostics as { terrainReconcileDroppedStale?: number }).terrainReconcileDroppedStale).toBe(0);
    expect((diagnostics as { terrainFallbackRecoveryStarted?: number }).terrainFallbackRecoveryStarted).toBe(0);
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
      "terrain_candidate_built",
      "terrain_candidate_rejected",
      "terrain_candidate_promoted",
      "terrain_cache_reuse_attempted",
      "terrain_cache_reuse_rejected",
      "terrain_reconcile_requested",
      "terrain_reconcile_dropped_stale",
      "terrain_fallback_recovery_started",
    ];

    events.forEach((event) =>
      recordChunkDiagnosticsEvent(
        diagnostics,
        event,
        event === "refresh_requested" ? { source: "controls_change" } : {},
      ),
    );

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
    expect(diagnostics.forcedRefreshRequested).toBe(0);
    expect(diagnostics.refreshRequestedBySource.controls_change).toBe(1);
    expect(diagnostics.refreshExecuted).toBe(1);
    expect(diagnostics.refreshSuperseded).toBe(1);
    expect(diagnostics.duplicateTileCacheInvalidated).toBe(1);
    expect(diagnostics.duplicateTileReconcileRequested).toBe(1);
    expect((diagnostics as { terrainCandidateBuilt?: number }).terrainCandidateBuilt).toBe(1);
    expect((diagnostics as { terrainCandidateRejected?: number }).terrainCandidateRejected).toBe(1);
    expect((diagnostics as { terrainCandidatePromoted?: number }).terrainCandidatePromoted).toBe(1);
    expect((diagnostics as { terrainCacheReuseAttempted?: number }).terrainCacheReuseAttempted).toBe(1);
    expect((diagnostics as { terrainCacheReuseRejected?: number }).terrainCacheReuseRejected).toBe(1);
    expect((diagnostics as { terrainReconcileRequested?: number }).terrainReconcileRequested).toBe(1);
    expect((diagnostics as { terrainReconcileDroppedStale?: number }).terrainReconcileDroppedStale).toBe(1);
    expect((diagnostics as { terrainFallbackRecoveryStarted?: number }).terrainFallbackRecoveryStarted).toBe(1);
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

  it("tracks forced refreshes by source", () => {
    const diagnostics = createWorldmapChunkDiagnostics();

    recordChunkDiagnosticsEvent(diagnostics, "refresh_requested", {
      source: "controls_change",
      force: false,
    });
    recordChunkDiagnosticsEvent(diagnostics, "refresh_requested", {
      source: "duplicate_tile",
      force: true,
    });

    expect(diagnostics.refreshRequested).toBe(2);
    expect(diagnostics.forcedRefreshRequested).toBe(1);
    expect(diagnostics.refreshRequestedBySource.controls_change).toBe(1);
    expect(diagnostics.refreshRequestedBySource.duplicate_tile).toBe(1);
  });
});
