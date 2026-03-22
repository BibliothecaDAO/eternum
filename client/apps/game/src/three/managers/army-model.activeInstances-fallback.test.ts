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
  Quaternion,
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
  GRAPHICS_SETTING: "HIGH",
  GraphicsSettings: {
    HIGH: "HIGH",
    LOW: "LOW",
    MID: "MID",
  },
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
    (subject as any).ensureModelCapacity(modelData, slot + 1);

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
