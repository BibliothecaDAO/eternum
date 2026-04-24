import { describe, expect, it } from "vitest";

import { WorldmapMoveQueue } from "./worldmap-move-queue";

describe("WorldmapMoveQueue", () => {
  it("returns undefined when dequeueing an empty slot", () => {
    const queue = new WorldmapMoveQueue();
    expect(queue.dequeue(7)).toBeUndefined();
  });

  it("stores a single queued move per entity", () => {
    const queue = new WorldmapMoveQueue();
    const actionPath = [{ hex: { col: 10, row: 10 } }] as any;

    queue.enqueue(7, { actionPath });

    expect(queue.has(7)).toBe(true);
    const got = queue.dequeue(7);
    expect(got?.actionPath).toBe(actionPath);
  });

  it("replaces a prior queued move instead of appending (depth = 1)", () => {
    const queue = new WorldmapMoveQueue();
    const first = [{ hex: { col: 1, row: 1 } }] as any;
    const second = [{ hex: { col: 2, row: 2 } }] as any;

    queue.enqueue(7, { actionPath: first });
    queue.enqueue(7, { actionPath: second });

    const got = queue.dequeue(7);
    expect(got?.actionPath).toBe(second);
    expect(queue.dequeue(7)).toBeUndefined();
  });

  it("supports clearing a slot without dequeueing", () => {
    const queue = new WorldmapMoveQueue();
    queue.enqueue(7, { actionPath: [] as any });

    queue.clear(7);

    expect(queue.has(7)).toBe(false);
  });

  it("isolates entities", () => {
    const queue = new WorldmapMoveQueue();
    const a = [{ hex: { col: 1, row: 1 } }] as any;
    const b = [{ hex: { col: 2, row: 2 } }] as any;

    queue.enqueue(7, { actionPath: a });
    queue.enqueue(9, { actionPath: b });

    expect(queue.dequeue(7)?.actionPath).toBe(a);
    expect(queue.dequeue(9)?.actionPath).toBe(b);
  });

  it("clearAll removes every queued move", () => {
    const queue = new WorldmapMoveQueue();
    queue.enqueue(1, { actionPath: [] as any });
    queue.enqueue(2, { actionPath: [] as any });

    queue.clearAll();

    expect(queue.has(1)).toBe(false);
    expect(queue.has(2)).toBe(false);
  });
});
