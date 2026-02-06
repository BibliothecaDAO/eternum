import { describe, expect, it } from "vitest";
import { insertPrefetchQueueItem } from "./worldmap-prefetch-queue";

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
