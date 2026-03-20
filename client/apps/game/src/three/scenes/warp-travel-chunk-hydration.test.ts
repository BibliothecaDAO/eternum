import { describe, expect, it } from "vitest";

import { hydrateWarpTravelChunk } from "./warp-travel-chunk-hydration";
import { createControlledAsyncCall, flushMicrotasks } from "./worldmap-test-harness";

describe("hydrateWarpTravelChunk", () => {
  it("prepares target terrain only after fetch, bounds, structure drain, and asset prewarm are ready", async () => {
    const computeTileEntities = createControlledAsyncCall<[string], boolean>();
    const updateBoundsSubscription = createControlledAsyncCall<[string, number], void>();
    const waitForTileHydrationIdle = createControlledAsyncCall<[string], void>();
    const waitForStructureHydrationIdle = createControlledAsyncCall<[string], void>();
    const prewarmChunkAssets = createControlledAsyncCall<[string], void>();
    const prepareTerrainChunk = createControlledAsyncCall<
      [number, number, number, number],
      { chunkKey: string; expectedExploredTerrainInstances: number }
    >();
    const pinnedChunkUpdates: string[][] = [];
    const hydratedChunks: string[] = [];

    const hydrationPromise = hydrateWarpTravelChunk({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      surroundingChunks: ["0,24", "24,0"],
      transitionToken: 7,
      renderSize: { height: 80, width: 90 },
      computeTileEntities: computeTileEntities.fn,
      updatePinnedChunks: (chunks) => pinnedChunkUpdates.push(chunks),
      updateBoundsSubscription: updateBoundsSubscription.fn,
      waitForTileHydrationIdle: waitForTileHydrationIdle.fn,
      waitForStructureHydrationIdle: waitForStructureHydrationIdle.fn,
      prewarmChunkAssets: prewarmChunkAssets.fn,
      prepareTerrainChunk: prepareTerrainChunk.fn,
      onChunkHydrated: (chunkKey) => hydratedChunks.push(chunkKey),
    });

    await flushMicrotasks(2);

    expect(computeTileEntities.calls).toEqual([["24,24"], ["0,24"], ["24,0"]]);
    expect(pinnedChunkUpdates).toEqual([["0,24", "24,0"]]);
    expect(updateBoundsSubscription.calls).toEqual([["24,24", 7]]);
    expect(waitForTileHydrationIdle.calls).toEqual([["24,24"]]);
    expect(waitForStructureHydrationIdle.calls).toEqual([["24,24"]]);
    expect(prewarmChunkAssets.calls).toEqual([["24,24"]]);
    expect(prepareTerrainChunk.calls).toEqual([]);
    expect(hydratedChunks).toEqual([]);

    computeTileEntities.resolveNext(true);
    computeTileEntities.resolveNext(true);
    computeTileEntities.resolveNext(true);
    await flushMicrotasks(2);
    expect(prepareTerrainChunk.calls).toEqual([]);

    waitForTileHydrationIdle.resolveNext();
    waitForStructureHydrationIdle.resolveNext();
    prewarmChunkAssets.resolveNext();
    updateBoundsSubscription.resolveNext();
    await flushMicrotasks(2);

    expect(prepareTerrainChunk.calls).toEqual([[24, 24, 80, 90]]);
    prepareTerrainChunk.resolveNext({
      chunkKey: "24,24",
      expectedExploredTerrainInstances: 144,
    });

    const result = await hydrationPromise;
    expect(result).toEqual({
      tileFetchSucceeded: true,
      preparedTerrain: {
        chunkKey: "24,24",
        expectedExploredTerrainInstances: 144,
      },
    });
    expect(hydratedChunks).toEqual(["24,24"]);
  });

  it("still waits for bounds completion but skips terrain preparation when tile fetch fails", async () => {
    const computeTileEntities = createControlledAsyncCall<[string], boolean>();
    const updateBoundsSubscription = createControlledAsyncCall<[string, number], void>();
    const waitForTileHydrationIdle = createControlledAsyncCall<[string], void>();
    const waitForStructureHydrationIdle = createControlledAsyncCall<[string], void>();
    const prewarmChunkAssets = createControlledAsyncCall<[string], void>();
    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();
    const hydratedChunks: string[] = [];

    const hydrationPromise = hydrateWarpTravelChunk({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      surroundingChunks: [],
      transitionToken: 9,
      renderSize: { height: 80, width: 90 },
      computeTileEntities: computeTileEntities.fn,
      updatePinnedChunks: () => undefined,
      updateBoundsSubscription: updateBoundsSubscription.fn,
      waitForTileHydrationIdle: waitForTileHydrationIdle.fn,
      waitForStructureHydrationIdle: waitForStructureHydrationIdle.fn,
      prewarmChunkAssets: prewarmChunkAssets.fn,
      prepareTerrainChunk: prepareTerrainChunk.fn,
      onChunkHydrated: (chunkKey) => hydratedChunks.push(chunkKey),
    });

    await flushMicrotasks(2);

    waitForTileHydrationIdle.resolveNext();
    waitForStructureHydrationIdle.resolveNext();
    prewarmChunkAssets.resolveNext();
    computeTileEntities.resolveNext(false);
    updateBoundsSubscription.resolveNext();

    const result = await hydrationPromise;
    expect(result).toEqual({ tileFetchSucceeded: false, preparedTerrain: null });
    expect(prepareTerrainChunk.calls).toEqual([]);
    expect(hydratedChunks).toEqual(["24,24"]);
  });

  it("does not prepare terrain until tile hydration drain finishes for the target chunk", async () => {
    const computeTileEntities = createControlledAsyncCall<[string], boolean>();
    const updateBoundsSubscription = createControlledAsyncCall<[string, number], void>();
    const waitForTileHydrationIdle = createControlledAsyncCall<[string], void>();
    const waitForStructureHydrationIdle = createControlledAsyncCall<[string], void>();
    const prewarmChunkAssets = createControlledAsyncCall<[string], void>();
    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();

    const hydrationPromise = hydrateWarpTravelChunk({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      surroundingChunks: [],
      transitionToken: 11,
      renderSize: { height: 80, width: 90 },
      computeTileEntities: computeTileEntities.fn,
      updatePinnedChunks: () => undefined,
      updateBoundsSubscription: updateBoundsSubscription.fn,
      waitForTileHydrationIdle: waitForTileHydrationIdle.fn,
      waitForStructureHydrationIdle: waitForStructureHydrationIdle.fn,
      prewarmChunkAssets: prewarmChunkAssets.fn,
      prepareTerrainChunk: prepareTerrainChunk.fn,
      onChunkHydrated: () => undefined,
    });

    await flushMicrotasks(2);
    computeTileEntities.resolveNext(true);
    updateBoundsSubscription.resolveNext();
    waitForStructureHydrationIdle.resolveNext();
    prewarmChunkAssets.resolveNext();
    await flushMicrotasks(2);

    expect(prepareTerrainChunk.calls).toEqual([]);

    waitForTileHydrationIdle.resolveNext();
    await flushMicrotasks(2);

    expect(prepareTerrainChunk.calls).toEqual([[24, 24, 80, 90]]);
    prepareTerrainChunk.resolveNext({ chunkKey: "24,24" });

    await expect(hydrationPromise).resolves.toEqual({
      tileFetchSucceeded: true,
      preparedTerrain: { chunkKey: "24,24" },
    });
  });
});
