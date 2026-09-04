import { describe, expect, it } from "vitest";

import { applyProceduralUnitConfigPatch, createDefaultProceduralUnitConfig } from "@/three/characters";

import {
  createProceduralAnimationCapturePlan,
  resolveAnimationCapturePhase,
  resolveDefaultAnimationCaptureSequence,
} from "./procedural-animation-capture";

describe("procedural animation capture plan", () => {
  it("samples every archer phase deterministically", () => {
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), { kind: "archer" });
    const first = createProceduralAnimationCapturePlan(config, "key-phases");
    const second = createProceduralAnimationCapturePlan(config, "key-phases");

    expect(first).toEqual(second);
    expect(first.sequence).toBe("archer-shot");
    expect(first.phases.map(({ id }) => id)).toEqual([
      "track",
      "nock",
      "raise",
      "draw",
      "anchor",
      "aim",
      "release",
      "followThrough",
      "recover",
    ]);
    expect(new Set(first.sampleFrames.map((frame) => resolveAnimationCapturePhase(first, frame)?.id))).toEqual(
      new Set(first.phases.map(({ id }) => id)),
    );
  });

  it("can capture every melee simulation frame", () => {
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), { kind: "knight" });
    const plan = createProceduralAnimationCapturePlan(config, "all-frames");

    expect(plan.sequence).toBe("melee-attack");
    expect(plan.sampleFrames[0]).toBe(0);
    expect(plan.sampleFrames.at(-1)).toBe(plan.totalFrames - 1);
    expect(plan.sampleFrames.length).toBe(plan.totalFrames);
    expect(plan.truncated).toBe(false);
    expect(plan.views.map(({ id }) => id)).toEqual(["front-three-quarter"]);
  });

  it("adds two grip-detail views to the five-angle body atlas", () => {
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), { kind: "archer" });
    const plan = createProceduralAnimationCapturePlan(config, "phase-atlas");

    expect(plan.sampleFrames).toHaveLength(plan.phases.length);
    expect(plan.sampleFrames).toHaveLength(9);
    expect(plan.sampleFrames.map((frame) => resolveAnimationCapturePhase(plan, frame)?.id)).toEqual(
      plan.phases.map(({ id }) => id),
    );
    expect(plan.views.map(({ id }) => id)).toEqual([
      "front",
      "right-profile",
      "rear",
      "left-profile",
      "elevated-three-quarter",
      "right-grip-detail",
      "left-grip-detail",
    ]);
    expect(plan.views.map(({ azimuthDegrees }) => azimuthDegrees).slice(0, 4)).toEqual([0, 90, 180, 270]);
    expect(plan.views[4]?.elevationDegrees).toBeGreaterThan(plan.views[0].elevationDegrees);
    expect(plan.sampleFrames.length * plan.views.length).toBe(63);
    expect(plan.overlay).toBe("diagnostic");
  });

  it("routes non-combat units to one locomotion cycle", () => {
    expect(resolveDefaultAnimationCaptureSequence("horse")).toBe("locomotion-cycle");
    expect(resolveDefaultAnimationCaptureSequence("crossbowman")).toBe("locomotion-cycle");
  });

  it("captures every naval broadside phase from five minimum coverage angles", () => {
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), { kind: "boat" });
    const plan = createProceduralAnimationCapturePlan(config, "phase-atlas");

    expect(resolveDefaultAnimationCaptureSequence("boat")).toBe("boat-broadside");
    expect(plan.sequence).toBe("boat-broadside");
    expect(plan.phases.map(({ id }) => id)).toEqual(["acquire", "brace", "fire", "recoil", "recover"]);
    expect(plan.views.map(({ id }) => id)).toEqual([
      "front",
      "right-profile",
      "rear",
      "left-profile",
      "elevated-three-quarter",
    ]);
    expect(plan.sampleFrames).toHaveLength(5);
  });

  it("captures the complete dragon fire-breath cycle from five body views", () => {
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), { kind: "dragon" });
    const plan = createProceduralAnimationCapturePlan(config, "phase-atlas");

    expect(resolveDefaultAnimationCaptureSequence("dragon")).toBe("dragon-fire");
    expect(plan.sequence).toBe("dragon-fire");
    expect(plan.phases.map(({ id }) => id)).toEqual(["acquire", "inhale", "fire", "recover"]);
    expect(plan.sampleFrames).toHaveLength(4);
    expect(plan.views.map(({ id }) => id)).toEqual([
      "front",
      "right-profile",
      "rear",
      "left-profile",
      "elevated-three-quarter",
    ]);
  });

  it("samples all four locomotion quarters across the five-view atlas", () => {
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), { kind: "horse" });
    const plan = createProceduralAnimationCapturePlan(config, "phase-atlas");

    expect(plan.sampleFrames).toEqual([
      0,
      Math.floor(plan.totalFrames * 0.25),
      Math.floor(plan.totalFrames * 0.5),
      Math.floor(plan.totalFrames * 0.75),
    ]);
    expect(plan.sampleFrames.length * plan.views.length).toBe(20);
  });

  it("keeps full temporal captures clean unless diagnostics are explicitly requested", () => {
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), { kind: "archer" });

    expect(createProceduralAnimationCapturePlan(config, "all-frames").overlay).toBe("clean");
    expect(
      createProceduralAnimationCapturePlan(config, "all-frames", {
        overlay: "diagnostic",
        sequence: "archer-shot",
      }).overlay,
    ).toBe("diagnostic");
  });

  it("measures one moving-root gait cycle at the travel-coupled phase rate", () => {
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), {
      kind: "knight",
      humanoid: { animationMode: "walk", animationSpeed: 1, motionVariation: 0 },
    });
    const treadmill = createProceduralAnimationCapturePlan(config, "all-frames", {
      rootMotionSpeed: 0,
      sequence: "locomotion-cycle",
    });
    const natural = createProceduralAnimationCapturePlan(config, "all-frames", {
      sequence: "locomotion-cycle",
    });
    const travelling = createProceduralAnimationCapturePlan(config, "all-frames", {
      rootMotionSpeed: 1.2,
      sequence: "locomotion-cycle",
    });

    expect(treadmill.rootMotionSpeed).toBe(0);
    expect(natural.rootMotionSpeed).toBeGreaterThan(0);
    expect(travelling.rootMotionSpeed).toBe(1.2);
    expect(travelling.totalSeconds).toBeLessThan(treadmill.totalSeconds);
    expect(travelling.sampleFrames.length).toBe(travelling.totalFrames);
  });

  it("matches the runtime phase-speed clamp for extreme preview travel", () => {
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), {
      kind: "knight",
      humanoid: { animationMode: "run", animationSpeed: 1, motionVariation: 0 },
    });
    const plan = createProceduralAnimationCapturePlan(config, "all-frames", {
      rootMotionSpeed: 100,
      sequence: "locomotion-cycle",
    });

    expect(plan.totalSeconds).toBeGreaterThan(0.2);
  });
});
