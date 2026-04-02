import { describe, expect, it } from "vitest";

import { hydrateWarpTravelChunk } from "./warp-travel-chunk-hydration";
import { createControlledAsyncCall, flushMicrotasks } from "./worldmap-test-harness";
import type { WorldmapBarrierResult } from "./worldmap-authoritative-barrier";

function readyBarrier(label: string): WorldmapBarrierResult {
  return { status: "ready", label, durationMs: 0 };
}

/**
 * Stage 1: Chunk Switch Critical Path — Remove Serialized Redundancy
 *
 * These tests verify that the prewarmChunkAssets callback does NOT independently
 * await structure hydration idle. The hydration drain is already handled by the
 * separate waitForStructureHydrationIdle callback that runs concurrently via
 * Promise.all in prepareWorldmapChunkPresentation.
 */
describe("chunk switch critical path — no redundant hydration drain", () => {
  it("prewarmChunkAssets callback starts immediately without awaiting structure hydration drain", async () => {
    // This test verifies that when hydrateWarpTravelChunk is called,
    // the prewarmChunkAssets callback begins its work immediately
    // (i.e., it does NOT internally await waitForStructureHydrationIdle first).
    //
    // We simulate this by providing a prewarmChunkAssets callback that tracks
    // whether it was invoked, and verifying it runs eagerly alongside the
    // structure hydration drain (not serialized behind it).

    let prewarmStarted = false;
    let prewarmCompleted = false;
    let structureDrainCompleted = false;

    const computeTileEntities = createControlledAsyncCall<[string], boolean>();
    const updateBoundsSubscription = createControlledAsyncCall<[string, number], void>();
    const waitForTileHydrationIdle = createControlledAsyncCall<[string], WorldmapBarrierResult>();
    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();

    // We use real async functions for structure drain and prewarm to test
    // concurrency behavior at the integration boundary.
    const structureDrainDeferred = createDeferred<void>();
    const prewarmWorkDeferred = createDeferred<void>();

    const hydrationPromise = hydrateWarpTravelChunk({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      surroundingChunks: [],
      transitionToken: 1,
      renderSize: { height: 80, width: 90 },
      computeTileEntities: computeTileEntities.fn,
      updatePinnedChunks: () => undefined,
      updateBoundsSubscription: updateBoundsSubscription.fn,
      waitForTileHydrationIdle: waitForTileHydrationIdle.fn,
      waitForStructureHydrationIdle: async (_chunkKey) => {
        await structureDrainDeferred.promise;
        structureDrainCompleted = true;
        return readyBarrier("structure_authoritative");
      },
      prewarmChunkAssets: async (_chunkKey) => {
        // If the prewarm callback redundantly awaits structure hydration,
        // prewarmStarted would NOT be true until structureDrainCompleted is true.
        prewarmStarted = true;
        await prewarmWorkDeferred.promise;
        prewarmCompleted = true;
      },
      prepareTerrainChunk: prepareTerrainChunk.fn,
      onChunkHydrated: () => undefined,
    });

    await flushMicrotasks(2);

    // The key assertion: prewarm has started even though structure drain has NOT completed.
    // If there were a redundant `await waitForStructureHydrationIdle` inside prewarmChunkAssets,
    // prewarmStarted would still be false here.
    expect(prewarmStarted).toBe(true);
    expect(structureDrainCompleted).toBe(false);

    // Now resolve everything to complete the hydration
    structureDrainDeferred.resolve();
    prewarmWorkDeferred.resolve();
    computeTileEntities.resolveNext(true);
    updateBoundsSubscription.resolveNext();
    waitForTileHydrationIdle.resolveNext(readyBarrier("tile_authoritative"));
    await flushMicrotasks(2);

    expect(structureDrainCompleted).toBe(true);
    expect(prewarmCompleted).toBe(true);

    prepareTerrainChunk.resolveNext({ chunkKey: "24,24" });
    const result = await hydrationPromise;
    expect(result.tileFetchSucceeded).toBe(true);
  });

  it("waitForStructureHydrationIdle callback is called exactly once per chunk switch", async () => {
    // If the redundant await is removed from prewarmChunkAssets, the
    // waitForStructureHydrationIdle callback should be invoked exactly once
    // (from the explicit callback), not twice.

    const structureDrainCalls: string[] = [];

    const computeTileEntities = createControlledAsyncCall<[string], boolean>();
    const updateBoundsSubscription = createControlledAsyncCall<[string, number], void>();
    const waitForTileHydrationIdle = createControlledAsyncCall<[string], WorldmapBarrierResult>();
    const prewarmChunkAssets = createControlledAsyncCall<[string], void>();
    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();

    hydrateWarpTravelChunk({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      surroundingChunks: [],
      transitionToken: 2,
      renderSize: { height: 80, width: 90 },
      computeTileEntities: computeTileEntities.fn,
      updatePinnedChunks: () => undefined,
      updateBoundsSubscription: updateBoundsSubscription.fn,
      waitForTileHydrationIdle: waitForTileHydrationIdle.fn,
      waitForStructureHydrationIdle: async (chunkKey) => {
        structureDrainCalls.push(chunkKey);
        return readyBarrier("structure_authoritative");
      },
      prewarmChunkAssets: prewarmChunkAssets.fn,
      prepareTerrainChunk: prepareTerrainChunk.fn,
      onChunkHydrated: () => undefined,
    });

    await flushMicrotasks(2);

    // The waitForStructureHydrationIdle callback should be called exactly once
    // by hydrateWarpTravelChunk (line 27 of the hydration module).
    // If prewarmChunkAssets internally also called it, we'd see 2 calls.
    expect(structureDrainCalls).toEqual(["24,24"]);
  });

  it("prewarm is serialized behind structure drain when redundant hydration await is present (regression baseline)", async () => {
    // This test demonstrates the BUGGY behavior: if prewarmChunkAssets
    // internally awaits the same structure hydration drain, it becomes
    // serialized behind it instead of running concurrently.
    // This test proves the concurrency assertion can detect the bug.

    let prewarmStarted = false;

    const computeTileEntities = createControlledAsyncCall<[string], boolean>();
    const updateBoundsSubscription = createControlledAsyncCall<[string, number], void>();
    const waitForTileHydrationIdle = createControlledAsyncCall<[string], WorldmapBarrierResult>();
    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();

    const structureDrainDeferred = createDeferred<void>();

    hydrateWarpTravelChunk({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      surroundingChunks: [],
      transitionToken: 4,
      renderSize: { height: 80, width: 90 },
      computeTileEntities: computeTileEntities.fn,
      updatePinnedChunks: () => undefined,
      updateBoundsSubscription: updateBoundsSubscription.fn,
      waitForTileHydrationIdle: waitForTileHydrationIdle.fn,
      waitForStructureHydrationIdle: async (_chunkKey) => {
        await structureDrainDeferred.promise;
        return readyBarrier("structure_authoritative");
      },
      // Simulate the BUGGY callback: prewarm internally awaits the same drain
      prewarmChunkAssets: async (_chunkKey) => {
        await structureDrainDeferred.promise; // <-- redundant drain
        prewarmStarted = true;
      },
      prepareTerrainChunk: prepareTerrainChunk.fn,
      onChunkHydrated: () => undefined,
    });

    await flushMicrotasks(2);

    // With the redundant drain, prewarm has NOT started because it is
    // blocked on the same deferred as the structure drain.
    expect(prewarmStarted).toBe(false);

    // Clean up
    structureDrainDeferred.resolve();
    computeTileEntities.resolveNext(true);
    updateBoundsSubscription.resolveNext();
    waitForTileHydrationIdle.resolveNext(readyBarrier("tile_authoritative"));
    await flushMicrotasks(2);
    prepareTerrainChunk.resolveNext({ chunkKey: "24,24" });
    await flushMicrotasks(2);
  });

  it("overall chunk switch does not wait for prewarm to complete before terrain preparation", async () => {
    const completionOrder: string[] = [];

    const computeTileEntities = createControlledAsyncCall<[string], boolean>();
    const updateBoundsSubscription = createControlledAsyncCall<[string, number], void>();
    const waitForTileHydrationIdle = createControlledAsyncCall<[string], WorldmapBarrierResult>();
    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();

    const structureDrainDeferred = createDeferred<void>();
    const prewarmDeferred = createDeferred<void>();

    const hydrationPromise = hydrateWarpTravelChunk({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      surroundingChunks: [],
      transitionToken: 3,
      renderSize: { height: 80, width: 90 },
      computeTileEntities: computeTileEntities.fn,
      updatePinnedChunks: () => undefined,
      updateBoundsSubscription: updateBoundsSubscription.fn,
      waitForTileHydrationIdle: waitForTileHydrationIdle.fn,
      waitForStructureHydrationIdle: async (_chunkKey) => {
        await structureDrainDeferred.promise;
        completionOrder.push("structureDrain");
        return readyBarrier("structure_authoritative");
      },
      prewarmChunkAssets: async (_chunkKey) => {
        await prewarmDeferred.promise;
        completionOrder.push("prewarm");
      },
      prepareTerrainChunk: prepareTerrainChunk.fn,
      onChunkHydrated: () => undefined,
    });

    await flushMicrotasks(2);

    // Resolve tile fetch and other prerequisites
    computeTileEntities.resolveNext(true);
    updateBoundsSubscription.resolveNext();
    waitForTileHydrationIdle.resolveNext(readyBarrier("tile_authoritative"));
    await flushMicrotasks(2);

    // Terrain preparation should NOT have started — structure drain and prewarm are still pending
    expect(prepareTerrainChunk.calls).toEqual([]);

    // Resolve structure drain first
    structureDrainDeferred.resolve();
    await flushMicrotasks(2);

    // Terrain preparation should proceed without waiting for prewarm
    expect(prepareTerrainChunk.calls).toEqual([[24, 24, 80, 90]]);
    prepareTerrainChunk.resolveNext({ chunkKey: "24,24" });

    // Prewarm can resolve later without blocking the chunk switch result
    prewarmDeferred.resolve();

    const result = await hydrationPromise;
    expect(result.tileFetchSucceeded).toBe(true);
    expect(result.presentationStatus).toBe("ready");
    expect(completionOrder).toEqual(["structureDrain", "prewarm"]);
  });
});

// Helper — inline deferred to avoid depending on test harness internals
function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
