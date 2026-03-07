import { describe, expect, it } from "vitest";

import {
  WORLDMAP_PERF_DEBUG_HOOK_NAMES,
  installWorldmapPerfDebugHooks,
  removeWorldmapPerfDebugHooks,
} from "./worldmap-perf-debug-hooks";

describe("worldmap perf debug hooks", () => {
  it("registers the full benchmark hook surface in DEV mode", () => {
    expect(WORLDMAP_PERF_DEBUG_HOOK_NAMES).toContain("forceWorldmapChunkRefresh");

    const target: Record<string, unknown> = {};
    const diagnostics = {
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
      switchDurationMsTotal: 0,
      switchDurationMsMax: 0,
      switchDurationMsSamples: [],
      managerDurationMsTotal: 0,
      managerDurationMsMax: 0,
      managerDurationMsSamples: [],
      updatedAtMs: 0,
    };
    const chunkSnapshot = {
      diagnostics,
      baselines: [],
      currentChunk: "0,0",
      chunkTransitionToken: 0,
      chunkRefreshRequestToken: 0,
      chunkRefreshAppliedToken: 0,
    };
    const debugArmies = {
      debugArmyCount: 0,
      totalArmyCount: 0,
      visibleArmyCount: 0,
    };
    const perfState = {
      currentChunk: "0,0",
      currentChunkSize: 16,
      renderChunkSize: { width: 48, height: 48 },
      cameraTargetHex: { col: 0, row: 0 },
      simulateAllExplored: false,
      biomeAnimationsEnabled: true,
      biomeShadowsEnabled: true,
      visibleArmies: 0,
      visibleStructures: 0,
      visibleChests: 0,
      debugArmies,
    };
    const performanceReport = {
      metrics: {},
      memory: { matrixPool: { available: 0, inUse: 0, totalAllocated: 0, memoryMB: 0 } },
      frameTime: { avg: 0, min: 0, max: 0, last: 0, p50: 0, p95: 0, sampleCount: 0 },
      discoveredHexCount: 0,
    };
    const callbacks = {
      getChunkDiagnostics: () => chunkSnapshot,
      resetChunkDiagnostics: () => undefined,
      captureChunkBaseline: () => ({ label: "baseline", capturedAtMs: 0, diagnostics }),
      evaluateChunkSwitchP95Regression: () => ({ status: "pass" }),
      evaluateTileFetchVolumeRegression: () => ({ status: "pass" }),
      getPerformanceReport: () => performanceReport,
      resetPerformanceReport: () => undefined,
      getPerfState: () => perfState,
      setPerfState: async () => perfState,
      spawnDebugArmies: async () => debugArmies,
      clearDebugArmies: () => debugArmies,
      forceChunkRefresh: async () => perfState,
      moveToChunkOffset: async () => perfState,
      getBenchmarkSnapshot: () => ({
        diagnostics: chunkSnapshot,
        performance: performanceReport,
        state: perfState,
      }),
    };

    installWorldmapPerfDebugHooks({ callbacks, target, isDev: true });

    WORLDMAP_PERF_DEBUG_HOOK_NAMES.forEach((hookName) => {
      expect(target[hookName]).toBeTypeOf("function");
    });
  });

  it("removes all registered benchmark hooks", () => {
    const target: Record<string, unknown> = {};

    WORLDMAP_PERF_DEBUG_HOOK_NAMES.forEach((hookName) => {
      target[hookName] = () => undefined;
    });

    removeWorldmapPerfDebugHooks({ target });

    WORLDMAP_PERF_DEBUG_HOOK_NAMES.forEach((hookName) => {
      expect(target[hookName]).toBeUndefined();
    });
  });
});
