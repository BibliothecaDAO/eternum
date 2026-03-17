import { describe, expect, it } from "vitest";

import { prepareWorldmapChunkPresentation } from "./worldmap-chunk-presentation";
import { resolveSameChunkRefreshCommit } from "./worldmap-same-chunk-refresh-commit";
import { createControlledAsyncCall, flushMicrotasks } from "./worldmap-test-harness";

describe("prepareWorldmapChunkPresentation", () => {
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
