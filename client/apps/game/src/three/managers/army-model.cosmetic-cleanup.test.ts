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

/**
 * Wire up the internal maps so that an entity has a cosmetic assigned
 * and an allocated instance slot.
 */
function setupEntityWithCosmetic(
  subject: ArmyModel,
  entityId: number,
  cosmeticId: string,
  cosmeticData: ReturnType<typeof createModelData>,
  slot: number,
) {
  // Set up the cosmetic model in the map
  (subject as any).cosmeticModels.set(cosmeticId, cosmeticData);

  // Record the entity-to-cosmetic mapping
  (subject as any).entityCosmeticMap.set(entityId, cosmeticId);
  (subject as any).activeCosmeticByEntity.set(entityId, cosmeticId);

  // Set up instance data with the allocated matrixIndex
  (subject as any).instanceData.set(entityId, { matrixIndex: slot });

  // Mark the slot as active on the cosmetic model
  cosmeticData.activeInstances.add(slot);
}

describe("ArmyModel cosmetic cleanup parity (Stage 4)", () => {
  it("clearCosmeticForEntity removes slot from cosmetic activeInstances", () => {
    const subject = new ArmyModel(new Scene());
    const entityId = 10;
    const slot = subject.allocateInstanceSlot(entityId);

    const cosmeticData = createModelData();
    setupEntityWithCosmetic(subject, entityId, "skin-alpha", cosmeticData, slot);

    subject.clearCosmeticForEntity(entityId);

    expect(cosmeticData.activeInstances.has(slot)).toBe(false);
    expect(cosmeticData.activeInstances.size).toBe(0);
    // The entity-cosmetic mapping should also be deleted
    expect((subject as any).entityCosmeticMap.has(entityId)).toBe(false);
  });

  it("rapid remove-then-add does not leak old cosmetic activeInstances", () => {
    const subject = new ArmyModel(new Scene());
    const entityIdA = 20;
    const entityIdB = 21;
    const slot = subject.allocateInstanceSlot(entityIdA);

    const cosmeticDataA = createModelData();
    const cosmeticDataB = createModelData();
    setupEntityWithCosmetic(subject, entityIdA, "skin-old", cosmeticDataA, slot);

    // Remove cosmetic from entity A
    subject.clearCosmeticForEntity(entityIdA);

    // Free the slot from entity A so entity B can reuse it
    (subject as any).matrixIndexOwners.delete(slot);

    // Assign the same slot to a new entity with a different cosmetic
    (subject as any).matrixIndexOwners.set(slot, entityIdB);
    setupEntityWithCosmetic(subject, entityIdB, "skin-new", cosmeticDataB, slot);

    // Old cosmetic should not contain the slot
    expect(cosmeticDataA.activeInstances.has(slot)).toBe(false);
    // New cosmetic should contain the slot
    expect(cosmeticDataB.activeInstances.has(slot)).toBe(true);
  });

  it("cosmetic mesh.count is 0 after all cosmetic entities removed", () => {
    const subject = new ArmyModel(new Scene());
    const cosmeticData = createModelData();
    const entityIds = [30, 31, 32];
    const slots: number[] = [];

    for (const entityId of entityIds) {
      const slot = subject.allocateInstanceSlot(entityId);
      slots.push(slot);
      setupEntityWithCosmetic(subject, entityId, "skin-shared", cosmeticData, slot);
    }

    // Clear all cosmetics
    for (const entityId of entityIds) {
      subject.clearCosmeticForEntity(entityId);
    }

    // Trigger setVisibleSlots to update mesh.count
    subject.setVisibleSlots(slots);

    expect(cosmeticData.activeInstances.size).toBe(0);
    expect(cosmeticData.instancedMeshes[0].count).toBe(0);
  });

  it("clearInstanceSlot fallback also cleans cosmetic activeInstances", () => {
    const subject = new ArmyModel(new Scene());
    const entityId = 40;
    const slot = subject.allocateInstanceSlot(entityId);

    const cosmeticData = createModelData();
    setupEntityWithCosmetic(subject, entityId, "skin-beta", cosmeticData, slot);

    // Delete the matrixIndexOwners entry so clearInstanceSlot takes the fallback path
    (subject as any).matrixIndexOwners.delete(slot);

    (subject as any).clearInstanceSlot(slot);

    expect(cosmeticData.activeInstances.has(slot)).toBe(false);
    expect(cosmeticData.activeInstances.size).toBe(0);
  });
});
