import { describe, expect, it } from "vitest";

import {
  WORLDMAP_STRATEGIC_SETTLE_MS,
  createWorldNavigationModeMachineState,
  updateWorldNavigationModeMachine,
} from "./world-navigation-mode-machine";

describe("world-navigation-mode-machine", () => {
  it("stays in 3D mode below the transition threshold", () => {
    const nextState = updateWorldNavigationModeMachine(createWorldNavigationModeMachineState(), {
      actualDistance: 39.5,
      status: "idle",
      nowMs: 1_000,
    });

    expect(nextState.mode).toBe("three_d");
    expect(nextState.strategicPoseActive).toBe(false);
    expect(nextState.transitionProgress).toBe(0);
  });

  it("enters the transition band before strategic mode", () => {
    const nextState = updateWorldNavigationModeMachine(createWorldNavigationModeMachineState(), {
      actualDistance: 46,
      status: "zooming",
      nowMs: 2_000,
    });

    expect(nextState.mode).toBe("transition");
    expect(nextState.transitionProgress).toBeGreaterThan(0);
    expect(nextState.transitionProgress).toBeLessThan(1);
  });

  it("promotes to strategic mode after the settle window", () => {
    const eligibleState = updateWorldNavigationModeMachine(createWorldNavigationModeMachineState(), {
      actualDistance: 52,
      status: "idle",
      nowMs: 3_000,
    });
    const promotedState = updateWorldNavigationModeMachine(eligibleState, {
      actualDistance: 52,
      status: "idle",
      nowMs: 3_000 + WORLDMAP_STRATEGIC_SETTLE_MS,
    });

    expect(promotedState.mode).toBe("strategic_2d");
    expect(promotedState.strategicPoseActive).toBe(true);
    expect(promotedState.transitionProgress).toBe(1);
  });

  it("drops back into transition mode when strategic exit is requested", () => {
    const strategicState = updateWorldNavigationModeMachine(createWorldNavigationModeMachineState(), {
      actualDistance: 52,
      status: "idle",
      nowMs: 4_000 + WORLDMAP_STRATEGIC_SETTLE_MS,
      strategicSettleMs: 0,
    });
    const exitState = updateWorldNavigationModeMachine(strategicState, {
      actualDistance: 56,
      status: "idle",
      nowMs: 4_500,
      exitStrategicMode: true,
    });

    expect(exitState.mode).toBe("transition");
    expect(exitState.strategicPoseActive).toBe(false);
    expect(exitState.eligibleStrategicSinceMs).toBeNull();
  });
});
