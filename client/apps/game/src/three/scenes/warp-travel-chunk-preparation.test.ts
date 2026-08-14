import { describe, expect, it } from "vitest";

import { prepareWarpTravelChunk } from "./warp-travel-chunk-preparation";
import { createControlledAsyncCall, flushMicrotasks } from "./worldmap-test-harness";

describe("prepareWarpTravelChunk", () => {
  it("prepares target terrain only after projection sync, bounds, and asset prewarm are ready", async () => {
    const syncProjectionTiles = createControlledAsyncCall<[string], boolean>();
    const updateBoundsSubscription = createControlledAsyncCall<[string, number], void>();
    const prewarmChunkAssets = createControlledAsyncCall<[string], void>();
    const prepareTerrainChunk = createControlledAsyncCall<
      [number, number, number, number],
      { chunkKey: string; expectedExploredTerrainInstances: number }
    >();
    const pinnedChunkUpdates: string[][] = [];
    const preparedChunks: string[] = [];

    const preparationPromise = prepareWarpTravelChunk({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      surroundingChunks: ["0,24", "24,0"],
      transitionToken: 7,
      renderSize: { height: 80, width: 90 },
      syncProjectionTiles: syncProjectionTiles.fn,
      updatePinnedChunks: (chunks) => pinnedChunkUpdates.push(chunks),
      updateBoundsSubscription: updateBoundsSubscription.fn,
      prewarmChunkAssets: prewarmChunkAssets.fn,
      prepareTerrainChunk: prepareTerrainChunk.fn,
      onChunkPrepared: (chunkKey) => preparedChunks.push(chunkKey),
    });

    await flushMicrotasks(2);

    expect(syncProjectionTiles.calls).toEqual([["24,24"], ["0,24"], ["24,0"]]);
    expect(pinnedChunkUpdates).toEqual([["0,24", "24,0"]]);
    expect(updateBoundsSubscription.calls).toEqual([["24,24", 7]]);
    expect(prewarmChunkAssets.calls).toEqual([["24,24"]]);
    expect(prepareTerrainChunk.calls).toEqual([]);
    expect(preparedChunks).toEqual([]);

    syncProjectionTiles.resolveNext(true);
    syncProjectionTiles.resolveNext(true);
    syncProjectionTiles.resolveNext(true);
    await flushMicrotasks(2);
    expect(prepareTerrainChunk.calls).toEqual([]);

    prewarmChunkAssets.resolveNext();
    updateBoundsSubscription.resolveNext();
    await flushMicrotasks(2);

    expect(prepareTerrainChunk.calls).toEqual([[24, 24, 80, 90]]);
    prepareTerrainChunk.resolveNext({
      chunkKey: "24,24",
      expectedExploredTerrainInstances: 144,
    });

    const result = await preparationPromise;
    expect(result).toEqual({
      projectionSyncSucceeded: true,
      preparedTerrain: {
        chunkKey: "24,24",
        expectedExploredTerrainInstances: 144,
      },
    });
    expect(preparedChunks).toEqual(["24,24"]);
  });

  it("still waits for bounds completion but skips terrain preparation when projection sync fails", async () => {
    const syncProjectionTiles = createControlledAsyncCall<[string], boolean>();
    const updateBoundsSubscription = createControlledAsyncCall<[string, number], void>();
    const prewarmChunkAssets = createControlledAsyncCall<[string], void>();
    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();
    const preparedChunks: string[] = [];

    const preparationPromise = prepareWarpTravelChunk({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      surroundingChunks: [],
      transitionToken: 9,
      renderSize: { height: 80, width: 90 },
      syncProjectionTiles: syncProjectionTiles.fn,
      updatePinnedChunks: () => undefined,
      updateBoundsSubscription: updateBoundsSubscription.fn,
      prewarmChunkAssets: prewarmChunkAssets.fn,
      prepareTerrainChunk: prepareTerrainChunk.fn,
      onChunkPrepared: (chunkKey) => preparedChunks.push(chunkKey),
    });

    await flushMicrotasks(2);

    prewarmChunkAssets.resolveNext();
    syncProjectionTiles.resolveNext(false);
    updateBoundsSubscription.resolveNext();

    const result = await preparationPromise;
    expect(result).toEqual({ projectionSyncSucceeded: false, preparedTerrain: null });
    expect(prepareTerrainChunk.calls).toEqual([]);
    expect(preparedChunks).toEqual(["24,24"]);
  });
});
