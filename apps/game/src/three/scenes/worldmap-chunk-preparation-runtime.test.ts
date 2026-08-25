import { describe, expect, it, vi } from "vitest";

const createWorldmapChunkPresentationRuntime = vi.fn();
const prepareWarpTravelChunk = vi.fn();

vi.mock("./worldmap-chunk-presentation-runtime", () => ({
  createWorldmapChunkPresentationRuntime,
}));

vi.mock("./warp-travel-chunk-preparation", () => ({
  prepareWarpTravelChunk,
}));

const { prepareWorldmapChunkRuntime } = await import("./worldmap-chunk-preparation-runtime");

describe("prepareWorldmapChunkRuntime", () => {
  it("builds the presentation runtime once and passes its callbacks into warp-travel preparation", async () => {
    const presentationRuntime = {
      onChunkPrepared: vi.fn(),
      phaseDurations: {
        structureAssetPrewarmMs: 1,
        terrainPreparedMs: 3,
      },
      prepareTerrainChunk: vi.fn(),
      prewarmChunkAssets: vi.fn(),
    };
    createWorldmapChunkPresentationRuntime.mockReturnValue(presentationRuntime);
    prepareWarpTravelChunk.mockResolvedValue({
      preparedTerrain: { chunkKey: "24,24" },
      projectionSyncSucceeded: true,
    });

    const result = await prepareWorldmapChunkRuntime({
      chunkKey: "24,24",
      syncProjectionTiles: vi.fn(),
      now: () => 10,
      onChunkPrepared: vi.fn(),
      onPhaseTimeout: vi.fn(),
      phaseTimeoutMs: 500,
      prewarmChunkAssets: vi.fn(),
      prepareTerrainChunk: vi.fn(),
      recordWorldmapRenderDuration: vi.fn(),
      renderSize: { height: 80, width: 90 },
      startCol: 24,
      startRow: 24,
      surroundingChunks: ["0,24"],
      updatePinnedChunks: vi.fn(),
    });

    expect(createWorldmapChunkPresentationRuntime).toHaveBeenCalledTimes(1);
    expect(prepareWarpTravelChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        chunkKey: "24,24",
        onChunkPrepared: presentationRuntime.onChunkPrepared,
        prepareTerrainChunk: presentationRuntime.prepareTerrainChunk,
        prewarmChunkAssets: presentationRuntime.prewarmChunkAssets,
      }),
    );
    expect(result).toEqual({
      preparedTerrain: { chunkKey: "24,24" },
      presentationRuntime,
      projectionSyncSucceeded: true,
    });
  });
});
