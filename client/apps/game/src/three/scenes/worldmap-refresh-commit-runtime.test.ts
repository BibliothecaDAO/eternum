import { describe, expect, it, vi } from "vitest";

import { handleWorldmapRefreshCommitRuntime } from "./worldmap-refresh-commit-runtime";

describe("handleWorldmapRefreshCommitRuntime", () => {
  it("returns early when tile fetch did not succeed", async () => {
    const result = await handleWorldmapRefreshCommitRuntime({
      chunkKey: "24,24",
      commitPreparedTerrain: vi.fn(),
      diagnostics: { id: "diagnostics" } as never,
      force: true,
      onStaleDrop: vi.fn(),
      preparedTerrain: { chunkKey: "24,24" },
      recordChunkDiagnosticsEvent: vi.fn(),
      refreshDecision: { shouldCommit: false, shouldDropAsStale: false },
      runImmediateManagerCatchUp: vi.fn(async () => undefined),
      scheduleDeferredManagerCatchUp: vi.fn(),
      stagedPathEnabled: true,
      tileFetchSucceeded: false,
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
      runImmediateManagerCatchUp: vi.fn(async () => undefined),
      scheduleDeferredManagerCatchUp: vi.fn(),
      stagedPathEnabled: true,
      tileFetchSucceeded: true,
      transitionToken: 9,
    });

    expect(result).toBe("stale_dropped");
    expect(recordChunkDiagnosticsEvent).toHaveBeenCalledWith({ id: "diagnostics" }, "stale_terrain_refresh_dropped");
  });

  it("commits terrain and schedules deferred manager catch-up when staged rollout is enabled", async () => {
    const commitPreparedTerrain = vi.fn();
    const scheduleDeferredManagerCatchUp = vi.fn();

    const result = await handleWorldmapRefreshCommitRuntime({
      chunkKey: "48,48",
      commitPreparedTerrain,
      diagnostics: { id: "diagnostics" } as never,
      force: true,
      onStaleDrop: vi.fn(),
      preparedTerrain: { chunkKey: "48,48" },
      recordChunkDiagnosticsEvent: vi.fn(),
      refreshDecision: { shouldCommit: true, shouldDropAsStale: false },
      runImmediateManagerCatchUp: vi.fn(async () => undefined),
      scheduleDeferredManagerCatchUp,
      stagedPathEnabled: true,
      tileFetchSucceeded: true,
      transitionToken: 11,
    });

    expect(result).toBe("committed");
    expect(commitPreparedTerrain).toHaveBeenCalledWith({ chunkKey: "48,48" });
    expect(scheduleDeferredManagerCatchUp).toHaveBeenCalledWith("48,48", { force: true, transitionToken: 11 });
  });

  it("commits terrain and runs immediate manager catch-up when staged rollout is disabled", async () => {
    const runImmediateManagerCatchUp = vi.fn(async () => undefined);

    const result = await handleWorldmapRefreshCommitRuntime({
      chunkKey: "72,72",
      commitPreparedTerrain: vi.fn(),
      diagnostics: { id: "diagnostics" } as never,
      force: true,
      onStaleDrop: vi.fn(),
      preparedTerrain: { chunkKey: "72,72" },
      recordChunkDiagnosticsEvent: vi.fn(),
      refreshDecision: { shouldCommit: true, shouldDropAsStale: false },
      runImmediateManagerCatchUp,
      scheduleDeferredManagerCatchUp: vi.fn(),
      stagedPathEnabled: false,
      tileFetchSucceeded: true,
      transitionToken: 13,
    });

    expect(result).toBe("committed");
    expect(runImmediateManagerCatchUp).toHaveBeenCalledWith("72,72", { force: true, transitionToken: 13 });
  });
});
