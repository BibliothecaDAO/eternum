import { describe, expect, it } from "vitest";
import {
  AnimationClip,
  AnimationMixer,
  BoxGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Vector3,
} from "three";
import { ModelType } from "@/three/types/army";
import { ArmyModel } from "./army-model";

describe("ArmyModel visibility after async model load", () => {
  it("restores draw count when a model finishes loading after visible slots were already resolved", () => {
    const subject = new ArmyModel(new Scene());

    const entityId = 42;
    const slot = subject.allocateInstanceSlot(entityId);
    (subject as any).entityModelMap.set(entityId, ModelType.Knight1);

    subject.updateInstance(entityId, slot, new Vector3(1, 0, 1), new Vector3(1, 1, 1));
    subject.setVisibleSlots([slot]);

    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial();
    const mesh = new InstancedMesh(geometry, material, 1);
    mesh.count = 0;

    const modelData = {
      group: new Group(),
      instancedMeshes: [mesh],
      baseMeshes: [new Mesh(geometry, material)],
      mixer: new AnimationMixer(new Group()),
      animations: {
        idle: new AnimationClip("idle", 1, []),
        moving: new AnimationClip("moving", 1, []),
      },
      animationActions: new Map(),
      activeInstances: new Set<number>(),
      lastAnimationUpdate: 0,
      animationUpdateInterval: 50,
      contactShadowMesh: null,
      contactShadowScale: 1,
    };

    (subject as any).models.set(ModelType.Knight1, modelData);
    (subject as any).reapplyInstancesForModel(ModelType.Knight1, modelData);

    expect(modelData.activeInstances.has(slot)).toBe(true);
    expect(mesh.count).toBe(1);
  });
});
