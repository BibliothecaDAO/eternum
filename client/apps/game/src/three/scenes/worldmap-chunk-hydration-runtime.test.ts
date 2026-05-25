import { describe, expect, it, vi } from "vitest";

const createWorldmapChunkPresentationRuntime = vi.fn();
const hydrateWarpTravelChunk = vi.fn();

vi.mock("./worldmap-chunk-presentation-runtime", () => ({
  createWorldmapChunkPresentationRuntime,
}));

vi.mock("./warp-travel-chunk-hydration", () => ({
  hydrateWarpTravelChunk,
}));

const { hydrateWorldmapChunkRuntime } = await import("./worldmap-chunk-hydration-runtime");

describe("hydrateWorldmapChunkRuntime", () => {
  it("builds the presentation runtime once and passes its callbacks into warp-travel hydration", async () => {
    const presentationRuntime = {
      onChunkHydrated: vi.fn(),
      phaseDurations: {
        structureAssetPrewarmMs: 1,
        structureHydrationDrainMs: 2,
        terrainPreparedMs: 3,
        tileHydrationDrainMs: 4,
      },
      prepareTerrainChunk: vi.fn(),
      prewarmChunkAssets: vi.fn(),
      waitForStructureHydrationIdle: vi.fn(),
      waitForTileHydrationIdle: vi.fn(),
    };
    createWorldmapChunkPresentationRuntime.mockReturnValue(presentationRuntime);
    hydrateWarpTravelChunk.mockResolvedValue({
      preparedTerrain: { chunkKey: "24,24" },
      tileFetchSucceeded: true,
    });

    const result = await hydrateWorldmapChunkRuntime({
      chunkKey: "24,24",
      computeTileEntities: vi.fn(),
      diagnostics: { id: "diagnostics" } as never,
      now: () => 10,
      onChunkHydrated: vi.fn(),
      onPhaseTimeout: vi.fn(),
      phaseTimeoutMs: 500,
      prewarmChunkAssets: vi.fn(),
      prepareTerrainChunk: vi.fn(),
      recordChunkDiagnosticsEvent: vi.fn(),
      recordWorldmapRenderDuration: vi.fn(),
      renderSize: { height: 80, width: 90 },
      startCol: 24,
      startRow: 24,
      surroundingChunks: ["0,24"],
      transitionToken: 7,
      updateBoundsSubscription: vi.fn(),
      updatePinnedChunks: vi.fn(),
      waitForStructureHydrationIdle: vi.fn(),
      waitForTileHydrationIdle: vi.fn(),
    });

    expect(createWorldmapChunkPresentationRuntime).toHaveBeenCalledTimes(1);
    expect(hydrateWarpTravelChunk).toHaveBeenCalledWith(
      expect.objectContaining({
        chunkKey: "24,24",
        onChunkHydrated: presentationRuntime.onChunkHydrated,
        prepareTerrainChunk: presentationRuntime.prepareTerrainChunk,
        prewarmChunkAssets: presentationRuntime.prewarmChunkAssets,
        waitForStructureHydrationIdle: presentationRuntime.waitForStructureHydrationIdle,
        waitForTileHydrationIdle: presentationRuntime.waitForTileHydrationIdle,
      }),
    );
    expect(result).toEqual({
      preparedTerrain: { chunkKey: "24,24" },
      presentationRuntime,
      tileFetchSucceeded: true,
    });
  });
});
