// @vitest-environment node

import { describe, expect, it } from "vitest";

import { selectCoarseCurrentDefaultTick, selectCurrentDefaultTick, useCurrentDefaultTick } from "./use-block-timestamp";

const buildTimestampState = (currentDefaultTick: number) => ({
  currentBlockTimestamp: currentDefaultTick,
  currentDefaultTick,
  currentArmiesTick: 0,
  armiesTickTimeRemaining: 0,
  tick: () => undefined,
});

describe("use-block-timestamp selectors", () => {
  it("returns the live current default tick without bucketing", () => {
    expect(selectCurrentDefaultTick(buildTimestampState(109))).toBe(109);
  });

  it("buckets the coarse current default tick to the configured window", () => {
    expect(selectCoarseCurrentDefaultTick(buildTimestampState(109), 10)).toBe(100);
    expect(selectCoarseCurrentDefaultTick(buildTimestampState(110), 10)).toBe(110);
  });

  it("exports a live default tick hook for action-oriented consumers", () => {
    expect(useCurrentDefaultTick).toBeTypeOf("function");
  });
});
