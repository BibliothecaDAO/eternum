import { describe, expect, it, vi } from "vitest";
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

vi.mock("@/utils/agent", () => ({
  getCharacterModel: vi.fn(() => undefined),
}));

vi.mock("@/ui/config", () => ({
  FELT_CENTER: () => 0,
  GRAPHICS_SETTING: "high",
  IS_FLAT_MODE: false,
  GraphicsSettings: {
    LOW: "low",
  },
}));

vi.mock("@/three/scenes/hexagon-scene", () => ({
  CameraView: {
    Close: 1,
    Medium: 2,
    Far: 3,
  },
}));

vi.mock("@/three/utils/utils", () => ({
  gltfLoader: { load: vi.fn() },
}));

vi.mock("../utils", () => ({
  getHexForWorldPosition: vi.fn(() => ({ col: 0, row: 0 })),
}));

vi.mock("@bibliothecadao/types", () => {
  const enumProxy = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );

  return new Proxy(
    {
      BiomeType: enumProxy,
      TroopTier: enumProxy,
      TroopType: enumProxy,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : enumProxy),
      has: () => true,
    },
  );
});

vi.mock("@bibliothecadao/eternum", () => {
  const enumProxy = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );

  return new Proxy(
    {
      Biome: enumProxy,
      StructureProgress: enumProxy,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : enumProxy),
      has: () => true,
    },
  );
});

describe("ArmyModel visibility after async model load", () => {
  it("restores draw count when a model finishes loading after visible slots were already resolved", () => {
    const subject = new ArmyModel(new Scene());

    const entityId = 42;
    const slot = subject.allocateInstanceSlot(entityId);
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
    subject.assignModelToEntity(entityId, ModelType.Knight1);

    subject.updateInstance(entityId, slot, new Vector3(1, 0, 1), new Vector3(1, 1, 1));
    subject.setVisibleSlots([slot]);
    (subject as any).reapplyInstancesForModel(ModelType.Knight1, modelData);

    expect(modelData.activeInstances.has(slot)).toBe(true);
    expect(mesh.count).toBe(1);
  });
});
