import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import {
  advanceWorldmapCameraSpring,
  createWorldmapCameraSpringGoal,
  createWorldmapCameraSpringState,
} from "./worldmap-camera-spring";

const TEST_SPRING_CONFIG = {
  angularFrequency: 14,
  settleDistance: 0.025,
  settleVelocity: 0.05,
  maxDeltaSeconds: 1 / 20,
};

describe("advanceWorldmapCameraSpring", () => {
  it("moves toward the fixed camera band goal without snapping on the first frame", () => {
    const state = createWorldmapCameraSpringState();
    const goal = createWorldmapCameraSpringGoal();
    goal.cameraPosition.set(0, 20, 10);

    const settled = advanceWorldmapCameraSpring({
      state,
      goal,
      config: TEST_SPRING_CONFIG,
      deltaSeconds: 1 / 60,
    });

    expect(settled).toBe(false);
    expect(state.cameraPosition.y).toBeGreaterThan(0);
    expect(state.cameraPosition.y).toBeLessThan(20);
    expect(state.cameraVelocity.length()).toBeGreaterThan(0);
  });

  it("settles exactly on the goal once the spring is close enough", () => {
    const state = createWorldmapCameraSpringState();
    const goal = createWorldmapCameraSpringGoal();
    goal.cameraPosition.set(0, 20, 10);
    goal.cameraTarget.set(2, 0, 3);

    let settled = false;
    for (let frame = 0; frame < 90; frame += 1) {
      settled = advanceWorldmapCameraSpring({
        state,
        goal,
        config: TEST_SPRING_CONFIG,
        deltaSeconds: 1 / 60,
      });
    }

    expect(settled).toBe(true);
    expect(state.cameraPosition.toArray()).toEqual(goal.cameraPosition.toArray());
    expect(state.cameraTarget.toArray()).toEqual(goal.cameraTarget.toArray());
    expect(state.cameraVelocity.length()).toBe(0);
    expect(state.targetVelocity.length()).toBe(0);
  });

  it("keeps velocity when the goal is retargeted during motion", () => {
    const state = createWorldmapCameraSpringState();
    const farGoal = createWorldmapCameraSpringGoal();
    farGoal.cameraPosition.set(0, 40, 20);

    advanceWorldmapCameraSpring({
      state,
      goal: farGoal,
      config: TEST_SPRING_CONFIG,
      deltaSeconds: 1 / 60,
    });

    const velocityBeforeRetarget = state.cameraVelocity.clone();
    const closeGoal = createWorldmapCameraSpringGoal();
    closeGoal.cameraPosition.copy(new Vector3(0, 10, 8));

    advanceWorldmapCameraSpring({
      state,
      goal: closeGoal,
      config: TEST_SPRING_CONFIG,
      deltaSeconds: 1 / 60,
    });

    expect(velocityBeforeRetarget.length()).toBeGreaterThan(0);
    expect(state.cameraVelocity.length()).toBeGreaterThan(0);
    expect(state.cameraPosition.y).toBeGreaterThan(0);
    expect(state.cameraPosition.y).toBeLessThan(10);
  });
});
