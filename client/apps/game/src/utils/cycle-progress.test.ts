// @vitest-environment node

import { describe, expect, it } from "vitest";

import { clampCycleProgress, resolveDebuggableCycleProgress } from "./cycle-progress";

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

  it("uses live progress when no debug override is active", () => {
    expect(resolveDebuggableCycleProgress(63, null)).toBe(63);
  });

  it("uses and clamps the debug override when it is active", () => {
    expect(resolveDebuggableCycleProgress(63, 18)).toBe(18);
    expect(resolveDebuggableCycleProgress(63, 180)).toBe(100);
  });
});
