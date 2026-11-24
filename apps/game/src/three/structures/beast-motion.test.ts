import { beastOfModel } from "@bibliothecadao/types";
import { Matrix4, Vector3 } from "three";
import { float } from "three/tsl";
import { afterEach, describe, expect, it } from "vitest";

import { mapAnimationTime } from "../effects/endgame/state";
import type { AnimationVisibilityContext } from "../types/animation";
import {
  BEAST_MOTION_PROFILES,
  createBeastMotionController,
  createBeastMotionNode,
  evaluateBeastMotionDisplacement,
} from "./beast-motion";
import { FRONTIER_BEASTS, type FrontierSpecies } from "./frontier-beast";

const ALL_SPECIES = Object.keys(FRONTIER_BEASTS) as FrontierSpecies[];

afterEach(() => {
  mapAnimationTime.value = 0;
});

describe("Pure-maths beast motion module", () => {
  it.each(ALL_SPECIES)("moves %s visibly at rest while keeping grounded feet planted", (species) => {
    const profile = BEAST_MOTION_PROFILES[species];
    const idle = beastOfModel(species).idle;
    const controller = createBeastMotionController(species, 2);
    controller.setPlacementAt(0, new Matrix4().makeTranslation(0, 0, 0));
    expect(createBeastMotionNode(species, float(mapAnimationTime))).toBeDefined();

    const probe: [number, number, number] = [0.28, profile.height * 0.68, -0.22];
    const startDisp = evaluateBeastMotionDisplacement(species, probe, controller.getStateAt(0, 0));

    let maxDelta = 0;
    for (let frame = 1; frame <= 45; frame++) {
      const now = frame / 30;
      controller.update(now, [0]);
      const next = evaluateBeastMotionDisplacement(species, probe, controller.getStateAt(0, now));
      const dist = Math.hypot(next[0] - startDisp[0], next[1] - startDisp[1], next[2] - startDisp[2]);
      if (dist > maxDelta) maxDelta = dist;
    }

    expect(maxDelta).toBeGreaterThan(0.01);
    if (idle.motion === "breath" && profile.hoverAmp === 0) {
      const footDisp = evaluateBeastMotionDisplacement(species, [0, 0, 0], controller.getStateAt(0, 1.5));
      expect(Math.hypot(...footDisp)).toBeLessThan(1e-5);
    }
  });

  it("reads catalog idle motion, speed and height directly without duplicating values", () => {
    const state = { action: "idle" as const, progress: 0, clock: 0.6, active: true };
    const lowLift = evaluateBeastMotionDisplacement("wraith", [0, 0.5, 0], state, {
      motion: "lift",
      speed: 1.2,
      height: 0.028,
    });
    const tallLift = evaluateBeastMotionDisplacement("wraith", [0, 0.5, 0], state, {
      motion: "lift",
      speed: 1.2,
      height: 0.5,
    });
    expect(Math.abs(tallLift[1] - lowLift[1])).toBeGreaterThan(0.2);
  });

  it("plays an attack once with forward lunge displacement and returns cleanly to idle", () => {
    const controller = createBeastMotionController("wyvern", 4);
    controller.setPlacementAt(0, new Matrix4().makeTranslation(2, 0, 3));
    controller.playActionAt(0, "attack", 1);
    expect(controller.getStateAt(0, 1).action).toBe("attack");

    let maxForwardLunge = -Infinity;
    let sawAttack = false;
    let now = 1;
    for (let step = 1; step <= 30; step++) {
      now = 1 + step * 0.05;
      controller.update(now, [0]);
      const state = controller.getStateAt(0, now);
      if (state.action === "attack") {
        sawAttack = true;
        const disp = evaluateBeastMotionDisplacement("wyvern", [0, 0.7, 0.15], state);
        if (disp[2] > maxForwardLunge) maxForwardLunge = disp[2];
      }
    }

    expect(sawAttack).toBe(true);
    expect(maxForwardLunge).toBeGreaterThan(0.15);
    expect(controller.getStateAt(0, now).action).toBe("idle");
    expect(controller.getStateAt(0, now).progress).toBe(0);

    const versionAtIdle = controller.attribute.version;
    for (let step = 0; step < 10; step++) {
      now += 0.05;
      controller.update(now, [0]);
    }
    expect(controller.attribute.version).toBe(versionAtIdle);
  });

  it("runs hit flinch once and settles death to rest", () => {
    const controller = createBeastMotionController("minotaur", 2);
    controller.setPlacementAt(0, new Matrix4().makeTranslation(0, 0, 0));

    controller.playActionAt(0, "hit", 0);
    expect(controller.getStateAt(0, 0).action).toBe("hit");
    let now = 0;
    for (let i = 1; i <= 20; i++) {
      now = i * 0.05;
      controller.update(now, [0]);
    }
    expect(controller.getStateAt(0, now).action).toBe("idle");

    const deathStart = now;
    controller.playActionAt(0, "death", deathStart);
    now = deathStart + 1.5;
    controller.update(now, [0]);
    const dead = controller.getStateAt(0, now);
    expect(dead.action).toBe("death");
    expect(dead.progress).toBe(1);
    const fallenDisp = evaluateBeastMotionDisplacement("minotaur", [0, 0.9, 0], dead);
    expect(fallenDisp[1]).toBeLessThan(-0.5);

    controller.resetSlot(0);
    controller.setPlacementAt(0, new Matrix4().makeTranslation(4, 0, 4));
    const reused = controller.getStateAt(0, now);
    expect(reused.action).toBe("idle");
    expect(reused.progress).toBe(0);
    expect(reused.active).toBe(true);
  });

  it("runs nothing off screen and performs zero buffer uploads while steady", () => {
    const controller = createBeastMotionController("troll", 4);
    controller.setPlacementAt(0, new Matrix4().makeTranslation(1, 0, 1));
    controller.setPlacementAt(1, new Matrix4().makeTranslation(240, 0, 240));

    const offscreenContext: AnimationVisibilityContext = {
      cameraPosition: new Vector3(0, 12, 12),
      maxDistance: 40,
      visibilityManager: {
        isPointVisible: (pos: Vector3) => pos.x < 50,
        isBoxVisible: () => true,
      } as unknown as AnimationVisibilityContext["visibilityManager"],
    };

    controller.update(0.5, [0, 1], offscreenContext);
    expect(controller.getStateAt(0, 0.5).active).toBe(true);
    expect(controller.getStateAt(1, 0.5).active).toBe(false);
    expect(evaluateBeastMotionDisplacement("troll", [0, 0.7, 0], controller.getStateAt(1, 0.5))).toEqual([0, 0, 0]);

    controller.playActionAt(1, "attack", 0.5);
    expect(controller.getStateAt(1, 0.5).action).toBe("idle");

    const versionAfterTransition = controller.attribute.version;
    let now = 0.5;
    for (let i = 0; i < 10; i++) {
      now += 0.05;
      controller.update(now, [0, 1], offscreenContext);
    }
    expect(controller.attribute.version).toBe(versionAfterTransition);
  });
});
