import { describe, expect, it } from "vitest";
import { bagLengths, dayOf, orderLengths, seasonSeconds } from "./days";

const calendar = { seed: 0x5eedn, startMainAt: 1_800_000_000, dayUnitSeconds: 14_400 };

describe("dayOf", () => {
  it("builds 96 distinct bags that hold each length once and never open with the short day", () => {
    const bags = new Set<string>();
    for (let order = 0; order < 96; order++) {
      const lengths = orderLengths(order);
      expect([...lengths].sort()).toEqual([2, 3, 4, 5, 6]);
      expect(lengths[0]).not.toBe(2);
      bags.add(lengths.join(""));
    }
    expect(bags.size).toBe(96);
  });

  // The same vector as days.cairo's drawn_bags_match_the_client_vector.
  it("draws the contract's bags from the same seed", () => {
    expect([0, 1, 2].flatMap((bag) => bagLengths(0x5eedn, bag))).toEqual([4, 6, 3, 2, 5, 4, 3, 5, 2, 6, 3, 6, 4, 2, 5]);
  });

  it("walks the season day by day: each day ends where the next starts, 105 days in ten weeks", () => {
    let timestamp = calendar.startMainAt;
    let index = 0;
    while (timestamp < calendar.startMainAt + seasonSeconds(21, calendar.dayUnitSeconds)) {
      const day = dayOf(calendar, timestamp)!;
      expect(day).toEqual({ index, start: timestamp, end: day.end });
      expect(dayOf(calendar, day.end - 1)).toEqual(day);
      expect([8, 12, 16, 20, 24]).toContain((day.end - day.start) / 3600);
      timestamp = day.end;
      index += 1;
    }
    expect(index).toBe(105);
    expect(timestamp - calendar.startMainAt).toBe(10 * 7 * 86_400);
  });

  it("has no day before the season starts", () => {
    expect(dayOf(calendar, calendar.startMainAt - 1)).toBeNull();
  });
});
