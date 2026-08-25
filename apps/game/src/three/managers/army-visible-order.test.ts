import { describe, expect, it } from "vitest";
import {
  addVisibleArmyOrderEntry,
  createVisibleArmyOrderState,
  removeVisibleArmyOrderEntry,
  replaceVisibleArmyOrder,
} from "./army-visible-order";

describe("army-visible-order", () => {
  it("adds entries once and tracks their indices", () => {
    const state = createVisibleArmyOrderState<number>();

    expect(addVisibleArmyOrderEntry(state, 7)).toBe(true);
    expect(addVisibleArmyOrderEntry(state, 9)).toBe(true);
    expect(addVisibleArmyOrderEntry(state, 7)).toBe(false);
    expect(state.order).toEqual([7, 9]);
    expect(state.indices.get(7)).toBe(0);
    expect(state.indices.get(9)).toBe(1);
  });

  it("removes entries in O(1) with swap-delete bookkeeping", () => {
    const state = createVisibleArmyOrderState<number>();
    replaceVisibleArmyOrder(state, [4, 7, 9]);

    expect(removeVisibleArmyOrderEntry(state, 7)).toEqual({ removed: true, swappedEntityId: 9 });
    expect(state.order).toEqual([4, 9]);
    expect(state.indices.get(4)).toBe(0);
    expect(state.indices.get(9)).toBe(1);
    expect(state.indices.has(7)).toBe(false);
  });

  it("replaces the visible order and rebuilds the index map", () => {
    const state = createVisibleArmyOrderState<number>();
    replaceVisibleArmyOrder(state, [1, 2, 3]);
    replaceVisibleArmyOrder(state, [3, 8]);

    expect(state.order).toEqual([3, 8]);
    expect([...state.indices.entries()]).toEqual([
      [3, 0],
      [8, 1],
    ]);
  });
});
