// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  clampCycleProgress,
  dayLightProgress,
  DAY_PHASE_PROGRESS,
  hearthStrength,
  resolveDayPhase,
  SURFACE_MOOD_PROGRESS,
} from "./cycle-progress";

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

it("runs the Surface's day from morning through midday and the golden afternoon to dusk", () => {
  expect(dayLightProgress(0)).toBeCloseTo(DAY_PHASE_PROGRESS.morning, 6);
  expect(dayLightProgress(0.25)).toBeCloseTo(125 / 3, 6);
  expect(dayLightProgress(0.5)).toBe(50);
  expect(dayLightProgress(0.9)).toBeCloseTo((175 / 3 + 200 / 3) / 2, 6);
  expect(dayLightProgress(1)).toBeCloseTo(DAY_PHASE_PROGRESS.dusk, 6);
});

it("lights the hearths weakest at midday and strongest at dusk", () => {
  expect(hearthStrength(DAY_PHASE_PROGRESS.morning)).toBeCloseTo(0.8, 6);
  expect(hearthStrength(50)).toBeCloseTo(0.6, 6);
  expect(hearthStrength((50 + DAY_PHASE_PROGRESS.dusk) / 2)).toBeCloseTo(0.9, 6);
  expect(hearthStrength(DAY_PHASE_PROGRESS.dusk)).toBeCloseTo(1.2, 6);
});
