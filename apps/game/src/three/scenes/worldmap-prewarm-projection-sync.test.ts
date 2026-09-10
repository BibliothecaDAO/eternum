import { describe, expect, it, vi } from "vitest";

describe("prewarmDirectionalPresentationChunk projection sync", () => {
  it("prepareWorldmapChunkPresentation skips terrain when projectionSyncPromise resolves false", async () => {
    // This test validates that the downstream presentation function correctly
    // gates terrain preparation on projection sync, so a failed local sync
    // prevents stale terrain from being cached.
    const { prepareWorldmapChunkPresentation } = await import("./worldmap-chunk-presentation");

    const prepareTerrainChunk = vi.fn().mockResolvedValue({ chunkKey: "24,24" });

    const result = await prepareWorldmapChunkPresentation({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      renderSize: { height: 80, width: 90 },
      projectionSyncPromise: Promise.resolve(false),
      assetPrewarmPromise: Promise.resolve(),
      prepareTerrainChunk,
    });

    expect(result.projectionSyncSucceeded).toBe(false);
    expect(result.preparedTerrain).toBeNull();
    expect(prepareTerrainChunk).not.toHaveBeenCalled();
  });

  it("prewarmWorldmapChunkPresentation returns sync_failed when projection sync fails", async () => {
    const { prewarmWorldmapChunkPresentation } = await import("./worldmap-chunk-presentation");

    const cachePreparedTerrain = vi.fn();

    const result = await prewarmWorldmapChunkPresentation({
      chunkKey: "24,24",
      prewarmToken: 7,
      isLatestToken: () => true,
      isPresentationHot: () => false,
      preparePresentation: async () => ({
        projectionSyncSucceeded: false,
        preparedTerrain: null,
      }),
      cachePreparedTerrain,
    });

    expect(result.status).toBe("sync_failed");
    expect(result.preparedTerrain).toBeNull();
    expect(cachePreparedTerrain).not.toHaveBeenCalled();
  });

  it("cached terrain from prewarm reflects real tile data when fetch succeeds", async () => {
    const { prewarmWorldmapChunkPresentation } = await import("./worldmap-chunk-presentation");

    const terrainData = { chunkKey: "24,24", vertices: [1, 2, 3] };
    const cachePreparedTerrain = vi.fn();

    const result = await prewarmWorldmapChunkPresentation({
      chunkKey: "24,24",
      prewarmToken: 7,
      isLatestToken: () => true,
      isPresentationHot: () => false,
      preparePresentation: async () => ({
        projectionSyncSucceeded: true,
        preparedTerrain: terrainData,
      }),
      cachePreparedTerrain,
    });

    expect(result.status).toBe("prepared");
    expect(result.preparedTerrain).toBe(terrainData);
    expect(cachePreparedTerrain).toHaveBeenCalledWith(terrainData);
  });
});
