import { describe, expect, it } from "vitest";

import { drainWarpTravelPrefetchQueue } from "./warp-travel-prefetch-drain";
import type { PrefetchQueueItem } from "./worldmap-prefetch-queue";

describe("drainWarpTravelPrefetchQueue", () => {
  it("requests queued-state clearing when the scene is switched off", () => {
    const queue: PrefetchQueueItem[] = [{ chunkKey: "24,24", fetchKey: "24,24:area", priority: 2, fetchTiles: true }];
    const queuedFetchKeys = new Set<string>(["24,24:area"]);

    const result = drainWarpTravelPrefetchQueue({
      isSwitchedOff: true,
      queue,
      queuedFetchKeys,
      activePrefetches: 0,
      maxConcurrentPrefetches: 2,
      desiredFetchKeys: new Set(["24,24:area"]),
      fetchedFetchKeys: new Set(),
      pendingFetchKeys: new Set(),
      pinnedAreaKeys: new Set(),
    });

    expect(result).toEqual({
      shouldClearQueuedState: true,
      startedItems: [],
      skippedItems: [],
    });
  });

  it("starts eligible items up to the concurrency limit and removes queued fetch keys for tile work", () => {
    const queue: PrefetchQueueItem[] = [
      { chunkKey: "24,24", fetchKey: "24,24:area", priority: 1, fetchTiles: true },
      { chunkKey: "48,24", fetchKey: "48,24:area", priority: 2, fetchTiles: true },
      { chunkKey: "72,24", fetchKey: "72,24:area", priority: 3, fetchTiles: true },
    ];
    const queuedFetchKeys = new Set<string>(["24,24:area", "48,24:area", "72,24:area"]);

    const result = drainWarpTravelPrefetchQueue({
      isSwitchedOff: false,
      queue,
      queuedFetchKeys,
      activePrefetches: 0,
      maxConcurrentPrefetches: 2,
      desiredFetchKeys: new Set(["24,24:area", "48,24:area", "72,24:area"]),
      fetchedFetchKeys: new Set(),
      pendingFetchKeys: new Set(),
      pinnedAreaKeys: new Set(),
    });

    expect(result).toEqual({
      shouldClearQueuedState: false,
      startedItems: [
        { chunkKey: "24,24", fetchKey: "24,24:area", priority: 1, fetchTiles: true },
        { chunkKey: "48,24", fetchKey: "48,24:area", priority: 2, fetchTiles: true },
      ],
      skippedItems: [],
    });
    expect(queue).toEqual([{ chunkKey: "72,24", fetchKey: "72,24:area", priority: 3, fetchTiles: true }]);
    expect(Array.from(queuedFetchKeys)).toEqual(["72,24:area"]);
  });

  it("skips stale items and continues draining later eligible work", () => {
    const queue: PrefetchQueueItem[] = [
      { chunkKey: "24,24", fetchKey: "24,24:area", priority: 1, fetchTiles: true },
      { chunkKey: "48,24", fetchKey: "48,24:area", priority: 2, fetchTiles: true },
    ];
    const queuedFetchKeys = new Set<string>(["24,24:area", "48,24:area"]);

    const result = drainWarpTravelPrefetchQueue({
      isSwitchedOff: false,
      queue,
      queuedFetchKeys,
      activePrefetches: 0,
      maxConcurrentPrefetches: 2,
      desiredFetchKeys: new Set(["48,24:area"]),
      fetchedFetchKeys: new Set(),
      pendingFetchKeys: new Set(),
      pinnedAreaKeys: new Set(),
    });

    expect(result).toEqual({
      shouldClearQueuedState: false,
      startedItems: [{ chunkKey: "48,24", fetchKey: "48,24:area", priority: 2, fetchTiles: true }],
      skippedItems: [{ chunkKey: "24,24", fetchKey: "24,24:area", priority: 1, fetchTiles: true }],
    });
    expect(queue).toEqual([]);
    expect(Array.from(queuedFetchKeys)).toEqual([]);
  });
});
