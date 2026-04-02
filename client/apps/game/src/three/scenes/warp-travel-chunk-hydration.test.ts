import { describe, expect, it } from "vitest";

import { hydrateWarpTravelChunk } from "./warp-travel-chunk-hydration";
import { createControlledAsyncCall, flushMicrotasks } from "./worldmap-test-harness";
import type { WorldmapBarrierResult } from "./worldmap-authoritative-barrier";

function readyBarrier(label: string): WorldmapBarrierResult {
  return { status: "ready", label, durationMs: 0 };
}

describe("hydrateWarpTravelChunk", () => {
  it("prepares target terrain only after fetch, bounds, and authoritative drains are ready", async () => {
    const computeTileEntities = createControlledAsyncCall<[string], boolean>();
    const updateBoundsSubscription = createControlledAsyncCall<[string, number], void>();
    const waitForTileHydrationIdle = createControlledAsyncCall<[string], WorldmapBarrierResult>();
    const waitForStructureHydrationIdle = createControlledAsyncCall<[string], WorldmapBarrierResult>();
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

    waitForTileHydrationIdle.resolveNext(readyBarrier("tile_authoritative"));
    waitForStructureHydrationIdle.resolveNext(readyBarrier("structure_authoritative"));
    updateBoundsSubscription.resolveNext();
    await flushMicrotasks(4);

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
      presentationStatus: "ready",
      deferredVisualCatchUpPromise: expect.any(Promise),
    });
    expect(hydratedChunks).toEqual(["24,24"]);
  });

  it("returns prepared terrain before deferred visual catch-up finishes", async () => {
    const computeTileEntities = createControlledAsyncCall<[string], boolean>();
    const updateBoundsSubscription = createControlledAsyncCall<[string, number], void>();
    const waitForTileHydrationIdle = createControlledAsyncCall<[string], WorldmapBarrierResult>();
    const waitForStructureHydrationIdle = createControlledAsyncCall<[string], WorldmapBarrierResult>();
    const prewarmChunkAssets = createControlledAsyncCall<[string], void>();
    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();

    const hydrationPromise = hydrateWarpTravelChunk({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      surroundingChunks: [],
      transitionToken: 8,
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
    waitForTileHydrationIdle.resolveNext(readyBarrier("tile_authoritative"));
    waitForStructureHydrationIdle.resolveNext(readyBarrier("structure_authoritative"));
    await flushMicrotasks(4);

    expect(prepareTerrainChunk.calls).toEqual([[24, 24, 80, 90]]);
    prepareTerrainChunk.resolveNext({ chunkKey: "24,24" });
    await flushMicrotasks(2);

    const result = await hydrationPromise;
    expect(result.presentationStatus).toBe("ready");
    await expect(Promise.race([result.deferredVisualCatchUpPromise, Promise.resolve("pending")])).resolves.toBe(
      "pending",
    );

    prewarmChunkAssets.resolveNext();
    await expect(result.deferredVisualCatchUpPromise).resolves.toBeUndefined();
  });

  it("still waits for bounds completion but skips terrain preparation when tile fetch fails", async () => {
    const computeTileEntities = createControlledAsyncCall<[string], boolean>();
    const updateBoundsSubscription = createControlledAsyncCall<[string, number], void>();
    const waitForTileHydrationIdle = createControlledAsyncCall<[string], WorldmapBarrierResult>();
    const waitForStructureHydrationIdle = createControlledAsyncCall<[string], WorldmapBarrierResult>();
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

    waitForTileHydrationIdle.resolveNext(readyBarrier("tile_authoritative"));
    waitForStructureHydrationIdle.resolveNext(readyBarrier("structure_authoritative"));
    prewarmChunkAssets.resolveNext();
    computeTileEntities.resolveNext(false);
    updateBoundsSubscription.resolveNext();

    const result = await hydrationPromise;
    expect(result).toEqual({
      tileFetchSucceeded: false,
      preparedTerrain: null,
      presentationStatus: "fetch_failed",
      deferredVisualCatchUpPromise: expect.any(Promise),
    });
    expect(prepareTerrainChunk.calls).toEqual([]);
    expect(hydratedChunks).toEqual(["24,24"]);
  });

  it("does not prepare terrain until tile hydration drain finishes for the target chunk", async () => {
    const computeTileEntities = createControlledAsyncCall<[string], boolean>();
    const updateBoundsSubscription = createControlledAsyncCall<[string, number], void>();
    const waitForTileHydrationIdle = createControlledAsyncCall<[string], WorldmapBarrierResult>();
    const waitForStructureHydrationIdle = createControlledAsyncCall<[string], WorldmapBarrierResult>();
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
    waitForStructureHydrationIdle.resolveNext(readyBarrier("structure_authoritative"));
    prewarmChunkAssets.resolveNext();
    await flushMicrotasks(2);

    expect(prepareTerrainChunk.calls).toEqual([]);

    waitForTileHydrationIdle.resolveNext(readyBarrier("tile_authoritative"));
    await flushMicrotasks(4);

    expect(prepareTerrainChunk.calls).toEqual([[24, 24, 80, 90]]);
    prepareTerrainChunk.resolveNext({ chunkKey: "24,24" });

    await expect(hydrationPromise).resolves.toEqual({
      tileFetchSucceeded: true,
      preparedTerrain: { chunkKey: "24,24" },
      presentationStatus: "ready",
      deferredVisualCatchUpPromise: expect.any(Promise),
    });
  });
});
