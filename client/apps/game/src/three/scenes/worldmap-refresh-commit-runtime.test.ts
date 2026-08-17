import { describe, expect, it, vi } from "vitest";

import { handleWorldmapRefreshCommitRuntime } from "./worldmap-refresh-commit-runtime";

describe("handleWorldmapRefreshCommitRuntime", () => {
  it("returns early when tile sync did not succeed", async () => {
    const result = await handleWorldmapRefreshCommitRuntime({
      chunkKey: "24,24",
      commitPreparedTerrain: vi.fn(),
      diagnostics: { id: "diagnostics" } as never,
      force: true,
      onStaleDrop: vi.fn(),
      preparedTerrain: { chunkKey: "24,24" },
      recordChunkDiagnosticsEvent: vi.fn(),
      refreshDecision: { shouldCommit: false, shouldDropAsStale: false },
      runImmediateFullManagerCatchUp: vi.fn(async () => undefined),
      runImmediateCriticalManagerCatchUp: vi.fn(async () => undefined),
      scheduleDeferredNonCriticalManagerCatchUp: vi.fn(),
      stagedPathEnabled: true,
      projectionSyncSucceeded: false,
      transitionToken: 7,
    });

    expect(result).toBe("skipped");
  });

  it("records stale drops and skips manager catch-up", async () => {
    const recordChunkDiagnosticsEvent = vi.fn();
    const result = await handleWorldmapRefreshCommitRuntime({
      chunkKey: "24,24",
      commitPreparedTerrain: vi.fn(),
      diagnostics: { id: "diagnostics" } as never,
      force: true,
      onStaleDrop: vi.fn(),
      preparedTerrain: { chunkKey: "24,24" },
      recordChunkDiagnosticsEvent,
      refreshDecision: { shouldCommit: false, shouldDropAsStale: true },
      runImmediateFullManagerCatchUp: vi.fn(async () => undefined),
      runImmediateCriticalManagerCatchUp: vi.fn(async () => undefined),
      scheduleDeferredNonCriticalManagerCatchUp: vi.fn(),
      stagedPathEnabled: true,
      projectionSyncSucceeded: true,
      transitionToken: 9,
    });

    expect(result).toBe("stale_dropped");
    expect(recordChunkDiagnosticsEvent).toHaveBeenCalledWith({ id: "diagnostics" }, "stale_terrain_refresh_dropped");
  });

  // Phase 2.2: prepared terrain dropped without commit (stale, or shouldCommit
  // false) holds pooled attributes that must be released, not leaked.
  it("disposes prepared terrain on a stale drop", async () => {
    const disposePreparedTerrain = vi.fn();
    const preparedTerrain = { chunkKey: "24,24" };
    const result = await handleWorldmapRefreshCommitRuntime({
      chunkKey: "24,24",
      commitPreparedTerrain: vi.fn(),
      disposePreparedTerrain,
      diagnostics: { id: "diagnostics" } as never,
      force: true,
      onStaleDrop: vi.fn(),
      preparedTerrain,
      recordChunkDiagnosticsEvent: vi.fn(),
      refreshDecision: { shouldCommit: false, shouldDropAsStale: true },
      runImmediateFullManagerCatchUp: vi.fn(async () => undefined),
      runImmediateCriticalManagerCatchUp: vi.fn(async () => undefined),
      scheduleDeferredNonCriticalManagerCatchUp: vi.fn(),
      stagedPathEnabled: true,
      projectionSyncSucceeded: true,
      transitionToken: 9,
    });

    expect(result).toBe("stale_dropped");
    expect(disposePreparedTerrain).toHaveBeenCalledWith(preparedTerrain);
  });

  it("disposes prepared terrain when the refresh is not committed but terrain was prepared", async () => {
    const commitPreparedTerrain = vi.fn();
    const disposePreparedTerrain = vi.fn();
    const preparedTerrain = { chunkKey: "24,24" };
    const result = await handleWorldmapRefreshCommitRuntime({
      chunkKey: "24,24",
      commitPreparedTerrain,
      disposePreparedTerrain,
      diagnostics: { id: "diagnostics" } as never,
      force: true,
      onStaleDrop: vi.fn(),
      preparedTerrain,
      recordChunkDiagnosticsEvent: vi.fn(),
      refreshDecision: { shouldCommit: false, shouldDropAsStale: false },
      runImmediateFullManagerCatchUp: vi.fn(async () => undefined),
      runImmediateCriticalManagerCatchUp: vi.fn(async () => undefined),
      scheduleDeferredNonCriticalManagerCatchUp: vi.fn(),
      stagedPathEnabled: true,
      projectionSyncSucceeded: true,
      transitionToken: 10,
    });

    expect(result).toBe("skipped");
    expect(commitPreparedTerrain).not.toHaveBeenCalled();
    expect(disposePreparedTerrain).toHaveBeenCalledWith(preparedTerrain);
  });

  it("does not dispose prepared terrain on a committed refresh", async () => {
    const disposePreparedTerrain = vi.fn();
    const result = await handleWorldmapRefreshCommitRuntime({
      chunkKey: "48,48",
      commitPreparedTerrain: vi.fn(),
      disposePreparedTerrain,
      diagnostics: { id: "diagnostics" } as never,
      force: true,
      onStaleDrop: vi.fn(),
      preparedTerrain: { chunkKey: "48,48" },
      recordChunkDiagnosticsEvent: vi.fn(),
      refreshDecision: { shouldCommit: true, shouldDropAsStale: false },
      runImmediateFullManagerCatchUp: vi.fn(async () => undefined),
      runImmediateCriticalManagerCatchUp: vi.fn(async () => undefined),
      scheduleDeferredNonCriticalManagerCatchUp: vi.fn(),
      stagedPathEnabled: true,
      projectionSyncSucceeded: true,
      transitionToken: 11,
    });

    expect(result).toBe("committed");
    expect(disposePreparedTerrain).not.toHaveBeenCalled();
  });

  it("commits terrain, runs immediate critical catch-up, and defers non-critical catch-up when staged rollout is enabled", async () => {
    const commitPreparedTerrain = vi.fn();
    const runImmediateCriticalManagerCatchUp = vi.fn(async () => undefined);
    const scheduleDeferredNonCriticalManagerCatchUp = vi.fn();

    const result = await handleWorldmapRefreshCommitRuntime({
      chunkKey: "48,48",
      commitPreparedTerrain,
      diagnostics: { id: "diagnostics" } as never,
      force: true,
      onStaleDrop: vi.fn(),
      preparedTerrain: { chunkKey: "48,48" },
      recordChunkDiagnosticsEvent: vi.fn(),
      refreshDecision: { shouldCommit: true, shouldDropAsStale: false },
      runImmediateFullManagerCatchUp: vi.fn(async () => undefined),
      runImmediateCriticalManagerCatchUp,
      scheduleDeferredNonCriticalManagerCatchUp,
      stagedPathEnabled: true,
      projectionSyncSucceeded: true,
      transitionToken: 11,
    });

    expect(result).toBe("committed");
    expect(commitPreparedTerrain).toHaveBeenCalledWith({ chunkKey: "48,48" });
    expect(runImmediateCriticalManagerCatchUp).toHaveBeenCalledWith("48,48", { force: true, transitionToken: 11 });
    expect(scheduleDeferredNonCriticalManagerCatchUp).toHaveBeenCalledWith("48,48", {
      force: true,
      transitionToken: 11,
    });
  });

  it("commits terrain and runs immediate manager catch-up when staged rollout is disabled", async () => {
    const runImmediateFullManagerCatchUp = vi.fn(async () => undefined);

    const result = await handleWorldmapRefreshCommitRuntime({
      chunkKey: "72,72",
      commitPreparedTerrain: vi.fn(),
      diagnostics: { id: "diagnostics" } as never,
      force: true,
      onStaleDrop: vi.fn(),
      preparedTerrain: { chunkKey: "72,72" },
      recordChunkDiagnosticsEvent: vi.fn(),
      refreshDecision: { shouldCommit: true, shouldDropAsStale: false },
      runImmediateFullManagerCatchUp,
      runImmediateCriticalManagerCatchUp: vi.fn(async () => undefined),
      scheduleDeferredNonCriticalManagerCatchUp: vi.fn(),
      stagedPathEnabled: false,
      projectionSyncSucceeded: true,
      transitionToken: 13,
    });

    expect(result).toBe("committed");
    expect(runImmediateFullManagerCatchUp).toHaveBeenCalledWith("72,72", { force: true, transitionToken: 13 });
  });
});
