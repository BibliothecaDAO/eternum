import { describe, expect, it } from "vitest";

import { enqueueWarpTravelPrefetch } from "./warp-travel-prefetch-enqueue";
import type { PrefetchQueueItem } from "./worldmap-prefetch-queue";

describe("enqueueWarpTravelPrefetch", () => {
  it("skips empty chunk keys", () => {
    const queue: PrefetchQueueItem[] = [];
    const queuedFetchKeys = new Set<string>();

    const result = enqueueWarpTravelPrefetch({
      chunkKey: "",
      fetchKey: "",
      priority: 2,
      queue,
      queuedFetchKeys,
      fetchedFetchKeys: new Set(),
      pendingFetchKeys: new Set(),
    });

    expect(result).toEqual({ enqueued: false, skipped: true });
    expect(queue).toEqual([]);
    expect(Array.from(queuedFetchKeys)).toEqual([]);
  });

  it("skips chunks whose fetch area is already fetched, pending, or queued", () => {
    const queue: PrefetchQueueItem[] = [];
    const queuedFetchKeys = new Set<string>(["24,24:area"]);

    const result = enqueueWarpTravelPrefetch({
      chunkKey: "24,24",
      fetchKey: "24,24:area",
      priority: 2,
      queue,
      queuedFetchKeys,
      fetchedFetchKeys: new Set(["0,0:area"]),
      pendingFetchKeys: new Set(["12,12:area"]),
    });

    expect(result).toEqual({ enqueued: false, skipped: true });
    expect(queue).toEqual([]);
    expect(Array.from(queuedFetchKeys)).toEqual(["24,24:area"]);
  });

  it("enqueues new fetch areas and tracks their queued fetch key", () => {
    const queue: PrefetchQueueItem[] = [];
    const queuedFetchKeys = new Set<string>();

    const result = enqueueWarpTravelPrefetch({
      chunkKey: "24,24",
      fetchKey: "24,24:area",
      priority: 2,
      queue,
      queuedFetchKeys,
      fetchedFetchKeys: new Set(),
      pendingFetchKeys: new Set(),
    });

    expect(result).toEqual({ enqueued: true, skipped: false });
    expect(queue).toEqual([
      {
        chunkKey: "24,24",
        fetchKey: "24,24:area",
        priority: 2,
        fetchTiles: true,
      },
    ]);
    expect(Array.from(queuedFetchKeys)).toEqual(["24,24:area"]);
  });
});
