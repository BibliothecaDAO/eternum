import { Matrix4, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { ModelType } from "../types/army";
import type { AnimationVisibilityContext } from "../types/animation";
import {
  TroopMotionController,
  evaluateTroopMotionDisplacement,
  resolveAnimatedTroopKind,
  type AnimatedTroopKind,
} from "./troop-motion";

describe("Pure-maths Scout and Crossbow motion module", () => {
  it("maps Paladin1 to scout and Crossbowman1 to crossbow", () => {
    expect(resolveAnimatedTroopKind(ModelType.Paladin1)).toBe("scout");
    expect(resolveAnimatedTroopKind(ModelType.Crossbowman1)).toBe("crossbow");
    expect(resolveAnimatedTroopKind(ModelType.Knight1)).toBeUndefined();
  });

  it.each(["scout", "crossbow"] as const)(
    "moves %s at rest, strides during march, plays attack once and pauses off screen",
    (kind: AnimatedTroopKind) => {
      const controller = new TroopMotionController(kind, 4);
      controller.setPlacementAt(0, new Matrix4().makeTranslation(1, 0, 1));
      controller.setPlacementAt(1, new Matrix4().makeTranslation(300, 0, 300));

      const probe: [number, number, number] = kind === "scout" ? [0, 0.72, 0.35] : [0.08, 0.65, 0.16];
      const startDisp = evaluateTroopMotionDisplacement(kind, probe, controller.getStateAt(0));
      let maxIdleDelta = 0;
      for (let i = 0; i < 30; i++) {
        controller.update(1 / 30, [0]);
        const next = evaluateTroopMotionDisplacement(kind, probe, controller.getStateAt(0));
        maxIdleDelta = Math.max(
          maxIdleDelta,
          Math.hypot(next[0] - startDisp[0], next[1] - startDisp[1], next[2] - startDisp[2]),
        );
      }
      expect(maxIdleDelta).toBeGreaterThan(0.01);

      controller.setLocomotionAt(0, true);
      expect(controller.getStateAt(0).action).toBe("march");
      const legProbe: [number, number, number] = kind === "scout" ? [0, 0.25, 0.25] : [0.09, 0.25, 0];
      let maxLegSwing = 0;
      for (let i = 0; i < 24; i++) {
        controller.update(1 / 30, [0]);
        const legDisp = evaluateTroopMotionDisplacement(kind, legProbe, controller.getStateAt(0));
        maxLegSwing = Math.max(maxLegSwing, Math.abs(legDisp[2]));
      }
      expect(maxLegSwing).toBeGreaterThan(0.05);

      controller.playActionAt(0, "attack");
      expect(controller.getStateAt(0).action).toBe("attack");
      for (let i = 0; i < 30; i++) controller.update(0.04, [0]);
      expect(controller.getStateAt(0).action).toBe("idle");
      expect(controller.getStateAt(0).progress).toBe(0);

      controller.playActionAt(0, "death");
      for (let i = 0; i < 35; i++) controller.update(0.04, [0]);
      expect(controller.getStateAt(0).action).toBe("death");
      expect(controller.getStateAt(0).progress).toBe(1);

      const offscreenContext: AnimationVisibilityContext = {
        cameraPosition: new Vector3(0, 10, 10),
        maxDistance: 40,
        visibilityManager: {
          isPointVisible: (pos: Vector3) => pos.x < 50,
          isBoxVisible: () => true,
        } as unknown as AnimationVisibilityContext["visibilityManager"],
      };
      const farClockBefore = controller.getStateAt(1).clock;
      controller.playActionAt(1, "attack");
      controller.update(0.1, [0, 1], offscreenContext);
      expect(controller.getStateAt(1).clock).toBe(farClockBefore);
      expect(controller.getStateAt(1).progress).toBe(0);
      expect(controller.getStateAt(1).active).toBe(false);
    },
  );
});
