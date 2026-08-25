import { describe, expect, it } from "vitest";

import { drainWarpTravelPrefetchQueue } from "./warp-travel-prefetch-drain";
import type { PrefetchQueueItem } from "./worldmap-prefetch-queue";

describe("drainWarpTravelPrefetchQueue", () => {
  it("requests queued-state clearing when the scene is switched off", () => {
    const queue: PrefetchQueueItem[] = [{ chunkKey: "24,24", areaKey: "24,24:area", priority: 2, syncTiles: true }];
    const queuedAreaKeys = new Set<string>(["24,24:area"]);

    const result = drainWarpTravelPrefetchQueue({
      isSwitchedOff: true,
      queue,
      queuedAreaKeys,
      activePrefetches: 0,
      maxConcurrentPrefetches: 2,
      desiredAreaKeys: new Set(["24,24:area"]),
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
      { chunkKey: "24,24", areaKey: "24,24:area", priority: 1, syncTiles: true },
      { chunkKey: "48,24", areaKey: "48,24:area", priority: 2, syncTiles: true },
      { chunkKey: "72,24", areaKey: "72,24:area", priority: 3, syncTiles: true },
    ];
    const queuedAreaKeys = new Set<string>(["24,24:area", "48,24:area", "72,24:area"]);

    const result = drainWarpTravelPrefetchQueue({
      isSwitchedOff: false,
      queue,
      queuedAreaKeys,
      activePrefetches: 0,
      maxConcurrentPrefetches: 2,
      desiredAreaKeys: new Set(["24,24:area", "48,24:area", "72,24:area"]),
      pinnedAreaKeys: new Set(),
    });

    expect(result).toEqual({
      shouldClearQueuedState: false,
      startedItems: [
        { chunkKey: "24,24", areaKey: "24,24:area", priority: 1, syncTiles: true },
        { chunkKey: "48,24", areaKey: "48,24:area", priority: 2, syncTiles: true },
      ],
      skippedItems: [],
    });
    expect(queue).toEqual([{ chunkKey: "72,24", areaKey: "72,24:area", priority: 3, syncTiles: true }]);
    expect(Array.from(queuedAreaKeys)).toEqual(["72,24:area"]);
  });

  it("skips stale items and continues draining later eligible work", () => {
    const queue: PrefetchQueueItem[] = [
      { chunkKey: "24,24", areaKey: "24,24:area", priority: 1, syncTiles: true },
      { chunkKey: "48,24", areaKey: "48,24:area", priority: 2, syncTiles: true },
    ];
    const queuedAreaKeys = new Set<string>(["24,24:area", "48,24:area"]);

    const result = drainWarpTravelPrefetchQueue({
      isSwitchedOff: false,
      queue,
      queuedAreaKeys,
      activePrefetches: 0,
      maxConcurrentPrefetches: 2,
      desiredAreaKeys: new Set(["48,24:area"]),
      pinnedAreaKeys: new Set(),
    });

    expect(result).toEqual({
      shouldClearQueuedState: false,
      startedItems: [{ chunkKey: "48,24", areaKey: "48,24:area", priority: 2, syncTiles: true }],
      skippedItems: [{ chunkKey: "24,24", areaKey: "24,24:area", priority: 1, syncTiles: true }],
    });
    expect(queue).toEqual([]);
    expect(Array.from(queuedAreaKeys)).toEqual([]);
  });
});
