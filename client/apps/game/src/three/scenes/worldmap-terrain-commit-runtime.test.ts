import { describe, expect, it, vi } from "vitest";

import {
  commitWorldmapPreparedTerrainPresentation,
  recordWorldmapTerrainReadyDuration,
} from "./worldmap-terrain-commit-runtime";

describe("recordWorldmapTerrainReadyDuration", () => {
  it("records terrain-ready diagnostics and render duration", () => {
    const recordChunkDiagnosticsEvent = vi.fn();
    const recordWorldmapRenderDuration = vi.fn();

    recordWorldmapTerrainReadyDuration({
      diagnostics: { id: "diagnostics" } as never,
      nowMs: 145,
      recordChunkDiagnosticsEvent,
      recordWorldmapRenderDuration,
      startedAtMs: 100,
    });

    expect(recordChunkDiagnosticsEvent).toHaveBeenCalledWith({ id: "diagnostics" }, "terrain_ready_duration_recorded", {
      durationMs: 45,
    });
    expect(recordWorldmapRenderDuration).toHaveBeenCalledWith("chunkTerrainReadyMs", 45);
  });
});

describe("commitWorldmapPreparedTerrainPresentation", () => {
  it("applies terrain, records commit metrics, and emits presentation skew when phase timings exist", () => {
    const applyPreparedTerrain = vi.fn(() => {
      nowMs = 112;
    });
    const incrementWorldmapRenderCounter = vi.fn();
    const recordChunkDiagnosticsEvent = vi.fn();
    const recordWorldmapRenderDuration = vi.fn();
    let nowMs = 100;

    commitWorldmapPreparedTerrainPresentation({
      applyPreparedTerrain,
      diagnostics: { id: "diagnostics" } as never,
      now: () => nowMs,
      onAfterApply: vi.fn(),
      phaseDurations: {
        structureAssetPrewarmMs: 18,
        structureHydrationDrainMs: 10,
        terrainPreparedMs: 22,
        tileHydrationDrainMs: 8,
      },
      preparedTerrain: { chunkKey: "24,24" },
      presentationStartedAtMs: 60,
      recordChunkDiagnosticsEvent,
      recordWorldmapRenderDuration,
      incrementWorldmapRenderCounter,
    });

    expect(applyPreparedTerrain).toHaveBeenCalledWith({ chunkKey: "24,24" });
    expect(recordChunkDiagnosticsEvent).toHaveBeenCalledWith(
      { id: "diagnostics" },
      "terrain_commit_duration_recorded",
      { durationMs: 12 },
    );
    expect(recordChunkDiagnosticsEvent).toHaveBeenCalledWith(
      { id: "diagnostics" },
      "first_visible_commit_duration_recorded",
      { durationMs: 52 },
    );
    expect(recordChunkDiagnosticsEvent).toHaveBeenCalledWith({ id: "diagnostics" }, "terrain_visible_commit");
    expect(recordWorldmapRenderDuration).toHaveBeenCalledWith("chunkTerrainCommitMs", 12);
    expect(recordWorldmapRenderDuration).toHaveBeenCalledWith("presentationCommittedMs", 52);
    expect(recordWorldmapRenderDuration).toHaveBeenCalledWith("presentationSkewMs", 14);
    expect(incrementWorldmapRenderCounter).toHaveBeenCalledWith("terrainVisibleCommits");
  });

  it("skips presentation skew when no phase duration has been recorded", () => {
    const recordWorldmapRenderDuration = vi.fn();

    commitWorldmapPreparedTerrainPresentation({
      applyPreparedTerrain: vi.fn(),
      diagnostics: {} as never,
      now: () => 10,
      phaseDurations: {
        structureAssetPrewarmMs: 0,
        structureHydrationDrainMs: 0,
        terrainPreparedMs: 0,
        tileHydrationDrainMs: 0,
      },
      preparedTerrain: { chunkKey: "0,0" },
      presentationStartedAtMs: 4,
      recordChunkDiagnosticsEvent: vi.fn(),
      recordWorldmapRenderDuration,
      incrementWorldmapRenderCounter: vi.fn(),
    });

    expect(recordWorldmapRenderDuration).not.toHaveBeenCalledWith("presentationSkewMs", expect.any(Number));
  });
});
