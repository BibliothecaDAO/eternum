import { describe, expect, it } from "vitest";

import { hydrateWarpTravelChunk } from "./warp-travel-chunk-hydration";
import { createControlledAsyncCall, flushMicrotasks } from "./worldmap-test-harness";

describe("hydrateWarpTravelChunk", () => {
  it("hydrates the target chunk, pins neighbors, and waits for grid plus bounds readiness", async () => {
    const computeTileEntities = createControlledAsyncCall<[string], boolean>();
    const updateBoundsSubscription = createControlledAsyncCall<[string, number], void>();
    const updateHexagonGrid = createControlledAsyncCall<[number, number, number, number], void>();
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
      updateHexagonGrid: updateHexagonGrid.fn,
      onChunkHydrated: (chunkKey) => hydratedChunks.push(chunkKey),
    });

    await flushMicrotasks(2);

    expect(computeTileEntities.calls).toEqual([["24,24"], ["0,24"], ["24,0"]]);
    expect(pinnedChunkUpdates).toEqual([["0,24", "24,0"]]);
    expect(updateBoundsSubscription.calls).toEqual([["24,24", 7]]);
    expect(updateHexagonGrid.calls).toEqual([[24, 24, 80, 90]]);
    expect(hydratedChunks).toEqual([]);

    updateHexagonGrid.resolveNext();
    computeTileEntities.resolveNext(true);
    updateBoundsSubscription.resolveNext();

    const result = await hydrationPromise;
    expect(result).toEqual({ tileFetchSucceeded: true });
    expect(hydratedChunks).toEqual(["24,24"]);
  });

  it("still waits for bounds completion and clears hydration bookkeeping when tile fetch fails", async () => {
    const computeTileEntities = createControlledAsyncCall<[string], boolean>();
    const updateBoundsSubscription = createControlledAsyncCall<[string, number], void>();
    const updateHexagonGrid = createControlledAsyncCall<[number, number, number, number], void>();
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
      updateHexagonGrid: updateHexagonGrid.fn,
      onChunkHydrated: (chunkKey) => hydratedChunks.push(chunkKey),
    });

    await flushMicrotasks(2);

    updateHexagonGrid.resolveNext();
    computeTileEntities.resolveNext(false);
    updateBoundsSubscription.resolveNext();

    const result = await hydrationPromise;
    expect(result).toEqual({ tileFetchSucceeded: false });
    expect(hydratedChunks).toEqual(["24,24"]);
  });
});
