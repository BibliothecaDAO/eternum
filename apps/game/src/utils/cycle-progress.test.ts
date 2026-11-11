// @vitest-environment node

import { describe, expect, it } from "vitest";

import { resolveDayPhase, clampCycleProgress, SURFACE_MOOD_PROGRESS } from "./cycle-progress";

describe("cycle progress debug helpers", () => {
  it("clamps progress to the day-cycle range", () => {
    expect(clampCycleProgress(-12)).toBe(0);
    expect(clampCycleProgress(47.5)).toBe(47.5);
    expect(clampCycleProgress(120)).toBe(100);
  });

  it("treats non-finite progress as the start of the cycle", () => {
    expect(clampCycleProgress(Number.NaN)).toBe(0);
    expect(clampCycleProgress(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

it("lights the Surface at one late golden afternoon, past the day's middle and before dusk", () => {
  expect(resolveDayPhase(SURFACE_MOOD_PROGRESS).name).toBe("Day");
  expect(SURFACE_MOOD_PROGRESS).toBeGreaterThan(50);
  expect(resolveDayPhase(SURFACE_MOOD_PROGRESS + 100 / 12).name).toBe("Dusk");
});

it("splits the day into six tick-long phases and wraps midnight", () => {
  expect(resolveDayPhase(25)).toEqual({ name: "Dawn", index: 1, progress: expect.closeTo(50) });
  expect(resolveDayPhase(50)).toEqual({ name: "Day", index: 3, progress: 0 });
  expect(resolveDayPhase(60)).toEqual({ name: "Day", index: 3, progress: expect.closeTo(60) });
  expect(resolveDayPhase(100)).toEqual({ name: "Night", index: 0, progress: 0 });
});
