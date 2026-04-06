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
  FELT_CENTER: 0,
  GRAPHICS_SETTING: "HIGH",
  GraphicsSettings: {
    HIGH: "HIGH",
    LOW: "LOW",
    MID: "MID",
  },
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
  const mesh = new InstancedMesh(geometry, material, 4);

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
      lastAnimationUpdate: 0,
      animationUpdateInterval: 50,
      contactShadowMesh: null,
      contactShadowScale: 1,
    },
  };
}

function expectZeroScaleMatrix(mesh: InstancedMesh, slot: number) {
  const matrix = new Matrix4();
  mesh.getMatrixAt(slot, matrix);
  expect(matrix.elements).toEqual(new Matrix4().makeScale(0, 0, 0).elements);
}

describe("ArmyModel hidden slot persistence", () => {
  it("keeps a hidden moving slot hidden across updateMovements", () => {
    const subject = new ArmyModel(new Scene());
    const { mesh, modelData } = createLoadedModelData();
    const entityId = 42;
    const slot = subject.allocateInstanceSlot(entityId);

    (subject as any).models.set(ModelType.Knight1, modelData);
    subject.assignModelToEntity(entityId, ModelType.Knight1);
    subject.updateInstance(entityId, slot, new Vector3(1, 0, 1), new Vector3(1, 1, 1));

    subject.hideInstanceSlot(slot);
    subject.startMovement(
      entityId,
      [new Vector3(1, 0, 1), new Vector3(2, 0, 2)],
      slot,
      TroopType.Knight as never,
      TroopTier.T1 as never,
    );

    subject.updateMovements(0.016);

    expectZeroScaleMatrix(mesh, slot);
  });

  it("preserves hidden state when a hidden slot is compacted to a new slot", () => {
    const subject = new ArmyModel(new Scene());
    const { mesh, modelData } = createLoadedModelData();
    const entityId = 77;
    const slot = subject.allocateInstanceSlot(entityId);
    const spareEntityId = 999;
    const spareSlot = subject.allocateInstanceSlot(spareEntityId);

    (subject as any).models.set(ModelType.Knight1, modelData);
    subject.assignModelToEntity(entityId, ModelType.Knight1);
    subject.updateInstance(entityId, slot, new Vector3(3, 0, 3), new Vector3(1, 1, 1));

    subject.freeInstanceSlot(spareEntityId, spareSlot);
    subject.hideInstanceSlot(slot);
    subject.moveInstanceSlot(entityId, spareSlot);

    expectZeroScaleMatrix(mesh, spareSlot);
  });
});
