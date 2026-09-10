import { describe, expect, it, vi } from "vitest";

import { prewarmWorldmapChunkPresentation } from "./worldmap-chunk-presentation";

describe("prewarmWorldmapChunkPresentation", () => {
  it("skips chunks whose presentation is already hot", async () => {
    const preparePresentation = vi.fn();
    const cachePreparedTerrain = vi.fn();

    const result = await prewarmWorldmapChunkPresentation({
      chunkKey: "24,24",
      prewarmToken: 7,
      isLatestToken: () => true,
      isPresentationHot: () => true,
      preparePresentation,
      cachePreparedTerrain,
    });

    expect(result).toEqual({
      status: "skipped_hot",
      preparedTerrain: null,
    });
    expect(preparePresentation).not.toHaveBeenCalled();
    expect(cachePreparedTerrain).not.toHaveBeenCalled();
  });

  it("caches prepared terrain without mutating the visible chunk", async () => {
    const preparedTerrain = { chunkKey: "24,24" };
    const cachePreparedTerrain = vi.fn();

    const result = await prewarmWorldmapChunkPresentation({
      chunkKey: "24,24",
      prewarmToken: 7,
      isLatestToken: () => true,
      isPresentationHot: () => false,
      preparePresentation: async () => ({
        projectionSyncSucceeded: true,
        preparedTerrain,
      }),
      cachePreparedTerrain,
    });

    expect(result).toEqual({
      status: "prepared",
      preparedTerrain,
    });
    expect(cachePreparedTerrain).toHaveBeenCalledWith(preparedTerrain);
  });

  it("drops stale prepared presentation instead of caching it", async () => {
    const cachePreparedTerrain = vi.fn();

    const result = await prewarmWorldmapChunkPresentation({
      chunkKey: "24,24",
      prewarmToken: 7,
      isLatestToken: () => false,
      isPresentationHot: () => false,
      preparePresentation: async () => ({
        projectionSyncSucceeded: true,
        preparedTerrain: { chunkKey: "24,24" },
      }),
      cachePreparedTerrain,
    });

    expect(result).toEqual({
      status: "stale_dropped",
      preparedTerrain: null,
    });
    expect(cachePreparedTerrain).not.toHaveBeenCalled();
  });
});
