import { describe, expect, it, vi } from "vitest";
import {
  AnimationClip,
  AnimationMixer,
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Vector3,
} from "three";
import { ModelType } from "@/three/types/army";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { ArmyModel } from "./army-model";

vi.hoisted(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: vi.fn(() => null),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    },
  });
});

vi.mock("@/ui/config", () => ({
  FELT_CENTER: () => 0,
  IS_FLAT_MODE: false,
}));

vi.mock("@/three/scenes/hexagon-scene", () => ({
  CameraView: {
    Close: "Close",
    Medium: "Medium",
    Far: "Far",
  },
}));

vi.mock("../../../env", () => ({
  env: {
    VITE_PUBLIC_ENABLE_MEMORY_MONITORING: false,
  },
}));

vi.mock("@/utils/agent", () => ({
  getCharacterModel: vi.fn(() => null),
}));

vi.mock("@/three/utils/utils", () => ({
  gltfLoader: {
    load: vi.fn(),
  },
}));

vi.mock("../utils", () => ({
  getHexForWorldPosition: vi.fn(() => ({ col: 0, row: 0 })),
}));

vi.mock("../utils/contact-shadow", () => ({
  getContactShadowResources: vi.fn(() => ({
    geometry: new BoxGeometry(1, 1, 1),
    material: new MeshBasicMaterial(),
  })),
}));

vi.mock("../utils/material-pool", () => ({
  MaterialPool: {
    getInstance: vi.fn(() => ({
      get: vi.fn(),
      release: vi.fn(),
    })),
  },
}));

vi.mock("../utils/memory-monitor", () => ({
  MemoryMonitor: class MockMemoryMonitor {},
}));

vi.mock("./army-model-materials", () => ({
  createPooledInstancedMaterial: vi.fn(() => new MeshBasicMaterial()),
  releasePooledInstancedMaterial: vi.fn(),
}));

vi.mock("./army-model-debug-hooks", () => ({
  installArmyModelDebugHooks: vi.fn(),
}));

vi.mock("../cosmetics/skin-asset-source", () => ({
  resolvePrimarySkinGltf: vi.fn(),
}));

vi.mock("@bibliothecadao/eternum", () => {
  const scalar = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );

  return new Proxy(
    {
      Biome: {
        getBiome: vi.fn(() => "NONE"),
      },
      FELT_CENTER: 0,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : scalar),
      has: () => true,
    },
  );
});

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
      ResourcesIds: { StaminaRelic1: 1 },
      TroopTier: { T1: "T1", T2: "T2", T3: "T3" },
      TroopType: { Knight: "Knight", Crossbowman: "Crossbowman", Paladin: "Paladin" },
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : enumProxy),
      has: () => true,
    },
  );
});

function createLoadedModelData() {
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial();
  const mesh = new InstancedMesh(geometry, material, 8);

  return {
    mesh,
    modelData: {
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
      dirtySlots: { min: Number.POSITIVE_INFINITY, max: -1 },
      lastAnimationUpdate: 0,
      animationUpdateInterval: 50,
      contactShadowMesh: null,
      contactShadowScale: 1,
    },
  };
}

const ZERO_SCALE_ELEMENTS = new Matrix4().makeScale(0, 0, 0).elements;

function getMatrix(mesh: InstancedMesh, slot: number): Matrix4 {
  const matrix = new Matrix4();
  mesh.getMatrixAt(slot, matrix);
  return matrix;
}

function expectNonZeroMatrix(mesh: InstancedMesh, slot: number) {
  expect(getMatrix(mesh, slot).elements).not.toEqual(ZERO_SCALE_ELEMENTS);
}

describe("ArmyModel slot single-source-of-truth on movement start", () => {
  // The reported ghost: a frozen duplicate at a unit's OLD position after it
  // moves. Root cause — the move-start path seeds the model's source-of-truth
  // slot (instanceData.matrixIndex) from a stale caller-supplied slot. When
  // that slot is stale, startMovement relocates
  // the entity onto the stale slot and leaves the real slot drawn forever
  // (a ghost), until a full chunk reconcile repacks slots.
  //
  // startMovement must IGNORE a stale caller-supplied slot when the entity
  // already has a live instanceData slot, and keep driving that live slot.
  it("ignores a stale caller-supplied slot and keeps driving the entity's live slot", () => {
    const subject = new ArmyModel(new Scene());
    const { mesh, modelData } = createLoadedModelData();
    (subject as any).models.set(ModelType.Knight1, modelData);

    const entityId = 777;
    const liveSlot = subject.allocateInstanceSlot(entityId); // 0
    subject.assignModelToEntity(entityId, ModelType.Knight1);
    subject.updateInstance(entityId, liveSlot, new Vector3(2, 0, 2), new Vector3(1, 1, 1));
    expect((subject as any).instanceData.get(entityId).matrixIndex).toBe(liveSlot);

    // Simulate the army-manager passing a STALE mirror slot (entity is really
    // at `liveSlot`, but the cached mirror thinks it is at `staleSlot`).
    const staleSlot = 3;
    expect(staleSlot).not.toBe(liveSlot);

    subject.startMovement(
      entityId,
      [new Vector3(2, 0, 2), new Vector3(3, 0, 3), new Vector3(4, 0, 4)],
      staleSlot,
      TroopType.Knight as never,
      TroopTier.T1 as never,
    );

    // The source of truth must be preserved, not overwritten with the mirror.
    expect((subject as any).instanceData.get(entityId).matrixIndex).toBe(liveSlot);

    subject.updateMovements(0.016);

    // The unit is driven at its real slot, and was never relocated onto the
    // stale slot (the buggy path would assign matrixIndexOwners[staleSlot] to
    // this entity and freeze a ghost at the real slot).
    expect(subject.getEntitySlot(entityId)).toBe(liveSlot);
    expectNonZeroMatrix(mesh, liveSlot);
    expect((subject as any).matrixIndexOwners.get(staleSlot)).not.toBe(entityId);
  });

  // A brand-new entity (no instanceData yet) must still adopt the supplied slot
  // — the caller value is a fallback, only ignored when a live slot exists.
  it("adopts the supplied slot when the entity has no live slot yet", () => {
    const subject = new ArmyModel(new Scene());
    const { modelData } = createLoadedModelData();
    (subject as any).models.set(ModelType.Knight1, modelData);

    const entityId = 778;
    const slot = subject.allocateInstanceSlot(entityId);
    subject.assignModelToEntity(entityId, ModelType.Knight1);
    // Note: no updateInstance — instanceData has no entry until movement starts.
    expect((subject as any).instanceData.get(entityId)).toBeUndefined();

    subject.startMovement(
      entityId,
      [new Vector3(0, 0, 0), new Vector3(1, 0, 1)],
      slot,
      TroopType.Knight as never,
      TroopTier.T1 as never,
    );

    expect((subject as any).instanceData.get(entityId).matrixIndex).toBe(slot);
  });
});

describe("ArmyModel freeInstanceSlot clears the live slot unconditionally", () => {
  // Defensive invariant: freeInstanceSlot must never leave an entity's
  // instanceData.matrixIndex pointing at a slot that is back in the free pool —
  // a later allocateInstanceSlot would hand that (possibly reused) slot back,
  // sharing it between two entities (a ghost).
  it("clears instanceData.matrixIndex even when the freed slot is already pooled", () => {
    const subject = new ArmyModel(new Scene());
    const { modelData } = createLoadedModelData();
    (subject as any).models.set(ModelType.Knight1, modelData);

    const entityId = 555;
    const slot = subject.allocateInstanceSlot(entityId); // 0
    subject.assignModelToEntity(entityId, ModelType.Knight1);
    subject.updateInstance(entityId, slot, new Vector3(1, 0, 1), new Vector3(1, 1, 1));

    // Force the "already pooled" early-return condition while the entity's
    // source of truth still points at the slot.
    (subject as any).freeSlotSet.add(slot);
    (subject as any).freeSlots.push(slot);

    subject.freeInstanceSlot(entityId, slot);

    expect((subject as any).instanceData.get(entityId)?.matrixIndex).toBeUndefined();
  });
});

describe("ArmyModel moveInstanceSlot reports the resulting slot", () => {
  // Slot compaction in the manager must mirror exactly the slot the MODEL
  // actually took — never a planned slot the model declined to move to.
  // moveInstanceSlot therefore returns the entity's resulting live slot.
  it("returns the new slot on a real move, the current slot on a no-op, and undefined for an unknown entity", () => {
    const subject = new ArmyModel(new Scene());
    const { modelData } = createLoadedModelData();
    (subject as any).models.set(ModelType.Knight1, modelData);

    const entityId = 888;
    const slot = subject.allocateInstanceSlot(entityId); // 0
    subject.assignModelToEntity(entityId, ModelType.Knight1);
    subject.updateInstance(entityId, slot, new Vector3(0, 0, 0), new Vector3(1, 1, 1));

    // Real move 0 -> 2.
    expect(subject.moveInstanceSlot(entityId, 2)).toBe(2);
    expect((subject as any).instanceData.get(entityId).matrixIndex).toBe(2);

    // No-op: already at slot 2 — must report the live slot, not undefined.
    expect(subject.moveInstanceSlot(entityId, 2)).toBe(2);

    // Unknown entity: nothing to mirror.
    expect(subject.moveInstanceSlot(999999, 1)).toBeUndefined();
  });
});

describe("ArmyModel getEntitySlot exposes the live source-of-truth slot", () => {
  it("returns the entity's current instanceData.matrixIndex, or undefined when unslotted", () => {
    const subject = new ArmyModel(new Scene());
    const { modelData } = createLoadedModelData();
    (subject as any).models.set(ModelType.Knight1, modelData);

    const entityId = 999;
    expect(subject.getEntitySlot(entityId)).toBeUndefined();

    const slot = subject.allocateInstanceSlot(entityId);
    subject.assignModelToEntity(entityId, ModelType.Knight1);
    subject.updateInstance(entityId, slot, new Vector3(0, 0, 0), new Vector3(1, 1, 1));

    expect(subject.getEntitySlot(entityId)).toBe(slot);
  });
});
