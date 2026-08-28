import { describe, expect, it } from "vitest";

import {
  resolveContactCycle,
  resolveOrganicLimbTrajectory,
  resolveSeededMotionValue,
  wrapUnitPhase,
} from "./procedural-motion-curves";

describe("procedural motion curves", () => {
  it("separates stance and swing using a configurable duty factor", () => {
    const stance = resolveContactCycle(0.2, 0, 0.6);
    const swing = resolveContactCycle(0.8, 0, 0.6);
    expect(stance.contact).toBe("stance");
    expect(stance.progress).toBeCloseTo(1 / 3);
    expect(swing.contact).toBe("swing");
    expect(swing.progress).toBeCloseTo(0.5);
  });

  it("keeps planted motion linear while lifting swing motion through an early apex", () => {
    const earlyStance = resolveOrganicLimbTrajectory({ contact: "stance", progress: 0.25 }, 1, 0.3, 1, 0.43);
    const lateStance = resolveOrganicLimbTrajectory({ contact: "stance", progress: 0.75 }, 1, 0.3, 1, 0.43);
    const swingApex = resolveOrganicLimbTrajectory({ contact: "swing", progress: 0.43 }, 1, 0.3, 1, 0.43);

    expect(earlyStance.forward - lateStance.forward).toBeCloseTo(0.5, 6);
    expect(earlyStance.lift).toBe(0);
    expect(swingApex.lift).toBeCloseTo(0.3, 6);
  });

  it("recovers a running limb early and eases it into landing", () => {
    const symmetric = resolveOrganicLimbTrajectory({ contact: "swing", progress: 0.4 }, 1, 0.3, 1, 0.39);
    const recoveryLed = resolveOrganicLimbTrajectory({ contact: "swing", progress: 0.4 }, 1, 0.3, 1, 0.39, 0.78);

    expect(recoveryLed.forward).toBeGreaterThan(symmetric.forward);
    expect(resolveOrganicLimbTrajectory({ contact: "swing", progress: 1 }, 1, 0.3, 1, 0.39, 0.78).forward).toBe(0.5);
  });

  it("provides deterministic bounded variation and phase wrapping", () => {
    expect(resolveSeededMotionValue(1337, 4)).toBe(resolveSeededMotionValue(1337, 4));
    expect(resolveSeededMotionValue(1337, 4)).toBeGreaterThanOrEqual(-1);
    expect(resolveSeededMotionValue(1337, 4)).toBeLessThanOrEqual(1);
    expect(wrapUnitPhase(-0.15)).toBeCloseTo(0.85);
  });
});
