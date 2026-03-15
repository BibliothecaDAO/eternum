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
