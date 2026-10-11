import { describe, expect, it } from "vitest";

import { clockLine, formatContentDay } from "./clock-chip";

/** A local moment, so the expectations read the same in every time zone. */
const at = (month: number, day: number, hours: number, minutes: number, year = 2026) =>
  new Date(year, month - 1, day, hours, minutes).getTime() / 1000;

const NOW = at(10, 7, 14, 26);

describe("the one time line", () => {
  it.each([
    ["a start within a day: its clock time and how long until", "starts", at(10, 7, 16, 30), "Starts 16:30 · in 2h 4m"],
    ["an end within a day: its clock time and how long is left", "ends", at(10, 7, 15, 4), "Ends 15:04 · 38m left"],
    ['a day away already reads by its date, never "24h"', "opens", at(10, 8, 14, 26), "Opens 8 Oct, 14:26"],
    ["further out: the date and the time", "opens", at(10, 14, 18, 0), "Opens 14 Oct, 18:00"],
    ["a moment not known yet: a dash", "starts", undefined, "Starts —"],
  ] as const)("%s", (_case, prefix, moment, line) => {
    expect(clockLine(prefix, moment, NOW)).toBe(line);
  });

  it("dates a finished game by its day, with the year only when it is not this year's", () => {
    expect(clockLine(null, at(10, 7, 9, 0), NOW)).toBe("7 Oct");
    expect(clockLine(null, at(12, 30, 9, 0, 2025), NOW)).toBe("30 Dec 2025");
    expect(clockLine(null, undefined, NOW)).toBe("—");
  });

  it("never counts in days: a Frontier day of 20 hours reads in hours and minutes", () => {
    expect(clockLine("ends", NOW + 20 * 3600 + 5 * 60, NOW)).toBe("Ends 10:31 · 20h 5m left");
  });

  it("reads a bundled post's day on the device's own calendar", () => {
    expect(formatContentDay("2025-01-13")).toBe("13 Jan 2025");
  });
});
