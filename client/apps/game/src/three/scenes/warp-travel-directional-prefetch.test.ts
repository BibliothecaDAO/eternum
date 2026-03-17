import { describe, expect, it } from "vitest";

import { resolveWarpTravelDirectionalPrefetchPlan } from "./warp-travel-directional-prefetch";

describe("resolveWarpTravelDirectionalPrefetchPlan", () => {
  it("clears directional targets when no anchor is available", () => {
    expect(
      resolveWarpTravelDirectionalPrefetchPlan({
        anchor: null,
        chunkSize: 24,
        forwardDepthStrides: 2,
        sideRadiusStrides: 1,
        pinnedChunkKeys: new Set(["24,24"]),
        currentChunk: "24,24",
        prefetchedAhead: ["48,24"],
        maxPrefetchedAhead: 4,
        getRenderAreaKeyForChunk: (chunkKey) => `${chunkKey}:area`,
      }),
    ).toEqual({
      desiredAreaKeys: [],
      chunkKeysToEnqueue: [],
      presentationChunkKeysToPrewarm: [],
      nextPrefetchedAhead: [],
    });
  });

  it("filters out pinned, current, and already-prefetched targets", () => {
    const result = resolveWarpTravelDirectionalPrefetchPlan({
      anchor: {
        forwardChunkKey: "48,24",
        movementAxis: "z",
        movementSign: 1,
      },
      chunkSize: 24,
      forwardDepthStrides: 2,
      sideRadiusStrides: 0,
      pinnedChunkKeys: new Set(["48,24"]),
      currentChunk: "72,24",
      prefetchedAhead: ["96,24"],
      maxPrefetchedAhead: 4,
      getRenderAreaKeyForChunk: (chunkKey) => `${chunkKey}:area`,
    });

    expect(result).toEqual({
      desiredAreaKeys: ["96,24:area"],
      chunkKeysToEnqueue: [],
      presentationChunkKeysToPrewarm: [],
      nextPrefetchedAhead: ["96,24"],
    });
  });

  it("caps the remembered prefetched-ahead list while enqueueing new targets", () => {
    const result = resolveWarpTravelDirectionalPrefetchPlan({
      anchor: {
        forwardChunkKey: "48,24",
        movementAxis: "z",
        movementSign: 1,
      },
      chunkSize: 24,
      forwardDepthStrides: 1,
      sideRadiusStrides: 0,
      pinnedChunkKeys: new Set(),
      currentChunk: "24,24",
      prefetchedAhead: ["0,24", "24,24", "48,24"],
      maxPrefetchedAhead: 2,
      getRenderAreaKeyForChunk: (chunkKey) => `${chunkKey}:area`,
    });

    expect(result).toEqual({
      desiredAreaKeys: ["48,24:area", "72,24:area"],
      chunkKeysToEnqueue: ["72,24"],
      presentationChunkKeysToPrewarm: ["48,24", "72,24"],
      nextPrefetchedAhead: ["48,24", "72,24"],
    });
  });
});
