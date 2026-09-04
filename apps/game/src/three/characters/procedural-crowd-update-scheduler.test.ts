import { describe, expect, it, vi } from "vitest";

import { ProceduralCrowdUpdateScheduler } from "./procedural-crowd-update-scheduler";

describe("ProceduralCrowdUpdateScheduler", () => {
  it("updates small groups every frame", () => {
    const scheduler = new ProceduralCrowdUpdateScheduler<number>(2, 4);
    const update = vi.fn();
    [0, 1, 2].forEach((item) => scheduler.add(item));

    scheduler.update(1 / 60, () => false, update);

    expect(update.mock.calls.map(([item]) => item)).toEqual([0, 1, 2]);
    expect(scheduler.getStats().laneCount).toBe(1);
  });

  it("spreads large crowds across deterministic lanes and preserves elapsed time", () => {
    const scheduler = new ProceduralCrowdUpdateScheduler<number>(2, 4);
    const updates: Array<[number, number]> = [];
    [0, 1, 2, 3].forEach((item) => scheduler.add(item));

    scheduler.update(
      1 / 60,
      () => false,
      (item, elapsed) => updates.push([item, elapsed]),
    );
    scheduler.update(
      1 / 60,
      () => false,
      (item, elapsed) => updates.push([item, elapsed]),
    );

    expect(updates.map(([item]) => item)).toEqual([0, 2, 1, 3]);
    expect(updates[0][1]).toBeCloseTo(1 / 60);
    expect(updates[2][1]).toBeCloseTo(2 / 60);
    expect(scheduler.getStats().laneCount).toBe(2);
  });

  it("updates always-due items on every lane", () => {
    const scheduler = new ProceduralCrowdUpdateScheduler<number>(2, 2);
    const updates: number[] = [];
    scheduler.add(0);
    scheduler.add(1);

    scheduler.update(
      1 / 60,
      (item) => item === 1,
      (item) => updates.push(item),
    );
    scheduler.update(
      1 / 60,
      (item) => item === 1,
      (item) => updates.push(item),
    );

    expect(updates).toEqual([0, 1, 1]);
  });

  it("updates every item for zero-delta synchronization", () => {
    const scheduler = new ProceduralCrowdUpdateScheduler<number>(4, 2);
    const updates: number[] = [];
    scheduler.add(0);
    scheduler.add(1);

    scheduler.update(
      0,
      () => false,
      (item) => updates.push(item),
    );

    expect(updates).toEqual([0, 1]);
  });
});
