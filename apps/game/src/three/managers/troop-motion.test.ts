import { BiomeType } from "@bibliothecadao/types";
import { Matrix4, Scene, Vector3 } from "three";
import { float } from "three/tsl";
import { describe, expect, it, vi } from "vitest";

import { mapAnimationTime } from "../effects/endgame/state";
import { ModelType, type ModelData } from "../types/army";
import type { AnimationVisibilityContext } from "../types/animation";
import { ArmyModel } from "./army-model";
import {
  createTroopMotionController,
  createTroopMotionNode,
  evaluateTroopMotionDisplacement,
  resolveAnimatedTroopKind,
  type AnimatedTroopKind,
} from "./troop-motion";

vi.mock("@/ui/config", async (importOriginal) => ({ ...(await importOriginal<object>()), FELT_CENTER: () => 0 }));

describe("Pure-maths Scout and Crossbow motion module", () => {
  it("maps Paladin1 to scout and Crossbowman1 to crossbow", () => {
    expect(resolveAnimatedTroopKind(ModelType.Paladin1)).toBe("scout");
    expect(resolveAnimatedTroopKind(ModelType.Crossbowman1)).toBe("crossbow");
    expect(resolveAnimatedTroopKind(ModelType.Knight1)).toBeUndefined();
  });

  it.each(["scout", "crossbow"] as const)(
    "moves %s at rest, strides during march, resumes march after one-shots and pauses off screen",
    (kind: AnimatedTroopKind) => {
      const walkingSlots = new Set<number>();
      const controller = createTroopMotionController(kind, 4, (slot) => (walkingSlots.has(slot) ? "march" : "idle"));
      controller.setPlacementAt(0, new Matrix4().makeTranslation(1, 0, 1));
      controller.setPlacementAt(1, new Matrix4().makeTranslation(300, 0, 300));
      expect(createTroopMotionNode(kind, float(mapAnimationTime))).toBeDefined();

      const probe: [number, number, number] = kind === "scout" ? [0, 0.72, 0.35] : [0.08, 0.65, 0.16];
      const startDisp = evaluateTroopMotionDisplacement(kind, probe, controller.getStateAt(0, 0));
      let maxIdleDelta = 0;
      const versionBeforeIdle = controller.attribute.version;
      for (let i = 1; i <= 30; i++) {
        const now = i / 30;
        controller.update(now, [0]);
        const next = evaluateTroopMotionDisplacement(kind, probe, controller.getStateAt(0, now));
        maxIdleDelta = Math.max(
          maxIdleDelta,
          Math.hypot(next[0] - startDisp[0], next[1] - startDisp[1], next[2] - startDisp[2]),
        );
      }
      expect(maxIdleDelta).toBeGreaterThan(0.01);
      expect(controller.attribute.version).toBe(versionBeforeIdle);

      walkingSlots.add(0);
      controller.syncLoopActionAt(0);
      expect(controller.getStateAt(0, 1).action).toBe("march");
      const legProbe: [number, number, number] = kind === "scout" ? [0, 0.25, 0.25] : [0.09, 0.25, 0];
      let maxLegSwing = 0;
      for (let i = 1; i <= 24; i++) {
        const now = 1 + i / 30;
        controller.update(now, [0]);
        const legDisp = evaluateTroopMotionDisplacement(kind, legProbe, controller.getStateAt(0, now));
        maxLegSwing = Math.max(maxLegSwing, Math.abs(legDisp[2]));
      }
      expect(maxLegSwing).toBeGreaterThan(0.05);

      controller.playActionAt(0, "attack", 2);
      expect(controller.getStateAt(0, 2).action).toBe("attack");
      for (let i = 1; i <= 30; i++) controller.update(2 + i * 0.04, [0]);
      expect(controller.getStateAt(0, 3.2).action).toBe("march");
      expect(controller.getStateAt(0, 3.2).progress).toBe(0);

      walkingSlots.delete(0);
      controller.syncLoopActionAt(0);
      expect(controller.getStateAt(0, 3.2).action).toBe("idle");
      controller.playActionAt(0, "attack", 3.2);
      walkingSlots.add(0);
      controller.syncLoopActionAt(0);
      expect(controller.getStateAt(0, 3.3).action).toBe("attack");
      controller.update(4.1, [0]);
      expect(controller.getStateAt(0, 4.1).action).toBe("march");

      walkingSlots.delete(0);
      controller.syncLoopActionAt(0);
      controller.playActionAt(0, "attack", 4.1);
      controller.update(5, [0]);
      expect(controller.getStateAt(0, 5).action).toBe("idle");

      controller.playActionAt(0, "death", 5.1);
      controller.update(6.6, [0]);
      expect(controller.getStateAt(0, 6.6).action).toBe("death");
      expect(controller.getStateAt(0, 6.6).progress).toBe(1);

      controller.resetSlot(0);
      expect(controller.getStateAt(0, 6.6).action).toBe("idle");
      expect(controller.getStateAt(0, 6.6).progress).toBe(0);
      expect(controller.getStateAt(0, 6.6).active).toBe(true);
      walkingSlots.add(0);
      controller.syncLoopActionAt(0);
      expect(controller.getStateAt(0, 6.6).action).toBe("march");

      const offscreenContext: AnimationVisibilityContext = {
        cameraPosition: new Vector3(0, 10, 10),
        maxDistance: 40,
        visibilityManager: {
          isPointVisible: (pos: Vector3) => pos.x < 50,
          isBoxVisible: () => true,
        } as unknown as AnimationVisibilityContext["visibilityManager"],
      };
      controller.update(6.7, [0, 1], offscreenContext);
      expect(controller.getStateAt(1, 6.7).active).toBe(false);
      expect(evaluateTroopMotionDisplacement(kind, probe, controller.getStateAt(1, 6.7))).toEqual([0, 0, 0]);
      controller.playActionAt(1, "attack", 6.8);
      expect(controller.getStateAt(1, 6.8).action).toBe("idle");
    },
  );

  it("reads walking state from ArmyModel.animationStates on late load, model switch, purge and reuse", () => {
    const model = new ArmyModel(new Scene(), () => BiomeType.Grassland);
    const internals = model as unknown as {
      animationStates: Float32Array;
      models: Map<ModelType, Partial<ModelData>>;
      activeBaseModelByEntity: Map<number, ModelType>;
      reapplyInstancesForModel(modelType: ModelType, modelData: Partial<ModelData>): void;
    };

    const firstSlot = model.allocateInstanceSlot(11);
    model.assignModelToEntity(11, ModelType.Paladin1);
    model.updateInstance(11, firstSlot, new Vector3(1, 0, 2), new Vector3(1, 1, 1));
    model.setAnimationState(firstSlot, true);

    const scoutMotion = createTroopMotionController("scout", 8, (slot) =>
      internals.animationStates[slot] === 1 ? "march" : "idle",
    );
    const scoutModelData: Partial<ModelData> = {
      instancedMeshes: [],
      activeInstances: new Set(),
      dirtySlots: { min: Infinity, max: -1 },
      troopMotion: scoutMotion,
    };
    internals.models.set(ModelType.Paladin1, scoutModelData);
    internals.reapplyInstancesForModel(ModelType.Paladin1, scoutModelData);
    expect(scoutMotion.getStateAt(firstSlot, mapAnimationTime.value).action).toBe("march");

    const crossbowMotion = createTroopMotionController("crossbow", 8, (slot) =>
      internals.animationStates[slot] === 1 ? "march" : "idle",
    );
    internals.models.set(ModelType.Crossbowman1, {
      instancedMeshes: [],
      activeInstances: new Set(),
      dirtySlots: { min: Infinity, max: -1 },
      troopMotion: crossbowMotion,
    });
    model.assignModelToEntity(11, ModelType.Crossbowman1);
    model.updateInstance(11, firstSlot, new Vector3(1, 0, 2), new Vector3(1, 1, 1));
    expect(crossbowMotion.getStateAt(firstSlot, mapAnimationTime.value).action).toBe("march");

    model.assignModelToEntity(11, ModelType.Paladin1);
    model.updateInstance(11, firstSlot, new Vector3(1, 0, 2), new Vector3(1, 1, 1));
    model.playTroopAction(firstSlot, "death");
    expect(scoutMotion.getStateAt(firstSlot, mapAnimationTime.value).action).toBe("death");

    model.purgeDrawnSlot(firstSlot);
    expect(scoutMotion.getStateAt(firstSlot, mapAnimationTime.value).action).toBe("idle");

    const reusedAfterPurge = model.allocateInstanceSlot(22);
    expect(reusedAfterPurge).toBe(firstSlot);
    internals.activeBaseModelByEntity.set(22, ModelType.Paladin1);
    model.setAnimationState(reusedAfterPurge, true);
    expect(scoutMotion.getStateAt(reusedAfterPurge, mapAnimationTime.value).action).toBe("march");

    model.playTroopAction(reusedAfterPurge, "death");
    expect(scoutMotion.getStateAt(reusedAfterPurge, mapAnimationTime.value).action).toBe("death");
    model.freeInstanceSlot(22, reusedAfterPurge);

    const reusedAfterFree = model.allocateInstanceSlot(33);
    expect(reusedAfterFree).toBe(firstSlot);
    internals.activeBaseModelByEntity.set(33, ModelType.Paladin1);
    expect(scoutMotion.getStateAt(reusedAfterFree, mapAnimationTime.value).action).toBe("idle");
    model.setAnimationState(reusedAfterFree, true);
    expect(scoutMotion.getStateAt(reusedAfterFree, mapAnimationTime.value).action).toBe("march");
  });
});
