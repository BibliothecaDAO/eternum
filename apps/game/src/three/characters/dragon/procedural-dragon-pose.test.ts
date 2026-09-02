import { describe, expect, it } from "vitest";

import { applyProceduralDragonConfigPatch, createDefaultProceduralDragonConfig } from "./procedural-dragon-config";
import {
  createIdleProceduralDragonFireState,
  resolveProceduralDragonFireSignals,
} from "./procedural-dragon-fire-cycle";
import { isProceduralDragonPoseFinite, resolveProceduralDragonPose } from "./procedural-dragon-pose";

describe("procedural dragon pose", () => {
  it("keeps flight airborne with folded legs and animated wing chains", () => {
    const config = applyProceduralDragonConfigPatch(createDefaultProceduralDragonConfig(), {
      locomotionMode: "flight",
    });
    const fire = createIdleProceduralDragonFireState();
    const pose = resolveProceduralDragonPose({
      config,
      elapsedSeconds: 1,
      firePhase: fire.phase,
      fireSignals: resolveProceduralDragonFireSignals(fire, config),
      phase: 0.25,
    });

    expect(pose.locomotionMode).toBe("flight");
    expect(pose.bodyPosition[1]).toBeGreaterThan(2);
    expect(pose.contactCount).toBe(0);
    expect(pose.wings.spread).toBe(1);
    expect(Math.abs(pose.wings.flap)).toBeGreaterThan(0.5);
    expect(isProceduralDragonPoseFinite(pose)).toBe(true);
  });

  it("switches to a terrain-aware quadruped walk", () => {
    const config = applyProceduralDragonConfigPatch(createDefaultProceduralDragonConfig(), {
      locomotionMode: "walk",
      speed: 2,
    });
    const fire = createIdleProceduralDragonFireState();
    const pose = resolveProceduralDragonPose({
      config,
      elapsedSeconds: 1,
      firePhase: fire.phase,
      fireSignals: resolveProceduralDragonFireSignals(fire, config),
      phase: 0.12,
      sampleGround: () => ({ height: 0.7, normal: [0, 1, 0] }),
    });

    expect(pose.bodyPosition[1]).toBeGreaterThan(1.8);
    expect(pose.contactCount).toBeGreaterThan(0);
    expect(pose.contactCount).toBeLessThan(4);
    expect(isProceduralDragonPoseFinite(pose)).toBe(true);
  });

  it("aims its head down toward a target below the flight path", () => {
    const config = applyProceduralDragonConfigPatch(createDefaultProceduralDragonConfig(), {
      locomotionMode: "flight",
    });
    const fire = { generation: 1, phase: "fire", phaseElapsedSeconds: 0.2, releaseCount: 1 } as const;
    const baseInput = {
      config,
      elapsedSeconds: 1,
      firePhase: fire.phase,
      fireSignals: resolveProceduralDragonFireSignals(fire, config),
      phase: 0.25,
    };
    const neutral = resolveProceduralDragonPose(baseInput);
    const targeted = resolveProceduralDragonPose({ ...baseInput, targetLocal: [0, 0.8, 6] });

    expect(targeted.mouthPosition[1]).toBeLessThan(neutral.mouthPosition[1]);
    expect(isProceduralDragonPoseFinite(targeted)).toBe(true);
  });
});
