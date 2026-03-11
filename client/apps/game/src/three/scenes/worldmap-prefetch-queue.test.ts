import { describe, expect, it } from "vitest";
import {
  insertPrefetchQueueItem,
  prunePrefetchQueueByFetchKey,
  resolvePrefetchQueueProcessingPlan,
  shouldProcessPrefetchQueueItem,
} from "./worldmap-prefetch-queue";

interface Item {
  chunkKey: string;
  fetchKey: string;
  priority: number;
  fetchTiles: boolean;
}

describe("insertPrefetchQueueItem", () => {
  it("inserts into an empty queue", () => {
    const queue: Item[] = [];

    insertPrefetchQueueItem(queue, {
      chunkKey: "0,0",
      fetchKey: "0,0",
      priority: 2,
      fetchTiles: true,
    });

    expect(queue).toHaveLength(1);
    expect(queue[0].priority).toBe(2);
  });

  it("keeps ascending priority ordering", () => {
    const queue: Item[] = [
      { chunkKey: "0,0", fetchKey: "0,0", priority: 0, fetchTiles: true },
      { chunkKey: "1,0", fetchKey: "1,0", priority: 2, fetchTiles: true },
    ];

    insertPrefetchQueueItem(queue, {
      chunkKey: "2,0",
      fetchKey: "2,0",
      priority: 1,
      fetchTiles: true,
    });

    expect(queue.map((item) => item.priority)).toEqual([0, 1, 2]);
  });

  it("preserves FIFO order for equal priorities", () => {
    const queue: Item[] = [
      { chunkKey: "a", fetchKey: "a", priority: 1, fetchTiles: true },
      { chunkKey: "b", fetchKey: "b", priority: 1, fetchTiles: true },
    ];

    insertPrefetchQueueItem(queue, {
      chunkKey: "c",
      fetchKey: "c",
      priority: 1,
      fetchTiles: true,
    });

    expect(queue.map((item) => item.chunkKey)).toEqual(["a", "b", "c"]);
  });
});

describe("prunePrefetchQueueByFetchKey", () => {
  it("drops queue items that are no longer desired", () => {
    const queue: Item[] = [
      { chunkKey: "a", fetchKey: "area-a", priority: 1, fetchTiles: true },
      { chunkKey: "b", fetchKey: "area-b", priority: 1, fetchTiles: true },
      { chunkKey: "c", fetchKey: "area-c", priority: 1, fetchTiles: true },
    ];

    prunePrefetchQueueByFetchKey(queue, new Set(["area-b", "area-c"]));

    expect(queue.map((item) => item.fetchKey)).toEqual(["area-b", "area-c"]);
  });
});

describe("shouldProcessPrefetchQueueItem", () => {
  it("returns false when worldmap is switched off", () => {
    expect(
      shouldProcessPrefetchQueueItem({
        item: { chunkKey: "0,0", fetchKey: "area-a", priority: 1, fetchTiles: true },
        isSwitchedOff: true,
        desiredFetchKeys: new Set(["area-a"]),
        fetchedFetchKeys: new Set(),
        pendingFetchKeys: new Set(),
        pinnedAreaKeys: new Set(),
      }),
    ).toBe(false);
  });

  it("returns false when fetch key is no longer desired", () => {
    expect(
      shouldProcessPrefetchQueueItem({
        item: { chunkKey: "0,0", fetchKey: "area-a", priority: 1, fetchTiles: true },
        isSwitchedOff: false,
        desiredFetchKeys: new Set(["area-b"]),
        fetchedFetchKeys: new Set(),
        pendingFetchKeys: new Set(),
        pinnedAreaKeys: new Set(),
      }),
    ).toBe(false);
  });

  it("returns false when area is already pinned/pending/fetched", () => {
    const item = { chunkKey: "0,0", fetchKey: "area-a", priority: 1, fetchTiles: true };

    expect(
      shouldProcessPrefetchQueueItem({
        item,
        isSwitchedOff: false,
        desiredFetchKeys: new Set(["area-a"]),
        fetchedFetchKeys: new Set(["area-a"]),
        pendingFetchKeys: new Set(),
        pinnedAreaKeys: new Set(),
      }),
    ).toBe(false);

    expect(
      shouldProcessPrefetchQueueItem({
        item,
        isSwitchedOff: false,
        desiredFetchKeys: new Set(["area-a"]),
        fetchedFetchKeys: new Set(),
        pendingFetchKeys: new Set(["area-a"]),
        pinnedAreaKeys: new Set(),
      }),
    ).toBe(false);

    expect(
      shouldProcessPrefetchQueueItem({
        item,
        isSwitchedOff: false,
        desiredFetchKeys: new Set(["area-a"]),
        fetchedFetchKeys: new Set(),
        pendingFetchKeys: new Set(),
        pinnedAreaKeys: new Set(["area-a"]),
      }),
    ).toBe(false);
  });

  it("returns true for relevant queue items", () => {
    expect(
      shouldProcessPrefetchQueueItem({
        item: { chunkKey: "0,0", fetchKey: "area-a", priority: 1, fetchTiles: true },
        isSwitchedOff: false,
        desiredFetchKeys: new Set(["area-a"]),
        fetchedFetchKeys: new Set(),
        pendingFetchKeys: new Set(),
        pinnedAreaKeys: new Set(),
      }),
    ).toBe(true);
  });
});

describe("resolvePrefetchQueueProcessingPlan", () => {
  it("clears queued prefetch state and skips processing when worldmap is switched off", () => {
    const plan = resolvePrefetchQueueProcessingPlan({
      isSwitchedOff: true,
      queueLength: 3,
      activePrefetches: 0,
      maxConcurrentPrefetches: 2,
    });

    expect(plan).toEqual({
      shouldClearQueuedPrefetchState: true,
      shouldProcessNextQueueItem: false,
    });
  });

  it("processes next queue item when switched on, queue has items, and concurrency is available", () => {
    const plan = resolvePrefetchQueueProcessingPlan({
      isSwitchedOff: false,
      queueLength: 2,
      activePrefetches: 1,
      maxConcurrentPrefetches: 3,
    });

    expect(plan).toEqual({
      shouldClearQueuedPrefetchState: false,
      shouldProcessNextQueueItem: true,
    });
  });

  it("does not process next item when queue is empty", () => {
    const plan = resolvePrefetchQueueProcessingPlan({
      isSwitchedOff: false,
      queueLength: 0,
      activePrefetches: 0,
      maxConcurrentPrefetches: 2,
    });

    expect(plan).toEqual({
      shouldClearQueuedPrefetchState: false,
      shouldProcessNextQueueItem: false,
    });
  });

  it("does not process next item when concurrency budget is exhausted", () => {
    const plan = resolvePrefetchQueueProcessingPlan({
      isSwitchedOff: false,
      queueLength: 1,
      activePrefetches: 2,
      maxConcurrentPrefetches: 2,
    });

    expect(plan).toEqual({
      shouldClearQueuedPrefetchState: false,
      shouldProcessNextQueueItem: false,
    });
  });
});
