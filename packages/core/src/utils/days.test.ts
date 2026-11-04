import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bagLengths, dayOf, orderLengths, seasonSeconds } from "./days";

const calendar = {
  seed: 0x5eedn,
  startMainAt: 1_800_000_000,
  endAt: 1_800_000_000 + seasonSeconds(21, 14_400),
  dayUnitSeconds: 14_400,
};

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

it("matches Cairo on clipped, merged, exact-minimum, very short and whole-bag seasons", () => {
  const values = readFileSync(
    new URL("../../../../contracts/l3/world-native/tests/fixtures/season-tail-v1.txt", import.meta.url),
    "utf8",
  )
    .trim()
    .split(/\s+/)
    .map(Number);
  for (let offset = 0; offset < values.length; offset += 5) {
    const [duration, timestamp, index, start, end] = values.slice(offset, offset + 5);
    const clock = { seed: 0x5eedn, startMainAt: 0, endAt: duration, dayUnitSeconds: 7200 };
    expect(dayOf(clock, timestamp)).toEqual({ index, start, end });
    expect(dayOf(clock, duration)).toBeNull();
  }
});

it("covers any end without gaps, extra days or an unmerged short stub", () => {
  for (const seed of [1n, 7n, 42n, 0x5eedn]) {
    const lengths = [0, 1, 2].flatMap((bag) => bagLengths(seed, bag));
    for (let duration = 1; duration <= 60 * 40; duration += 17) {
      const clock = { seed, startMainAt: 0, endAt: duration, dayUnitSeconds: 40 };
      const expected: { index: number; start: number; end: number }[] = [];
      let start = 0;
      for (const length of lengths) {
        if (start >= duration) break;
        const end = Math.min(start + length * 40, duration);
        if (end - start < 80 && expected.length) expected.at(-1)!.end = end;
        else expected.push({ index: expected.length, start, end });
        start = end;
      }
      for (const day of expected) {
        expect(dayOf(clock, day.start)).toEqual(day);
        expect(dayOf(clock, day.end - 1)).toEqual(day);
      }
      expect(expected.at(-1)!.end).toBe(duration);
    }
  }
});

it("extends Season 0 without moving its first ten days, restoring day eleven and adding the new tail", async () => {
  const { default: approved } = await import("../../../../config/source/frontier/extension.json");
  const extended = {
    seed: BigInt(approved.seed),
    startMainAt: approved.start,
    endAt: approved.end,
    dayUnitSeconds: approved.dayUnit,
  };
  const original = { ...extended, endAt: approved.oldEnd };
  let cursor = approved.start;
  for (let index = 0; index < 10; index++) {
    const before = dayOf(original, cursor)!;
    expect(dayOf(extended, cursor)).toEqual(before);
    expect(before.index).toBe(index);
    cursor = before.end;
  }
  expect(dayOf(original, approved.oldEnd - 1)).toEqual({ index: 10, start: 1793970000, end: 1793988000 });
  expect(dayOf(extended, approved.oldEnd)).toEqual({ index: 10, start: 1793970000, end: 1793991600 });
  expect(dayOf(extended, approved.end - 1)).toEqual({ index: 31, start: 1794574800, end: 1794592800 });
  expect(dayOf(extended, approved.end)).toBeNull();
});
