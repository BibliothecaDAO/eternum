import { describe, expect, test } from "vitest";
import { splitPlaytestRoster } from "./slots";

describe("registration-order playtest groups", () => {
  test.each([
    [0, []],
    [1, [1]],
    [24, [24]],
    [25, [13, 12]],
    [50, [17, 17, 16]],
    [97, [20, 20, 19, 19, 19]],
  ] as const)("splits %i registrants without losing or repeating a player", (count, sizes) => {
    const roster = Array.from({ length: count }, (_, index) => `player-${index}`);
    const groups = splitPlaytestRoster(roster);
    expect(groups.map((group) => group.length)).toEqual(sizes);
    expect(groups.flat()).toEqual(roster);
    expect(roster).toHaveLength(count);
  });
});
