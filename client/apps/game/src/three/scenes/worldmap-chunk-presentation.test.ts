import { describe, expect, it } from "vitest";

import { prepareWorldmapChunkPresentation } from "./worldmap-chunk-presentation";
import { createControlledAsyncCall, flushMicrotasks } from "./worldmap-test-harness";

describe("prepareWorldmapChunkPresentation", () => {
  it("does not prepare target terrain before the structure barrier and asset prewarm complete", async () => {
    const prepareTerrainChunk = createControlledAsyncCall<[number, number, number, number], { chunkKey: string }>();
    const tileFetch = createControlledAsyncCall<[], boolean>();
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
    const boundsReady = createControlledAsyncCall<[], void>();
    const structureReady = createControlledAsyncCall<[], void>();
    const assetPrewarm = createControlledAsyncCall<[], void>();

    const presentationPromise = prepareWorldmapChunkPresentation({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      renderSize: { height: 80, width: 90 },
      tileFetchPromise: tileFetch.fn(),
      boundsReadyPromise: boundsReady.fn(),
      structureReadyPromise: structureReady.fn(),
      assetPrewarmPromise: assetPrewarm.fn(),
      prepareTerrainChunk: prepareTerrainChunk.fn,
    });

    await flushMicrotasks(2);
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
});
