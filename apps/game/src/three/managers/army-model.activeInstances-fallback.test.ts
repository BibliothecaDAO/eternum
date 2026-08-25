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
  FELT_CENTER: 0,
  IS_FLAT_MODE: false,
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

vi.mock("@bibliothecadao/eternum", () => {
  const scalar = new Proxy({}, { get: (_, key) => key });
  return new Proxy(
    {
      Biome: { getBiome: vi.fn(() => "NONE") },
      FELT_CENTER: 0,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : scalar),
      has: () => true,
    },
  );
});

vi.mock("@bibliothecadao/types", () => {
  const enumProxy = new Proxy({}, { get: (_, key) => key });
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

function createModelData() {
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial();
  const mesh = new InstancedMesh(geometry, material, 64);
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
    animationUpdateInterval: 50,
    contactShadowMesh: null,
    contactShadowScale: 1,
  };
}

type ArmyModelTestAccess = {
  models: Map<ModelType, ReturnType<typeof createModelData>>;
  entityModelMap: Map<number, ModelType>;
  activeBaseModelByEntity: Map<number, ModelType | null>;
};

const accessArmyModel = (subject: ArmyModel) => subject as unknown as ArmyModelTestAccess;

describe("ArmyModel activeInstances fallback fix (Stage 0)", () => {
  it("clearInstanceSlot removes index from activeInstances when owner is known", () => {
    const subject = new ArmyModel(new Scene());
    const entityId = 100;
    const slot = subject.allocateInstanceSlot(entityId);

    const modelData = createModelData();
    (subject as any).models.set(ModelType.Knight1, modelData);
    (subject as any).entityModelMap.set(entityId, ModelType.Knight1);
    (subject as any).activeBaseModelByEntity.set(entityId, ModelType.Knight1);

    // Simulate the slot being active
    modelData.activeInstances.add(slot);

    // Clear the slot via the known-owner path
    (subject as any).clearInstanceSlot(slot);

    expect(modelData.activeInstances.size).toBe(0);
    expect(modelData.activeInstances.has(slot)).toBe(false);
  });

  it("clearInstanceSlot removes stale model memberships when owner is known", () => {
    const subject = new ArmyModel(new Scene());
    const entityId = 101;
    const slot = subject.allocateInstanceSlot(entityId);

    const activeModelData = createModelData();
    const staleModelData = createModelData();
    (subject as any).models.set(ModelType.Knight1, activeModelData);
    (subject as any).models.set(ModelType.Crossbowman1, staleModelData);
    (subject as any).entityModelMap.set(entityId, ModelType.Knight1);
    (subject as any).activeBaseModelByEntity.set(entityId, ModelType.Knight1);

    activeModelData.activeInstances.add(slot);
    staleModelData.activeInstances.add(slot);

    const oldPosition = new Matrix4().makeTranslation(5, 0, 5);
    activeModelData.instancedMeshes[0].setMatrixAt(slot, oldPosition);
    staleModelData.instancedMeshes[0].setMatrixAt(slot, oldPosition);

    (subject as any).clearInstanceSlot(slot);

    expect(activeModelData.activeInstances.has(slot)).toBe(false);
    expect(staleModelData.activeInstances.has(slot)).toBe(false);
    expectSlotToBeZeroed(activeModelData.instancedMeshes[0], slot);
    expectSlotToBeZeroed(staleModelData.instancedMeshes[0], slot);
  });

  it("updateInstance prunes inactive renderable memberships for the live slot", () => {
    const subject = new ArmyModel(new Scene());
    const modelAccess = accessArmyModel(subject);
    const entityId = 102;
    const slot = subject.allocateInstanceSlot(entityId);

    const activeModelData = createModelData();
    const staleModelData = createModelData();
    modelAccess.models.set(ModelType.Knight1, activeModelData);
    modelAccess.models.set(ModelType.Crossbowman1, staleModelData);
    modelAccess.entityModelMap.set(entityId, ModelType.Knight1);
    modelAccess.activeBaseModelByEntity.set(entityId, ModelType.Knight1);

    activeModelData.activeInstances.add(slot);
    staleModelData.activeInstances.add(slot);

    const stalePosition = new Matrix4().makeTranslation(9, 0, 9);
    staleModelData.instancedMeshes[0].setMatrixAt(slot, stalePosition);

    subject.updateInstance(entityId, slot, new Vector3(1, 0, 1), new Vector3(1, 1, 1));

    expect(activeModelData.activeInstances.has(slot)).toBe(true);
    expect(staleModelData.activeInstances.has(slot)).toBe(false);
    expectSlotToBeZeroed(staleModelData.instancedMeshes[0], slot);
  });

  it("clearInstanceSlot removes index from activeInstances in fallback path", () => {
    const subject = new ArmyModel(new Scene());
    const entityId = 200;
    const slot = subject.allocateInstanceSlot(entityId);

    const modelDataA = createModelData();
    const modelDataB = createModelData();
    (subject as any).models.set(ModelType.Knight1, modelDataA);
    (subject as any).models.set(ModelType.Crossbowman1, modelDataB);

    const cosmeticData = createModelData();
    (subject as any).cosmeticModels.set("cosmeticX", cosmeticData);

    // Add the slot to activeInstances across models
    modelDataA.activeInstances.add(slot);
    modelDataB.activeInstances.add(slot);
    cosmeticData.activeInstances.add(slot);

    // Remove owner so the fallback path is taken
    (subject as any).matrixIndexOwners.delete(slot);

    (subject as any).clearInstanceSlot(slot);

    expect(modelDataA.activeInstances.size).toBe(0);
    expect(modelDataB.activeInstances.size).toBe(0);
    expect(cosmeticData.activeInstances.size).toBe(0);
  });

  it("getModelDrawCount returns 0 after all slots cleared via fallback", () => {
    const subject = new ArmyModel(new Scene());
    const modelData = createModelData();
    (subject as any).models.set(ModelType.Knight1, modelData);

    const slots: number[] = [];
    for (let i = 0; i < 3; i++) {
      const entityId = 300 + i;
      const slot = subject.allocateInstanceSlot(entityId);
      slots.push(slot);
      modelData.activeInstances.add(slot);
    }

    // Remove all owners so fallback path is taken
    for (const slot of slots) {
      (subject as any).matrixIndexOwners.delete(slot);
      (subject as any).clearInstanceSlot(slot);
    }

    const drawCount = (subject as any).getModelDrawCount(modelData);
    expect(drawCount).toBe(0);
  });

  it("fallback clearInstanceSlot zeroes matrix AND removes from activeInstances", () => {
    const subject = new ArmyModel(new Scene());
    const entityId = 400;
    const slot = subject.allocateInstanceSlot(entityId);

    const modelData = createModelData();
    (subject as any).models.set(ModelType.Knight1, modelData);
    modelData.activeInstances.add(slot);

    // Ensure capacity so setMatrixAt works

    // Set a non-zero matrix to verify it gets zeroed
    const nonZeroMatrix = new Matrix4().makeTranslation(5, 5, 5);
    modelData.instancedMeshes[0].setMatrixAt(slot, nonZeroMatrix);

    // Remove owner to trigger fallback
    (subject as any).matrixIndexOwners.delete(slot);
    (subject as any).clearInstanceSlot(slot);

    // Verify activeInstances cleaned
    expect(modelData.activeInstances.has(slot)).toBe(false);

    // Verify matrix is zeroed (makeScale(0,0,0) produces a matrix with 0 on the diagonal)
    const resultMatrix = new Matrix4();
    modelData.instancedMeshes[0].getMatrixAt(slot, resultMatrix);
    const elements = resultMatrix.elements;
    // A makeScale(0,0,0) matrix has 0 at [0],[5],[10] (diagonal scale entries)
    expect(elements[0]).toBe(0);
    expect(elements[5]).toBe(0);
    expect(elements[10]).toBe(0);
  });

  it("setVisibleSlots sets mesh.count to 0 after fallback clear removes all active", () => {
    const subject = new ArmyModel(new Scene());
    const modelData = createModelData();
    (subject as any).models.set(ModelType.Knight1, modelData);

    const slots: number[] = [];
    for (let i = 0; i < 2; i++) {
      const entityId = 500 + i;
      const slot = subject.allocateInstanceSlot(entityId);
      slots.push(slot);
      (subject as any).entityModelMap.set(entityId, ModelType.Knight1);
      modelData.activeInstances.add(slot);
    }

    // Clear both via fallback
    for (const slot of slots) {
      (subject as any).matrixIndexOwners.delete(slot);
      (subject as any).clearInstanceSlot(slot);
    }

    // Now call setVisibleSlots with the same slots (simulating the visibility system)
    subject.setVisibleSlots(slots);

    expect(modelData.instancedMeshes[0].count).toBe(0);
  });
});

describe("ArmyModel draw-count stays correct on cached model switch (1A)", () => {
  it("bumps the new model's mesh.count when updateInstance switches an entity to an already-loaded model", () => {
    const subject = new ArmyModel(new Scene());
    const entityId = 700;
    const slot = subject.allocateInstanceSlot(entityId);

    const landModel = createModelData();
    const boatModel = createModelData();
    (subject as any).models.set(ModelType.Knight1, landModel);
    (subject as any).models.set(ModelType.Boat, boatModel);

    // Entity is currently rendered on the land model at `slot`.
    (subject as any).entityModelMap.set(entityId, ModelType.Knight1);
    (subject as any).activeBaseModelByEntity.set(entityId, ModelType.Knight1);
    landModel.activeInstances.add(slot);
    landModel.instancedMeshes[0].count = slot + 1;

    // Boat is loaded but never drawn (count 0) — this is the bug precondition:
    // a cached model whose draw count was never bumped to include this slot.
    expect(boatModel.instancedMeshes[0].count).toBe(0);

    // Simulate the mid-move biome switch onto the cached Boat model.
    (subject as any).entityModelMap.set(entityId, ModelType.Boat);
    subject.updateInstance(entityId, slot, new Vector3(1, 0, 1), new Vector3(1, 1, 1));

    // The slot moved onto the Boat model...
    expect(boatModel.activeInstances.has(slot)).toBe(true);
    // ...and the Boat model's draw count now covers it (regression: stayed 0,
    // so the model was invisible until the next map-wide setVisibleSlots).
    expect(boatModel.instancedMeshes[0].count).toBeGreaterThanOrEqual(slot + 1);
  });
});

describe("ArmyModel render-integrity helpers + leaked-slot purge", () => {
  it("collectDrawnSlotOwners returns only slots within mesh.count, paired with their owner", () => {
    const subject = new ArmyModel(new Scene());
    const drawn = 800;
    const undrawn = 801;
    const drawnSlot = subject.allocateInstanceSlot(drawn);
    const undrawnSlot = subject.allocateInstanceSlot(undrawn);

    const model = createModelData();
    (subject as any).models.set(ModelType.Knight1, model);
    model.activeInstances.add(drawnSlot);
    model.activeInstances.add(undrawnSlot);
    // Only the first slot is within the draw count; the second is active but not drawn.
    model.instancedMeshes[0].count = drawnSlot + 1;

    const owners = subject.collectDrawnSlotOwners();
    expect(owners).toContainEqual({ slot: drawnSlot, owner: drawn });
    expect(owners.some((o) => o.slot === undrawnSlot)).toBe(false);
  });

  it("isEntityDrawn reflects whether the entity's slot is active and within count", () => {
    const subject = new ArmyModel(new Scene());
    const entityId = 810;
    const slot = subject.allocateInstanceSlot(entityId);

    const model = createModelData();
    (subject as any).models.set(ModelType.Knight1, model);
    (subject as any).entityModelMap.set(entityId, ModelType.Knight1);
    (subject as any).activeBaseModelByEntity.set(entityId, ModelType.Knight1);
    subject.updateInstance(entityId, slot, new Vector3(1, 0, 1), new Vector3(1, 1, 1));

    expect(subject.isEntityDrawn(entityId)).toBe(true);

    // Shrink the draw count below the slot — no longer drawn.
    model.instancedMeshes[0].count = slot;
    expect(subject.isEntityDrawn(entityId)).toBe(false);
  });

  it("releaseEntity purges a leaked slot when matrixIndex was detached but the slot still draws (death ghost)", () => {
    const subject = new ArmyModel(new Scene());
    const entityId = 820;
    const slot = subject.allocateInstanceSlot(entityId);

    const model = createModelData();
    (subject as any).models.set(ModelType.Knight1, model);
    (subject as any).entityModelMap.set(entityId, ModelType.Knight1);
    (subject as any).activeBaseModelByEntity.set(entityId, ModelType.Knight1);
    subject.updateInstance(entityId, slot, new Vector3(2, 0, 2), new Vector3(1, 1, 1));
    expect(model.activeInstances.has(slot)).toBe(true);

    // Simulate the desync: the entity's own matrixIndex was cleared, but the
    // slot is still owned (matrixIndexOwners) and still drawn. The normal
    // freeInstanceSlot path keys off matrixIndex and would no-op here.
    (subject as any).instanceData.get(entityId).matrixIndex = undefined;

    subject.releaseEntity(entityId);

    expect(model.activeInstances.has(slot)).toBe(false);
    expect((subject as any).matrixIndexOwners.has(slot)).toBe(false);
    expectSlotToBeZeroed(model.instancedMeshes[0], slot);
  });
});

function expectSlotToBeZeroed(mesh: InstancedMesh, slot: number) {
  const resultMatrix = new Matrix4();
  mesh.getMatrixAt(slot, resultMatrix);
  const elements = resultMatrix.elements;
  expect(elements[0]).toBe(0);
  expect(elements[5]).toBe(0);
  expect(elements[10]).toBe(0);
}
