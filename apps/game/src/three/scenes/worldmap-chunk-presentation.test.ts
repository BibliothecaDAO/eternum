import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareWorldmapChunkPresentation, prewarmWorldmapChunkPresentation } from "./worldmap-chunk-presentation";
import { resolveSameChunkRefreshCommit } from "./worldmap-same-chunk-refresh-commit";
import { createControlledAsyncCall, flushMicrotasks } from "./worldmap-test-harness";

describe("prepareWorldmapChunkPresentation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not prepare target terrain before projection sync and asset prewarm complete", async () => {
    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();
    const projectionSync = createControlledAsyncCall<[], boolean>();
    const assetPrewarm = createControlledAsyncCall<[], void>();
    const preparedChunks: string[] = [];

    const presentationPromise = prepareWorldmapChunkPresentation({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      renderSize: { height: 80, width: 90 },
      projectionSyncPromise: projectionSync.fn(),
      assetPrewarmPromise: assetPrewarm.fn(),
      prepareTerrainChunk: prepareTerrainChunk.fn,
      onChunkPrepared: (chunkKey) => preparedChunks.push(chunkKey),
    });

    await flushMicrotasks(2);
    projectionSync.resolveNext(true);
    await flushMicrotasks(2);

    expect(prepareTerrainChunk.calls).toEqual([]);
    expect(preparedChunks).toEqual([]);

    assetPrewarm.resolveNext();
    await flushMicrotasks(2);

    expect(prepareTerrainChunk.calls).toEqual([[24, 24, 80, 90]]);
    prepareTerrainChunk.resolveNext({ chunkKey: "24,24" });

    await expect(presentationPromise).resolves.toEqual({
      projectionSyncSucceeded: true,
      preparedTerrain: { chunkKey: "24,24" },
    });
    expect(preparedChunks).toEqual(["24,24"]);
  });

  it("returns without terrain preparation when tile sync fails", async () => {
    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();
    const projectionSync = createControlledAsyncCall<[], boolean>();
    const assetPrewarm = createControlledAsyncCall<[], void>();

    const presentationPromise = prepareWorldmapChunkPresentation({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      renderSize: { height: 80, width: 90 },
      projectionSyncPromise: projectionSync.fn(),
      assetPrewarmPromise: assetPrewarm.fn(),
      prepareTerrainChunk: prepareTerrainChunk.fn,
    });

    await flushMicrotasks(2);
    assetPrewarm.resolveNext();
    projectionSync.resolveNext(false);

    await expect(presentationPromise).resolves.toEqual({
      projectionSyncSucceeded: false,
      preparedTerrain: null,
    });
    expect(prepareTerrainChunk.calls).toEqual([]);
  });

  it("does not expose same-chunk prepared terrain before manager readiness completes", async () => {
    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();
    const projectionSync = createControlledAsyncCall<[], boolean>();
    const assetPrewarm = createControlledAsyncCall<[], void>();

    const presentationPromise = prepareWorldmapChunkPresentation({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      renderSize: { height: 80, width: 90 },
      projectionSyncPromise: projectionSync.fn(),
      assetPrewarmPromise: assetPrewarm.fn(),
      prepareTerrainChunk: prepareTerrainChunk.fn,
    });

    // Projection sync resolves, but asset prewarm is still pending.
    await flushMicrotasks(2);
    projectionSync.resolveNext(true);
    await flushMicrotasks(2);

    // Terrain should NOT be prepared yet - managers are not ready
    expect(prepareTerrainChunk.calls).toEqual([]);

    // Now resolve the remaining readiness barrier.
    assetPrewarm.resolveNext();
    await flushMicrotasks(2);

    // Now terrain preparation should be triggered
    expect(prepareTerrainChunk.calls).toEqual([[24, 24, 80, 90]]);
    prepareTerrainChunk.resolveNext({ chunkKey: "24,24" });

    const result = await presentationPromise;
    expect(result.preparedTerrain).toEqual({ chunkKey: "24,24" });
  });

  it("times out a stalled presentation barrier instead of hanging the chunk switch forever", async () => {
    vi.useFakeTimers();

    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();
    const projectionSync = createControlledAsyncCall<[], boolean>();
    const assetPrewarm = createControlledAsyncCall<[], void>();
    const onPhaseTimeout = vi.fn();

    const presentationPromise = prepareWorldmapChunkPresentation({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      renderSize: { height: 80, width: 90 },
      projectionSyncPromise: projectionSync.fn(),
      assetPrewarmPromise: assetPrewarm.fn(),
      prepareTerrainChunk: prepareTerrainChunk.fn,
      phaseTimeoutMs: 25,
      onPhaseTimeout,
    });

    await flushMicrotasks(2);
    assetPrewarm.resolveNext();
    await flushMicrotasks(2);

    await vi.advanceTimersByTimeAsync(25);

    await expect(presentationPromise).resolves.toEqual({
      projectionSyncSucceeded: false,
      preparedTerrain: null,
      timedOutPhase: "projection_sync",
    });
    expect(onPhaseTimeout).toHaveBeenCalledWith({
      chunkKey: "24,24",
      phase: "projection_sync",
      timeoutMs: 25,
    });
    expect(prepareTerrainChunk.calls).toEqual([]);
    expect(projectionSync.pendingCount()).toBe(1);
  });

  it("still prepares terrain when the active-lane asset prewarm times out", async () => {
    vi.useFakeTimers();
    const prepareTerrainChunk = vi.fn().mockResolvedValue("prepared-terrain");
    const onPhaseTimeout = vi.fn();

    const presentationPromise = prepareWorldmapChunkPresentation({
      chunkKey: "0,0",
      startRow: 0,
      startCol: 0,
      renderSize: { height: 80, width: 90 },
      projectionSyncPromise: Promise.resolve(true),
      assetPrewarmPromise: new Promise<void>(() => undefined),
      prepareTerrainChunk,
      phaseTimeoutMs: 25,
      onPhaseTimeout,
    });

    await vi.advanceTimersByTimeAsync(25);

    await expect(presentationPromise).resolves.toEqual({
      projectionSyncSucceeded: true,
      preparedTerrain: "prepared-terrain",
      timedOutPhase: "asset_prewarm",
    });
    expect(onPhaseTimeout).toHaveBeenCalledWith({ chunkKey: "0,0", phase: "asset_prewarm", timeoutMs: 25 });
    expect(prepareTerrainChunk).toHaveBeenCalledTimes(1);
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
      preparePresentation: async () => ({ projectionSyncSucceeded: true, preparedTerrain }),
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
      preparePresentation: async () => ({ projectionSyncSucceeded: true, preparedTerrain }),
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
      preparePresentation: async () => ({ projectionSyncSucceeded: true, preparedTerrain }),
      cachePreparedTerrain,
      disposePreparedTerrain,
    });

    expect(result.status).toBe("prepared");
    expect(cachePreparedTerrain).toHaveBeenCalledWith(preparedTerrain);
    expect(disposePreparedTerrain).not.toHaveBeenCalled();
  });
});
