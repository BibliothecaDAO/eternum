import { describe, expect, it, vi } from "vitest";

import { createWorldmapChunkPresentationRuntime } from "./worldmap-chunk-presentation-runtime";

describe("createWorldmapChunkPresentationRuntime", () => {
  it("records phase durations through the wrapped presentation callbacks", async () => {
    let nowMs = 100;
    const recordDuration = vi.fn();
    const runtime = createWorldmapChunkPresentationRuntime({
      now: () => nowMs,
      onChunkPrepared: vi.fn(),
      prewarmChunkAssets: async () => {
        nowMs += 12;
      },
      prepareTerrainChunk: async () => {
        nowMs += 14;
        return { chunkKey: "prepared" };
      },
      recordDuration,
    });

    await runtime.prewarmChunkAssets("24,24");
    await runtime.prepareTerrainChunk(24, 24, 80, 90);

    expect(runtime.phaseDurations).toEqual({
      structureAssetPrewarmMs: 12,
      terrainPreparedMs: 14,
    });
    expect(recordDuration).toHaveBeenCalledWith("structureAssetPrewarmMs", 12);
    expect(recordDuration).toHaveBeenCalledWith("terrainPreparedMs", 14);
  });

  it("forwards chunk preparation completion to the owner callback", () => {
    const onChunkPrepared = vi.fn();
    const runtime = createWorldmapChunkPresentationRuntime({
      now: () => 0,
      onChunkPrepared,
      prewarmChunkAssets: async () => undefined,
      prepareTerrainChunk: async () => ({ chunkKey: "prepared" }),
      recordDuration: vi.fn(),
    });

    runtime.onChunkPrepared("48,48");

    expect(onChunkPrepared).toHaveBeenCalledWith("48,48");
  });
});
