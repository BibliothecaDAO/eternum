// @vitest-environment node
import { buildOrderJson, readBuildOrderText, type BuildOrder } from "@bibliothecadao/eternum/automation";
import { REALM_LEVELS } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { addStep, canAdd, moveStep, removeStep, setCount } from "./order-edits";

const empty: BuildOrder = { name: "Mine", steps: [] };
/** An order as its steps read: "City 2 farm", a level up with no count. */
const lines = (order: BuildOrder) =>
  order.steps.map(({ rank, goal, count }) => `${REALM_LEVELS[rank]} ${goal === "levelUp" ? goal : `${count} ${goal}`}`);
/** Whether the language reads the order back from the JSON it copies as. */
const reads = (order: BuildOrder) => "ok" in readBuildOrderText(buildOrderJson(order));

describe("the maker's edits", () => {
  it("adds a goal at the end of its rank, asking for one more than the order already has by then", () => {
    let order = addStep(empty, 1, "farm");
    order = addStep(order, 0, "farm");
    order = addStep(order, 1, "farm");
    order = addStep(order, 2, "army");
    order = addStep(order, 1, "coal");
    expect(lines(order)).toEqual(["Settlement 1 farm", "City 1 farm", "City 2 farm", "City 1 coal", "Kingdom 1 army"]);
    expect(reads(order)).toBe(true);
  });

  it("allows one level up a rank and none at Empire", () => {
    const leveled = addStep(empty, 1, "levelUp");
    expect(lines(leveled)).toEqual(["City levelUp"]);
    expect(canAdd(leveled, 1, "levelUp")).toBe(false);
    expect(addStep(leveled, 1, "levelUp")).toBe(leveled);
    expect(canAdd(empty, 3, "levelUp")).toBe(false);
  });

  it("moves a step within its rank only, keeps counts from 1 to 99, and removes a step", () => {
    const order = [
      [0, "farm"],
      [1, "coal"],
      [1, "wood"],
      [2, "copper"],
    ].reduce((built, [rank, goal]) => addStep(built, rank as number, goal as "farm"), empty);
    expect(lines(moveStep(order, 2, -1))).toEqual([
      "Settlement 1 farm",
      "City 1 wood",
      "City 1 coal",
      "Kingdom 1 copper",
    ]);
    expect(moveStep(order, 1, -1)).toBe(order);
    expect(moveStep(order, 2, 1)).toBe(order);
    expect(setCount(order, 0, 140).steps[0].count).toBe(99);
    expect(setCount(order, 0, 0).steps[0].count).toBe(1);
    expect(lines(removeStep(order, 1))).toEqual(["Settlement 1 farm", "City 1 wood", "Kingdom 1 copper"]);
  });
});
