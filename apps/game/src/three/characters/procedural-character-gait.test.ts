import { describe, expect, it } from "vitest";

import {
  applyProceduralCharacterConfigPatch,
  createDefaultProceduralCharacterConfig,
} from "./procedural-character-config";
import {
  advanceProceduralCharacterGaitPhase,
  resolveProceduralCharacterGaitProfile,
  resolveProceduralCharacterGaitSignals,
  resolveProceduralCharacterStepWidth,
  resolveProceduralCharacterStanceTravel,
  resolveProceduralCharacterStrideLength,
} from "./procedural-character-gait";

describe("procedural character gait", () => {
  it("uses longer planted contacts for walking than running", () => {
    const base = createDefaultProceduralCharacterConfig();
    const walk = resolveProceduralCharacterGaitSignals(
      applyProceduralCharacterConfigPatch(base, { animationMode: "walk" }),
      0,
    );
    const run = resolveProceduralCharacterGaitSignals(
      applyProceduralCharacterConfigPatch(base, { animationMode: "run" }),
      0,
    );

    expect(walk.dutyFactor).toBeGreaterThan(0.5);
    expect(run.dutyFactor).toBeLessThan(0.5);
    expect(resolveSupportCounts({ ...base, animationMode: "walk", motionVariation: 0 })).toContain(2);
    expect(resolveSupportCounts({ ...base, animationMode: "run", motionVariation: 0 })).toContain(0);
  });

  it("keeps actors deterministic while desynchronizing different seeds", () => {
    const base = createDefaultProceduralCharacterConfig();
    const first = resolveProceduralCharacterGaitSignals({ ...base, seed: 100 }, 2.5);
    const repeated = resolveProceduralCharacterGaitSignals({ ...base, seed: 100 }, 2.5);
    const second = resolveProceduralCharacterGaitSignals({ ...base, seed: 200 }, 2.5);

    expect(first).toEqual(repeated);
    expect(first.phase).not.toBeCloseTo(second.phase, 3);
  });

  it("keeps opposite feet half a cycle apart before small seeded asymmetry", () => {
    const config = applyProceduralCharacterConfigPatch(createDefaultProceduralCharacterConfig(), {
      motionVariation: 0,
    });
    const atTouchdown = resolveProceduralCharacterGaitSignals(config, 0);
    const halfCycleLater = resolveProceduralCharacterGaitSignals(config, 0.5 / atTouchdown.cadence);

    expect(atTouchdown.feet.left.contact).toBe(halfCycleLater.feet.right.contact);
    expect(atTouchdown.feet.left.progress).toBeCloseTo(halfCycleLater.feet.right.progress, 6);
  });

  it("couples phase to measured travel while retaining a filtered desired cadence", () => {
    const config = applyProceduralCharacterConfigPatch(createDefaultProceduralCharacterConfig(), {
      animationMode: "walk",
      animationSpeed: 1,
      motionVariation: 0,
    });
    const inPlace = advanceProceduralCharacterGaitPhase(0, config, 0.1, 0, 1);
    const moving = advanceProceduralCharacterGaitPhase(0, config, 0.1, 0.2, 1);

    expect(inPlace).toBeCloseTo(0.1);
    expect(moving).toBeGreaterThan(inPlace);
    expect(moving).toBeLessThan(0.2);
  });

  it("gives running a longer, earlier-recovering stride than walking", () => {
    const base = createDefaultProceduralCharacterConfig();
    const walk = applyProceduralCharacterConfigPatch(base, { animationMode: "walk" });
    const run = applyProceduralCharacterConfigPatch(base, { animationMode: "run" });

    expect(resolveProceduralCharacterStrideLength(run, 1)).toBeGreaterThan(
      resolveProceduralCharacterStrideLength(walk, 1),
    );
    expect(
      resolveProceduralCharacterStrideLength(walk, 1) * resolveProceduralCharacterGaitProfile(walk).dutyFactor,
    ).toBeCloseTo(resolveProceduralCharacterStanceTravel(walk, 1));
    expect(resolveProceduralCharacterGaitProfile(run).swingApex).toBeLessThan(
      resolveProceduralCharacterGaitProfile(walk).swingApex,
    );
    expect(resolveProceduralCharacterGaitProfile(walk).clearanceScale).toBeLessThan(
      resolveProceduralCharacterGaitProfile(run).clearanceScale,
    );
  });

  it("narrows running foot placement from the preferred walking step width", () => {
    const base = createDefaultProceduralCharacterConfig();
    const walk = applyProceduralCharacterConfigPatch(base, { animationMode: "walk", stepWidthRatio: 0.13 });
    const run = applyProceduralCharacterConfigPatch(base, { animationMode: "run", stepWidthRatio: 0.13 });

    expect(resolveProceduralCharacterStepWidth(walk, 1)).toBeCloseTo(0.13);
    expect(resolveProceduralCharacterStepWidth(run, 1)).toBeCloseTo(0.091);
  });
});

function resolveSupportCounts(config: ReturnType<typeof createDefaultProceduralCharacterConfig>): number[] {
  return Array.from({ length: 200 }, (_, index) => {
    const gait = resolveProceduralCharacterGaitSignals(config, 0, index / 200);
    return Object.values(gait.feet).filter(({ contact }) => contact === "stance").length;
  });
}
