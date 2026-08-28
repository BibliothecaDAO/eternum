import { describe, expect, it } from "vitest";

import { createDefaultProceduralHorseConfig } from "./procedural-horse-config";
import {
  advanceHorseGaitPhase,
  HORSE_HOOF_IDS,
  resolveHorseContactPhase,
  resolveHorseHoofCycle,
  resolveInitialHorseGaitPhase,
} from "./procedural-horse-gait";

describe("procedural horse gait", () => {
  it("advances phase from ground speed and wraps deterministically", () => {
    const config = { ...createDefaultProceduralHorseConfig(), gait: "walk" as const, speed: 1.05 };
    const phase = Array.from({ length: 20 }, () => 0).reduce<number>(
      (value) => advanceHorseGaitPhase(value, config, 0.05),
      0,
    );
    expect(phase).toBeCloseTo(0, 6);
    expect(resolveInitialHorseGaitPhase(1337)).toBe(resolveInitialHorseGaitPhase(1337));
    expect(resolveInitialHorseGaitPhase(1337)).not.toBe(resolveInitialHorseGaitPhase(1338));
  });

  it("stores the measured lateral-sequence walk as direct contact phases", () => {
    const config = { ...createDefaultProceduralHorseConfig(), gait: "walk" as const };
    expect(resolveContactOrder(config)).toEqual(["hindLeft", "frontLeft", "hindRight", "frontRight"]);
    expect(hasAerialPhase(config)).toBe(false);
  });

  it("keeps trot contacts in diagonal pairs with bounded dissociation", () => {
    const config = { ...createDefaultProceduralHorseConfig(), gait: "trot" as const };
    expect(resolveHorseContactPhase(config, "hindLeft")).toBeCloseTo(0);
    expect(resolveHorseContactPhase(config, "frontRight")).toBeCloseTo(0.01);
    expect(resolveHorseContactPhase(config, "hindRight")).toBeCloseTo(0.5);
    expect(resolveHorseContactPhase(config, "frontLeft")).toBeCloseTo(0.51);
    expect(hasAerialPhase(config)).toBe(true);
  });

  it("mirrors canter and gallop contact tables across left and right leads", () => {
    for (const gait of ["canter", "gallop"] as const) {
      const right = { ...createDefaultProceduralHorseConfig(), gait, lead: "right" as const };
      const left = { ...right, lead: "left" as const };
      expect(resolveHorseContactPhase(right, "frontLeft")).toBeCloseTo(resolveHorseContactPhase(left, "frontRight"));
      expect(resolveHorseContactPhase(right, "hindLeft")).toBeCloseTo(resolveHorseContactPhase(left, "hindRight"));
      expect(hasAerialPhase(right)).toBe(true);
    }
  });

  it("keeps each hoof cycle finite at wrapped and extreme phases", () => {
    const config = { ...createDefaultProceduralHorseConfig(), gait: "gallop" as const };
    for (const phase of [-100, -0.1, 0, 0.5, 1, 100]) {
      const cycle = resolveHorseHoofCycle(config, "hindRight", phase);
      expect(["stance", "swing"]).toContain(cycle.contact);
      expect(cycle.progress).toBeGreaterThanOrEqual(0);
      expect(cycle.progress).toBeLessThanOrEqual(1);
    }
  });
});

function resolveContactOrder(config: ReturnType<typeof createDefaultProceduralHorseConfig>) {
  return HORSE_HOOF_IDS.toSorted(
    (left, right) => resolveHorseContactPhase(config, left) - resolveHorseContactPhase(config, right),
  );
}

function hasAerialPhase(config: ReturnType<typeof createDefaultProceduralHorseConfig>): boolean {
  return Array.from({ length: 400 }, (_, index) => index / 400).some((phase) =>
    HORSE_HOOF_IDS.every((hoofId) => resolveHorseHoofCycle(config, hoofId, phase).contact === "swing"),
  );
}
