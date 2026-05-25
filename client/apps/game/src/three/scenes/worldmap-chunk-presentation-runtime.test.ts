import { describe, expect, it, vi } from "vitest";

import { createWorldmapChunkPresentationRuntime } from "./worldmap-chunk-presentation-runtime";

describe("createWorldmapChunkPresentationRuntime", () => {
  it("records phase durations through the wrapped hydration callbacks", async () => {
    let nowMs = 100;
    const recordDuration = vi.fn();
    const recordTileHydrationDrainCompleted = vi.fn();
    const runtime = createWorldmapChunkPresentationRuntime({
      now: () => nowMs,
      onChunkHydrated: vi.fn(),
      prewarmChunkAssets: async () => {
        nowMs += 12;
      },
      prepareTerrainChunk: async () => {
        nowMs += 14;
        return { chunkKey: "prepared" };
      },
      recordDuration,
      recordTileHydrationDrainCompleted,
      waitForStructureHydrationIdle: async () => {
        nowMs = 118;
      },
      waitForTileHydrationIdle: async () => {
        nowMs = 108;
      },
    });

    await runtime.waitForTileHydrationIdle("24,24");
    await runtime.waitForStructureHydrationIdle("24,24");
    await runtime.prewarmChunkAssets("24,24");
    await runtime.prepareTerrainChunk(24, 24, 80, 90);

    expect(runtime.phaseDurations).toEqual({
      structureAssetPrewarmMs: 12,
      structureHydrationDrainMs: 10,
      terrainPreparedMs: 14,
      tileHydrationDrainMs: 8,
    });
    expect(recordDuration).toHaveBeenCalledWith("tileHydrationDrainMs", 8);
    expect(recordDuration).toHaveBeenCalledWith("structureHydrationDrainMs", 10);
    expect(recordDuration).toHaveBeenCalledWith("structureAssetPrewarmMs", 12);
    expect(recordDuration).toHaveBeenCalledWith("terrainPreparedMs", 14);
    expect(recordTileHydrationDrainCompleted).toHaveBeenCalledTimes(1);
  });

  it("forwards chunk hydration completion to the owner callback", () => {
    const onChunkHydrated = vi.fn();
    const runtime = createWorldmapChunkPresentationRuntime({
      now: () => 0,
      onChunkHydrated,
      prewarmChunkAssets: async () => undefined,
      prepareTerrainChunk: async () => ({ chunkKey: "prepared" }),
      recordDuration: vi.fn(),
      recordTileHydrationDrainCompleted: vi.fn(),
      waitForStructureHydrationIdle: async () => undefined,
      waitForTileHydrationIdle: async () => undefined,
    });

    runtime.onChunkHydrated("48,48");

    expect(onChunkHydrated).toHaveBeenCalledWith("48,48");
  });
});
