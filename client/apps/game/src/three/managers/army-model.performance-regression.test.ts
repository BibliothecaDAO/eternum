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

class InstrumentedMap<K, V> extends Map<K, V> {
  public forEachCalls = 0;

  public override forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: unknown): void {
    return super.forEach((value, key, map) => {
      this.forEachCalls++;
      callbackfn.call(thisArg, value, key, map);
    });
  }
}

function createModelData() {
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial();
  const mesh = new InstancedMesh(geometry, material, 8);
  mesh.count = 0;

  return {
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
    animationUpdateInterval: 0,
    contactShadowMesh: null,
    contactShadowScale: 1,
  };
}

function createInstance(entityId: number, matrixIndex: number) {
  return {
    entityId,
    matrixIndex,
    position: new Vector3(entityId, 0, entityId),
    scale: new Vector3(1, 1, 1),
    isMoving: false,
  };
}

describe("ArmyModel performance regressions", () => {
  it("replays base model loads only for entities registered to that model type", () => {
    const subject = new ArmyModel(new Scene());
    const instrumentedInstanceData = new InstrumentedMap<number, ReturnType<typeof createInstance>>([
      [1, createInstance(1, 0)],
      [2, createInstance(2, 1)],
      [3, createInstance(3, 2)],
    ]);
    const knightModel = createModelData();
    const boatModel = createModelData();
    const updateInstance = vi.fn();

    (subject as any).models.set(ModelType.Knight1, knightModel);
    (subject as any).models.set(ModelType.Boat, boatModel);
    (subject as any).instanceData = instrumentedInstanceData;
    (subject as any).updateInstance = updateInstance;
    (subject as any).syncModelDrawCount = vi.fn();

    subject.assignModelToEntity(1, ModelType.Knight1);
    subject.assignModelToEntity(2, ModelType.Knight1);
    subject.assignModelToEntity(3, ModelType.Boat);

    (subject as any).reapplyInstancesForModel(ModelType.Boat, boatModel);

    expect(instrumentedInstanceData.forEachCalls).toBe(0);
    expect(updateInstance).toHaveBeenCalledTimes(1);
    expect(updateInstance).toHaveBeenCalledWith(3, 2, expect.any(Vector3), expect.any(Vector3), undefined, undefined);
  });

  it("replays cosmetic model loads only for entities registered to that cosmetic id", () => {
    const subject = new ArmyModel(new Scene());
    const instrumentedInstanceData = new InstrumentedMap<number, ReturnType<typeof createInstance>>([
      [1, createInstance(1, 0)],
      [2, createInstance(2, 1)],
      [3, createInstance(3, 2)],
    ]);
    const cosmeticA = createModelData();
    const cosmeticB = createModelData();
    const updateInstance = vi.fn();

    (subject as any).cosmeticModels.set("skin-a", cosmeticA);
    (subject as any).cosmeticModels.set("skin-b", cosmeticB);
    (subject as any).instanceData = instrumentedInstanceData;
    (subject as any).updateInstance = updateInstance;
    (subject as any).syncModelDrawCount = vi.fn();

    subject.assignCosmeticToEntity(1, "skin-a", "/skin-a.glb");
    subject.assignCosmeticToEntity(2, "skin-a", "/skin-a.glb");
    subject.assignCosmeticToEntity(3, "skin-b", "/skin-b.glb");

    (subject as any).reapplyInstancesForCosmeticModel("skin-b", cosmeticB);

    expect(instrumentedInstanceData.forEachCalls).toBe(0);
    expect(updateInstance).toHaveBeenCalledTimes(1);
    expect(updateInstance).toHaveBeenCalledWith(3, 2, expect.any(Vector3), expect.any(Vector3), undefined, undefined);
  });

  it("compacts a live entity into a freed lower slot so draw counts track live occupancy", () => {
    const subject = new ArmyModel(new Scene());
    const modelData = createModelData();

    (subject as any).models.set(ModelType.Knight1, modelData);

    subject.assignModelToEntity(1, ModelType.Knight1);
    subject.assignModelToEntity(2, ModelType.Knight1);
    subject.assignModelToEntity(3, ModelType.Knight1);

    const slotA = subject.allocateInstanceSlot(1);
    const slotB = subject.allocateInstanceSlot(2);
    const slotC = subject.allocateInstanceSlot(3);

    subject.updateInstance(1, slotA, new Vector3(0, 0, 0), new Vector3(1, 1, 1));
    subject.updateInstance(2, slotB, new Vector3(1, 0, 0), new Vector3(1, 1, 1));
    subject.updateInstance(3, slotC, new Vector3(2, 0, 0), new Vector3(1, 1, 1));
    subject.setVisibleSlots([slotA, slotB, slotC]);

    subject.freeInstanceSlot(2, slotB);
    (subject as any).moveEntityToSlot(3, slotB);
    subject.setVisibleSlots([slotA, slotB]);

    expect((subject as any).instanceData.get(3).matrixIndex).toBe(slotB);
    expect(modelData.activeInstances.has(slotB)).toBe(true);
    expect(modelData.activeInstances.has(slotC)).toBe(false);
    expect(modelData.instancedMeshes[0].count).toBe(2);
  });

  it("skips animation updates for offscreen model groups when visibility context culls them", () => {
    const subject = new ArmyModel(new Scene());
    const modelData = createModelData();
    const updateModelAnimations = vi.spyOn(subject as any, "updateModelAnimations");

    modelData.instancedMeshes[0].count = 1;
    (subject as any).models.set(ModelType.Knight1, modelData);

    subject.updateAnimations(16, {
      visibilityManager: {
        isSphereVisible: vi.fn(() => false),
      } as any,
      cameraPosition: new Vector3(0, 0, 0),
      maxDistance: 100,
    });

    expect(updateModelAnimations).not.toHaveBeenCalled();
  });

  it("flushes instance uploads and bounds only for dirty model subsets", () => {
    const subject = new ArmyModel(new Scene());
    const knightModel = createModelData();
    const boatModel = createModelData();
    const knightMeshBounds = vi.spyOn(knightModel.instancedMeshes[0], "computeBoundingSphere");
    const boatMeshBounds = vi.spyOn(boatModel.instancedMeshes[0], "computeBoundingSphere");

    (subject as any).models.set(ModelType.Knight1, knightModel);
    (subject as any).models.set(ModelType.Boat, boatModel);

    subject.assignModelToEntity(1, ModelType.Knight1);
    subject.assignModelToEntity(2, ModelType.Boat);
    subject.updateInstance(1, 0, new Vector3(0, 0, 0), new Vector3(1, 1, 1));
    subject.updateInstance(2, 1, new Vector3(1, 0, 0), new Vector3(1, 1, 1));

    (subject as any).flushDirtyModelUpdates();
    knightMeshBounds.mockClear();
    boatMeshBounds.mockClear();

    subject.updateInstance(1, 0, new Vector3(2, 0, 0), new Vector3(1, 1, 1));

    (subject as any).flushDirtyModelUpdates();

    expect(knightMeshBounds).toHaveBeenCalled();
    expect(boatMeshBounds).not.toHaveBeenCalled();
  });
});
