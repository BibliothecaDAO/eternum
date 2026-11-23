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
import { describe, expect, it } from "vitest";

import type { AnimationVisibilityContext } from "../types/animation";
import { BEAST_MOTION_PROFILES, BeastMotionController, evaluateBeastMotionDisplacement } from "./beast-motion";
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

describe("Pure-maths beast motion module", () => {
  it.each(ALL_SPECIES)("moves %s visibly at rest while keeping grounded feet planted", (species) => {
    const profile = BEAST_MOTION_PROFILES[species];
    const controller = new BeastMotionController(species, 2);
    controller.setPlacementAt(0, new Matrix4().makeTranslation(0, 0, 0));

    const startState = controller.getStateAt(0);
    const probe: [number, number, number] = [0.28, profile.height * 0.68, -0.22];
    const startDisp = evaluateBeastMotionDisplacement(species, probe, startState);

    let maxDelta = 0;
    for (let frame = 0; frame < 45; frame++) {
      controller.update(1 / 30, 1);
      const next = evaluateBeastMotionDisplacement(species, probe, controller.getStateAt(0));
      const dist = Math.hypot(next[0] - startDisp[0], next[1] - startDisp[1], next[2] - startDisp[2]);
      if (dist > maxDelta) maxDelta = dist;
    }

    expect(maxDelta).toBeGreaterThan(0.01);
    if (profile.archetype !== "floating" && profile.hoverAmp === 0) {
      const footDisp = evaluateBeastMotionDisplacement(species, [0, 0, 0], controller.getStateAt(0));
      expect(Math.hypot(...footDisp)).toBeLessThan(1e-5);
    }
  });

  it("plays an attack once with forward lunge displacement and returns cleanly to idle", () => {
    const model = new FrontierModel(createBeastGltf(), 4, "wyvern");
    try {
      model.setMatrixAt(0, new Matrix4().makeTranslation(2, 0, 3));
      model.setCount(1);
      model.playAttackAt(0);
      expect(model.getMotionStateAt(0).action).toBe("attack");

      let maxForwardLunge = -Infinity;
      let sawAttack = false;
      for (let step = 0; step < 30; step++) {
        model.updateAnimations(0.05);
        const state = model.getMotionStateAt(0);
        if (state.action === "attack") {
          sawAttack = true;
          const disp = evaluateBeastMotionDisplacement("wyvern", [0, 0.7, 0.15], state);
          if (disp[2] > maxForwardLunge) maxForwardLunge = disp[2];
        }
      }

      expect(sawAttack).toBe(true);
      expect(maxForwardLunge).toBeGreaterThan(0.15);
      expect(model.getMotionStateAt(0).action).toBe("idle");
      expect(model.getMotionStateAt(0).progress).toBe(0);

      model.updateAnimations(0.25);
      expect(model.getMotionStateAt(0).action).toBe("idle");
    } finally {
      model.dispose();
    }
  });

  it("runs hit flinch once and settles death to rest", () => {
    const model = new FrontierModel(createBeastGltf(), 2, "minotaur");
    try {
      model.setMatrixAt(0, new Matrix4().makeTranslation(0, 0, 0));
      model.setCount(1);

      model.playHitAt(0);
      expect(model.getMotionStateAt(0).action).toBe("hit");
      for (let i = 0; i < 20; i++) model.updateAnimations(0.05);
      expect(model.getMotionStateAt(0).action).toBe("idle");

      model.playDeathAt(0);
      for (let i = 0; i < 30; i++) model.updateAnimations(0.05);
      const dead = model.getMotionStateAt(0);
      expect(dead.action).toBe("death");
      expect(dead.progress).toBe(1);
      const fallenDisp = evaluateBeastMotionDisplacement("minotaur", [0, 0.9, 0], dead);
      expect(fallenDisp[1]).toBeLessThan(-0.5);
    } finally {
      model.dispose();
    }
  });

  it("runs nothing off screen when instances are outside the frustum or beyond max distance", () => {
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

      const nearBefore = model.getMotionStateAt(0);
      const farBefore = model.getMotionStateAt(1);
      model.playAttackAt(1);

      for (let i = 0; i < 10; i++) {
        model.updateAnimations(0.05, offscreenContext);
      }

      const nearAfter = model.getMotionStateAt(0);
      const farAfter = model.getMotionStateAt(1);
      expect(nearAfter.clock).toBeGreaterThan(nearBefore.clock + 0.4);
      expect(nearAfter.active).toBe(true);
      expect(farAfter.clock).toBe(farBefore.clock);
      expect(farAfter.progress).toBe(0);
      expect(farAfter.active).toBe(false);

      const allHiddenContext: AnimationVisibilityContext = {
        cameraPosition: new Vector3(0, 12, 12),
        maxDistance: 40,
        visibilityManager: {
          isPointVisible: () => false,
          isBoxVisible: () => false,
        } as unknown as AnimationVisibilityContext["visibilityManager"],
      };
      model.updateAnimations(0.05, allHiddenContext);
      const frozenNear = model.getMotionStateAt(0).clock;
      const motionAttr = model.instancedMeshes[0].geometry.getAttribute("beastMotion") as InstancedBufferAttribute;
      const versionBefore = motionAttr.version;
      model.updateAnimations(0.1, allHiddenContext);
      expect(model.getMotionStateAt(0).clock).toBe(frozenNear);
      expect(motionAttr.version).toBe(versionBefore);
    } finally {
      model.dispose();
    }
  });
});
