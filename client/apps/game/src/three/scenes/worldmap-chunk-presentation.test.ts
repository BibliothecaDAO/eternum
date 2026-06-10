import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareWorldmapChunkPresentation, prewarmWorldmapChunkPresentation } from "./worldmap-chunk-presentation";
import { resolveSameChunkRefreshCommit } from "./worldmap-same-chunk-refresh-commit";
import { createControlledAsyncCall, flushMicrotasks } from "./worldmap-test-harness";

describe("prepareWorldmapChunkPresentation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not prepare target terrain before the structure barrier and asset prewarm complete", async () => {
    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();
    const tileFetch = createControlledAsyncCall<[], boolean>();
    const tileHydrationReady = createControlledAsyncCall<[], void>();
    const boundsReady = createControlledAsyncCall<[], void>();
    const structureReady = createControlledAsyncCall<[], void>();
    const assetPrewarm = createControlledAsyncCall<[], void>();
    const hydratedChunks: string[] = [];

    const presentationPromise = prepareWorldmapChunkPresentation({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      renderSize: { height: 80, width: 90 },
      tileFetchPromise: tileFetch.fn(),
      tileHydrationReadyPromise: tileHydrationReady.fn(),
      boundsReadyPromise: boundsReady.fn(),
      structureReadyPromise: structureReady.fn(),
      assetPrewarmPromise: assetPrewarm.fn(),
      prepareTerrainChunk: prepareTerrainChunk.fn,
      onChunkReady: (chunkKey) => hydratedChunks.push(chunkKey),
    });

    await flushMicrotasks(2);
    tileFetch.resolveNext(true);
    boundsReady.resolveNext();
    await flushMicrotasks(2);

    expect(prepareTerrainChunk.calls).toEqual([]);
    expect(hydratedChunks).toEqual([]);

    tileHydrationReady.resolveNext();
    structureReady.resolveNext();
    assetPrewarm.resolveNext();
    await flushMicrotasks(2);

    expect(prepareTerrainChunk.calls).toEqual([[24, 24, 80, 90]]);
    prepareTerrainChunk.resolveNext({ chunkKey: "24,24" });

    await expect(presentationPromise).resolves.toEqual({
      tileFetchSucceeded: true,
      preparedTerrain: { chunkKey: "24,24" },
    });
    expect(hydratedChunks).toEqual(["24,24"]);
  });

  it("returns without terrain preparation when tile fetch fails", async () => {
    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();
    const tileFetch = createControlledAsyncCall<[], boolean>();
    const tileHydrationReady = createControlledAsyncCall<[], void>();
    const boundsReady = createControlledAsyncCall<[], void>();
    const structureReady = createControlledAsyncCall<[], void>();
    const assetPrewarm = createControlledAsyncCall<[], void>();

    const presentationPromise = prepareWorldmapChunkPresentation({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      renderSize: { height: 80, width: 90 },
      tileFetchPromise: tileFetch.fn(),
      tileHydrationReadyPromise: tileHydrationReady.fn(),
      boundsReadyPromise: boundsReady.fn(),
      structureReadyPromise: structureReady.fn(),
      assetPrewarmPromise: assetPrewarm.fn(),
      prepareTerrainChunk: prepareTerrainChunk.fn,
    });

    await flushMicrotasks(2);
    tileHydrationReady.resolveNext();
    structureReady.resolveNext();
    assetPrewarm.resolveNext();
    tileFetch.resolveNext(false);
    boundsReady.resolveNext();

    await expect(presentationPromise).resolves.toEqual({
      tileFetchSucceeded: false,
      preparedTerrain: null,
    });
    expect(prepareTerrainChunk.calls).toEqual([]);
  });

  it("does not expose same-chunk prepared terrain before manager readiness completes", async () => {
    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();
    const tileFetch = createControlledAsyncCall<[], boolean>();
    const tileHydrationReady = createControlledAsyncCall<[], void>();
    const boundsReady = createControlledAsyncCall<[], void>();
    const structureReady = createControlledAsyncCall<[], void>();
    const assetPrewarm = createControlledAsyncCall<[], void>();

    const presentationPromise = prepareWorldmapChunkPresentation({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      renderSize: { height: 80, width: 90 },
      tileFetchPromise: tileFetch.fn(),
      tileHydrationReadyPromise: tileHydrationReady.fn(),
      boundsReadyPromise: boundsReady.fn(),
      structureReadyPromise: structureReady.fn(),
      assetPrewarmPromise: assetPrewarm.fn(),
      prepareTerrainChunk: prepareTerrainChunk.fn,
    });

    // Tile fetch and bounds resolve, but structure and asset prewarm are still pending
    await flushMicrotasks(2);
    tileFetch.resolveNext(true);
    boundsReady.resolveNext();
    await flushMicrotasks(2);

    // Terrain should NOT be prepared yet - managers are not ready
    expect(prepareTerrainChunk.calls).toEqual([]);

    // Now resolve the manager readiness barriers
    tileHydrationReady.resolveNext();
    structureReady.resolveNext();
    assetPrewarm.resolveNext();
    await flushMicrotasks(2);

    // Now terrain preparation should be triggered
    expect(prepareTerrainChunk.calls).toEqual([[24, 24, 80, 90]]);
    prepareTerrainChunk.resolveNext({ chunkKey: "24,24" });

    const result = await presentationPromise;
    expect(result.preparedTerrain).toEqual({ chunkKey: "24,24" });
  });

  it("does not prepare terrain before tile hydration drain completes even after fetch succeeds", async () => {
    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();
    const tileFetch = createControlledAsyncCall<[], boolean>();
    const tileHydrationReady = createControlledAsyncCall<[], void>();
    const boundsReady = createControlledAsyncCall<[], void>();
    const structureReady = createControlledAsyncCall<[], void>();
    const assetPrewarm = createControlledAsyncCall<[], void>();

    const presentationPromise = prepareWorldmapChunkPresentation({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      renderSize: { height: 80, width: 90 },
      tileFetchPromise: tileFetch.fn(),
      tileHydrationReadyPromise: tileHydrationReady.fn(),
      boundsReadyPromise: boundsReady.fn(),
      structureReadyPromise: structureReady.fn(),
      assetPrewarmPromise: assetPrewarm.fn(),
      prepareTerrainChunk: prepareTerrainChunk.fn,
    });

    await flushMicrotasks(2);
    tileFetch.resolveNext(true);
    boundsReady.resolveNext();
    structureReady.resolveNext();
    assetPrewarm.resolveNext();
    await flushMicrotasks(2);

    expect(prepareTerrainChunk.calls).toEqual([]);

    tileHydrationReady.resolveNext();
    await flushMicrotasks(2);

    expect(prepareTerrainChunk.calls).toEqual([[24, 24, 80, 90]]);
    prepareTerrainChunk.resolveNext({ chunkKey: "24,24" });

    await expect(presentationPromise).resolves.toEqual({
      tileFetchSucceeded: true,
      preparedTerrain: { chunkKey: "24,24" },
    });
  });

  it("times out a stalled presentation barrier instead of hanging the chunk switch forever", async () => {
    vi.useFakeTimers();

    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();
    const tileFetch = createControlledAsyncCall<[], boolean>();
    const tileHydrationReady = createControlledAsyncCall<[], void>();
    const boundsReady = createControlledAsyncCall<[], void>();
    const structureReady = createControlledAsyncCall<[], void>();
    const assetPrewarm = createControlledAsyncCall<[], void>();
    const onPhaseTimeout = vi.fn();

    const presentationPromise = prepareWorldmapChunkPresentation({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      renderSize: { height: 80, width: 90 },
      tileFetchPromise: tileFetch.fn(),
      tileHydrationReadyPromise: tileHydrationReady.fn(),
      boundsReadyPromise: boundsReady.fn(),
      structureReadyPromise: structureReady.fn(),
      assetPrewarmPromise: assetPrewarm.fn(),
      prepareTerrainChunk: prepareTerrainChunk.fn,
      phaseTimeoutMs: 25,
      onPhaseTimeout,
    });

    await flushMicrotasks(2);
    tileFetch.resolveNext(true);
    tileHydrationReady.resolveNext();
    structureReady.resolveNext();
    assetPrewarm.resolveNext();
    await flushMicrotasks(2);

    await vi.advanceTimersByTimeAsync(25);

    await expect(presentationPromise).resolves.toEqual({
      tileFetchSucceeded: false,
      preparedTerrain: null,
      timedOutPhase: "bounds_ready",
    });
    expect(onPhaseTimeout).toHaveBeenCalledWith({
      chunkKey: "24,24",
      phase: "bounds_ready",
      timeoutMs: 25,
    });
    expect(prepareTerrainChunk.calls).toEqual([]);
    expect(boundsReady.pendingCount()).toBe(1);
  });

  it("commits same-chunk refresh terrain and managers through one gate", () => {
    // When the refresh token is current and chunk matches, the commit decision
    // allows terrain to be applied atomically with managers
    const decision = resolveSameChunkRefreshCommit({
      refreshToken: 10,
      currentRefreshToken: 10,
      currentChunk: "24,24",
      targetChunk: "24,24",
      preparedTerrain: { chunkKey: "24,24" },
    });

    expect(decision.shouldCommit).toBe(true);
    expect(decision.shouldDropAsStale).toBe(false);
  });

  it("drops stale same-chunk refresh work without mutating visible terrain", () => {
    // When a newer refresh has superseded, the stale work must be dropped
    const supersededDecision = resolveSameChunkRefreshCommit({
      refreshToken: 10,
      currentRefreshToken: 11,
      currentChunk: "24,24",
      targetChunk: "24,24",
      preparedTerrain: { chunkKey: "24,24" },
    });
    expect(supersededDecision.shouldCommit).toBe(false);
    expect(supersededDecision.shouldDropAsStale).toBe(true);

    // When chunk changed while refresh was in flight
    const chunkChangedDecision = resolveSameChunkRefreshCommit({
      refreshToken: 10,
      currentRefreshToken: 10,
      currentChunk: "48,48",
      targetChunk: "24,24",
      preparedTerrain: { chunkKey: "24,24" },
    });
    expect(chunkChangedDecision.shouldCommit).toBe(false);
    expect(chunkChangedDecision.shouldDropAsStale).toBe(true);
  });
});

describe("prewarmWorldmapChunkPresentation", () => {
  // Phase 2.2: a prewarmed presentation that is dropped (stale token, or the chunk
  // became hot after preparation) holds pooled InstancedBufferAttributes. The
  // caller discards the return value, so these branches must release the prepared
  // terrain or the pooled attributes leak.
  it("disposes prepared terrain when the prewarm token is stale", async () => {
    const preparedTerrain = { chunkKey: "24,24" };
    const cachePreparedTerrain = vi.fn();
    const disposePreparedTerrain = vi.fn();

    const result = await prewarmWorldmapChunkPresentation<{ chunkKey: string }>({
      chunkKey: "24,24",
      prewarmToken: 1,
      isLatestToken: () => false,
      isPresentationHot: () => false,
      preparePresentation: async () => ({ tileFetchSucceeded: true, preparedTerrain }),
      cachePreparedTerrain,
      disposePreparedTerrain,
    });

    expect(result.status).toBe("stale_dropped");
    expect(cachePreparedTerrain).not.toHaveBeenCalled();
    expect(disposePreparedTerrain).toHaveBeenCalledWith(preparedTerrain);
  });

  it("disposes prepared terrain when the chunk became hot during preparation", async () => {
    const preparedTerrain = { chunkKey: "24,24" };
    const cachePreparedTerrain = vi.fn();
    const disposePreparedTerrain = vi.fn();
    let hotChecks = 0;

    const result = await prewarmWorldmapChunkPresentation<{ chunkKey: string }>({
      chunkKey: "24,24",
      prewarmToken: 1,
      isLatestToken: () => true,
      // not hot on entry, hot after preparation completes
      isPresentationHot: () => hotChecks++ > 0,
      preparePresentation: async () => ({ tileFetchSucceeded: true, preparedTerrain }),
      cachePreparedTerrain,
      disposePreparedTerrain,
    });

    expect(result.status).toBe("skipped_hot");
    expect(cachePreparedTerrain).not.toHaveBeenCalled();
    expect(disposePreparedTerrain).toHaveBeenCalledWith(preparedTerrain);
  });

  it("caches (does not dispose) prepared terrain on a successful prewarm", async () => {
    const preparedTerrain = { chunkKey: "24,24" };
    const cachePreparedTerrain = vi.fn();
    const disposePreparedTerrain = vi.fn();

    const result = await prewarmWorldmapChunkPresentation<{ chunkKey: string }>({
      chunkKey: "24,24",
      prewarmToken: 1,
      isLatestToken: () => true,
      isPresentationHot: () => false,
      preparePresentation: async () => ({ tileFetchSucceeded: true, preparedTerrain }),
      cachePreparedTerrain,
      disposePreparedTerrain,
    });

    expect(result.status).toBe("prepared");
    expect(cachePreparedTerrain).toHaveBeenCalledWith(preparedTerrain);
    expect(disposePreparedTerrain).not.toHaveBeenCalled();
  });
});
