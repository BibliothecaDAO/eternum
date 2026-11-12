import { describe, expect, it } from "vitest";
import { dailyQuest } from "./daily-quest";

describe("daily quest calendar", () => {
  it("matches the contract's three-week vector", () => {
    expect(Array.from({ length: 21 }, (_, day) => dailyQuest(5n, day))).toEqual([
      6, 4, 0, 3, 1, 2, 5, 0, 2, 6, 3, 1, 4, 5, 4, 5, 2, 1, 3, 0, 6,
    ]);
  });
  it("draws every quest once per bag without repeating across a boundary", () => {
    for (let seed = 0n; seed < 20n; seed++) {
      const days = Array.from({ length: 56 }, (_, day) => dailyQuest(seed, day));
      for (let week = 0; week < 8; week++)
        expect([...days.slice(week * 7, week * 7 + 7)].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
      for (let day = 1; day < days.length; day++) expect(days[day]).not.toBe(days[day - 1]);
    }
  });
  it("rejects invalid days", () => {
    for (const day of [-1, 0.5, NaN, Infinity]) expect(() => dailyQuest(5n, day)).toThrow("Invalid quest day");
  });
});
