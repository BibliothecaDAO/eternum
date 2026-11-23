import { beastOfModel } from "@bibliothecadao/types";
import {
  BoxGeometry,
  Group,
  InstancedBufferAttribute,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Texture,
  Vector3,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
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
import { FrontierModel } from "./frontier-model";

const ALL_SPECIES = Object.keys(FRONTIER_BEASTS) as FrontierSpecies[];

function createBeastGltf(): GLTF {
  const geometry = new BoxGeometry(0.6, 0.9, 0.6);
  const material = new MeshStandardMaterial({ map: new Texture(), normalMap: new Texture() });
  const scene = new Group();
  scene.add(new Mesh(geometry, material));
  return { scene, animations: [] } as unknown as GLTF;
}

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
    const model = new FrontierModel(createBeastGltf(), 4, "wyvern");
    try {
      model.setMatrixAt(0, new Matrix4().makeTranslation(2, 0, 3));
      model.setCount(1);
      mapAnimationTime.value = 1;
      model.playMotionAt(0, "attack", 1);
      expect(model.getMotionStateAt(0, 1).action).toBe("attack");

      let maxForwardLunge = -Infinity;
      let sawAttack = false;
      for (let step = 1; step <= 30; step++) {
        mapAnimationTime.value = 1 + step * 0.05;
        model.updateAnimations(0.05);
        const state = model.getMotionStateAt(0, mapAnimationTime.value);
        if (state.action === "attack") {
          sawAttack = true;
          const disp = evaluateBeastMotionDisplacement("wyvern", [0, 0.7, 0.15], state);
          if (disp[2] > maxForwardLunge) maxForwardLunge = disp[2];
        }
      }

      expect(sawAttack).toBe(true);
      expect(maxForwardLunge).toBeGreaterThan(0.15);
      expect(model.getMotionStateAt(0, mapAnimationTime.value).action).toBe("idle");
      expect(model.getMotionStateAt(0, mapAnimationTime.value).progress).toBe(0);

      const motionAttr = model.instancedMeshes[0].geometry.getAttribute("beastMotion") as InstancedBufferAttribute;
      const versionAtIdle = motionAttr.version;
      for (let step = 0; step < 10; step++) {
        mapAnimationTime.value += 0.05;
        model.updateAnimations(0.05);
      }
      expect(motionAttr.version).toBe(versionAtIdle);
    } finally {
      model.dispose();
    }
  });

  it("runs hit flinch once and settles death to rest", () => {
    const model = new FrontierModel(createBeastGltf(), 2, "minotaur");
    try {
      model.setMatrixAt(0, new Matrix4().makeTranslation(0, 0, 0));
      model.setCount(1);

      mapAnimationTime.value = 0;
      model.playMotionAt(0, "hit", 0);
      expect(model.getMotionStateAt(0, 0).action).toBe("hit");
      for (let i = 1; i <= 20; i++) {
        mapAnimationTime.value = i * 0.05;
        model.updateAnimations(0.05);
      }
      expect(model.getMotionStateAt(0, mapAnimationTime.value).action).toBe("idle");

      const deathStart = mapAnimationTime.value;
      model.playMotionAt(0, "death", deathStart);
      mapAnimationTime.value = deathStart + 1.5;
      model.updateAnimations(0.05);
      const dead = model.getMotionStateAt(0, mapAnimationTime.value);
      expect(dead.action).toBe("death");
      expect(dead.progress).toBe(1);
      const fallenDisp = evaluateBeastMotionDisplacement("minotaur", [0, 0.9, 0], dead);
      expect(fallenDisp[1]).toBeLessThan(-0.5);

      model.removeInstance(0);
      model.setMatrixAt(0, new Matrix4().makeTranslation(4, 0, 4));
      const reused = model.getMotionStateAt(0, mapAnimationTime.value);
      expect(reused.action).toBe("idle");
      expect(reused.progress).toBe(0);
      expect(reused.active).toBe(true);
    } finally {
      model.dispose();
    }
  });

  it("runs nothing off screen and performs zero buffer uploads while steady", () => {
    const model = new FrontierModel(createBeastGltf(), 4, "troll");
    try {
      model.setMatrixAt(0, new Matrix4().makeTranslation(1, 0, 1));
      model.setMatrixAt(1, new Matrix4().makeTranslation(240, 0, 240));
      model.setCount(2);

      const offscreenContext: AnimationVisibilityContext = {
        cameraPosition: new Vector3(0, 12, 12),
        maxDistance: 40,
        visibilityManager: {
          isPointVisible: (pos: Vector3) => pos.x < 50,
          isBoxVisible: () => true,
        } as unknown as AnimationVisibilityContext["visibilityManager"],
      };

      mapAnimationTime.value = 0.5;
      model.updateAnimations(0.05, offscreenContext);
      expect(model.getMotionStateAt(0, 0.5).active).toBe(true);
      expect(model.getMotionStateAt(1, 0.5).active).toBe(false);
      expect(evaluateBeastMotionDisplacement("troll", [0, 0.7, 0], model.getMotionStateAt(1, 0.5))).toEqual([0, 0, 0]);

      model.playMotionAt(1, "attack", 0.5);
      expect(model.getMotionStateAt(1, 0.5).action).toBe("idle");

      const motionAttr = model.instancedMeshes[0].geometry.getAttribute("beastMotion") as InstancedBufferAttribute;
      const versionAfterTransition = motionAttr.version;
      for (let i = 0; i < 10; i++) {
        mapAnimationTime.value += 0.05;
        model.updateAnimations(0.05, offscreenContext);
      }
      expect(motionAttr.version).toBe(versionAfterTransition);
    } finally {
      model.dispose();
    }
  });
});
