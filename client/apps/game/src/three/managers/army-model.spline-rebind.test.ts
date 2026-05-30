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

const ZERO_SCALE_ELEMENTS = new Matrix4().makeScale(0, 0, 0).elements;

function getMatrix(mesh: InstancedMesh, slot: number): Matrix4 {
  const matrix = new Matrix4();
  mesh.getMatrixAt(slot, matrix);
  return matrix;
}

function expectZeroScaleMatrix(mesh: InstancedMesh, slot: number) {
  expect(getMatrix(mesh, slot).elements).toEqual(ZERO_SCALE_ELEMENTS);
}

function expectNonZeroMatrix(mesh: InstancedMesh, slot: number) {
  expect(getMatrix(mesh, slot).elements).not.toEqual(ZERO_SCALE_ELEMENTS);
}

describe("ArmyModel spline rebind on slot compaction", () => {
  // Regression for ghosting units: a moving army whose instance slot is
  // reassigned (slot compaction when a lower-indexed army leaves view) must
  // keep rendering its 3D model at the NEW slot. Before the single-source-of-
  // truth fix, the spline kept writing to the stale slot, leaving a ghost at
  // the old slot while the new slot froze (labels, keyed by entityId, stayed
  // correct — matching the reported symptom).
  it("renders the moving army at its new slot and leaves no ghost at the old slot", () => {
    const subject = new ArmyModel(new Scene());
    const { mesh, modelData } = createLoadedModelData();
    (subject as any).models.set(ModelType.Knight1, modelData);

    const stationaryId = 101;
    const movingId = 202;

    const stationarySlot = subject.allocateInstanceSlot(stationaryId); // 0
    const movingSlot = subject.allocateInstanceSlot(movingId); // 1

    subject.assignModelToEntity(stationaryId, ModelType.Knight1);
    subject.assignModelToEntity(movingId, ModelType.Knight1);

    subject.updateInstance(stationaryId, stationarySlot, new Vector3(0, 0, 0), new Vector3(1, 1, 1));
    subject.updateInstance(movingId, movingSlot, new Vector3(5, 0, 5), new Vector3(1, 1, 1));

    subject.startMovement(
      movingId,
      [new Vector3(5, 0, 5), new Vector3(6, 0, 6), new Vector3(7, 0, 7)],
      movingSlot,
      TroopType.Knight as never,
      TroopTier.T1 as never,
    );

    // One frame with the moving army still at slot 1.
    subject.updateMovements(0.016);

    // Slot compaction: the stationary army leaves view, freeing slot 0, and the
    // moving army is compacted down from slot 1 into slot 0.
    subject.freeInstanceSlot(stationaryId, stationarySlot);
    subject.moveInstanceSlot(movingId, stationarySlot); // 1 -> 0

    expect((subject as any).instanceData.get(movingId).matrixIndex).toBe(stationarySlot);

    // The next animation frame must drive the NEW slot, not the old one.
    subject.updateMovements(0.016);

    expectNonZeroMatrix(mesh, stationarySlot); // moving army present at new slot 0
    expectZeroScaleMatrix(mesh, movingSlot); // no ghost left behind at old slot 1
  });
});
