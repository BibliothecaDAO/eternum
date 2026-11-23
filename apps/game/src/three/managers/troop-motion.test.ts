import { BiomeType } from "@bibliothecadao/types";
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Scene, Texture, Vector3 } from "three";
import { float } from "three/tsl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mapAnimationTime } from "../effects/endgame/state";
import type { FrostedStandardNodeMaterial } from "../effects/game-map-material-library";
import { ModelType } from "../types/army";
import type { AnimationVisibilityContext } from "../types/animation";
import { gltfLoader } from "../utils/utils";
import { ArmyModel } from "./army-model";
import {
  createTroopMotionController,
  createTroopMotionNode,
  evaluateTroopMotionDisplacement,
  resolveAnimatedTroopKind,
  type AnimatedTroopKind,
} from "./troop-motion";

vi.mock("@/ui/config", async (importOriginal) => ({ ...(await importOriginal<object>()), FELT_CENTER: () => 0 }));

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("renders placed Scout and Crossbow armies in rest pose with no vertex motion shader", async () => {
    vi.spyOn(gltfLoader, "load").mockImplementation((_url, onLoad) => {
      const material = new MeshStandardMaterial({ map: new Texture(), roughness: 0.9, metalness: 0 });
      material.userData.tripoMaterial = true;
      material.userData.ownershipCloth = true;
      const root = new Group();
      root.add(new Mesh(new BoxGeometry(0.5, 1, 0.5), material));
      onLoad?.({ scene: root, animations: [] } as never);
    });
    const scene = new Scene();
    const model = new ArmyModel(scene, () => BiomeType.Grassland);
    try {
      await model.preloadModels(new Set([ModelType.Paladin1, ModelType.Crossbowman1]));
      const scoutSlot = model.allocateInstanceSlot(11);
      const crossbowSlot = model.allocateInstanceSlot(22);
      model.assignModelToEntity(11, ModelType.Paladin1);
      model.assignModelToEntity(22, ModelType.Crossbowman1);
      model.updateInstance(11, scoutSlot, new Vector3(1, 0, 2), new Vector3(1, 1, 1));
      model.updateInstance(22, crossbowSlot, new Vector3(3, 0, 4), new Vector3(1, 1, 1));
      model.setVisibleSlots([scoutSlot, crossbowSlot]);

      const drawn: InstancedMesh[] = [];
      scene.traverse((object) => {
        if (object instanceof InstancedMesh && object.count > 0 && object.userData.gameEndFrost) {
          drawn.push(object);
        }
      });
      expect(drawn).toHaveLength(2);
      for (const mesh of drawn) {
        expect(mesh.geometry.getAttribute("troopMotion")).toBeUndefined();
        expect((mesh.material as FrostedStandardNodeMaterial).positionNode).toBeNull();
      }
    } finally {
      model.dispose();
    }
  });
});
