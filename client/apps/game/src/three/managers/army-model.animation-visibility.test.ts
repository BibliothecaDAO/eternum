import { describe, expect, it, vi } from "vitest";
import {
  AnimationClip,
  BoxGeometry,
  Group,
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

function createAnimatedModelData() {
  const baseMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  baseMesh.morphTargetInfluences = [0.75];

  return {
    activeInstances: new Set<number>([0]),
    animationActions: new Map(),
    animationUpdateInterval: 0,
    animations: {
      idle: new AnimationClip("idle", 1, []),
      moving: new AnimationClip("moving", 1, []),
    },
    baseMeshes: [baseMesh],
    contactShadowMesh: null,
    contactShadowScale: 1,
    currentScales: new Map(),
    group: new Group(),
    instancedMeshes: [
      {
        animated: true,
        count: 1,
        morphTexture: {
          image: {
            data: new Float32Array(1),
            width: 1,
          },
          needsUpdate: false,
        },
      },
    ],
    lastAnimationUpdate: 0,
    mixer: {
      clipAction: vi.fn(() => ({
        play: vi.fn(),
        setEffectiveTimeScale: vi.fn(),
      })),
      setTime: vi.fn(),
    },
    targetScales: new Map(),
  };
}

describe("ArmyModel animation visibility", () => {
  it("skips animation work when the active instances are offscreen", () => {
    vi.spyOn(performance, "now").mockReturnValue(33.32);

    const subject = new ArmyModel(new Scene());
    const modelData = createAnimatedModelData();

    (subject as any).models.set(ModelType.Knight1, modelData);
    (subject as any).matrixIndexOwners.set(0, 7);
    (subject as any).instanceData.set(7, {
      entityId: 7,
      isMoving: true,
      matrixIndex: 0,
      position: new Vector3(12, 0, 8),
      scale: new Vector3(1, 1, 1),
    });
    subject.setAnimationState(0, true);

    subject.updateAnimations(16, {
      cameraPosition: new Vector3(0, 0, 0),
      maxDistance: 100,
      visibilityManager: {
        isPointVisible: vi.fn(() => false),
      } as never,
    });

    expect(modelData.mixer.setTime).not.toHaveBeenCalled();
    expect(modelData.instancedMeshes[0].morphTexture.needsUpdate).toBe(false);
  });

  it("keeps animating visible instances", () => {
    vi.spyOn(performance, "now").mockReturnValue(33.32);

    const subject = new ArmyModel(new Scene());
    const modelData = createAnimatedModelData();

    (subject as any).models.set(ModelType.Knight1, modelData);
    (subject as any).matrixIndexOwners.set(0, 8);
    (subject as any).instanceData.set(8, {
      entityId: 8,
      isMoving: true,
      matrixIndex: 0,
      position: new Vector3(4, 0, 3),
      scale: new Vector3(1, 1, 1),
    });
    subject.setAnimationState(0, true);

    subject.updateAnimations(16, {
      cameraPosition: new Vector3(0, 0, 0),
      maxDistance: 100,
      visibilityManager: {
        isPointVisible: vi.fn(() => true),
      } as never,
    });

    expect(modelData.mixer.setTime).toHaveBeenCalled();
    expect(modelData.instancedMeshes[0].morphTexture.needsUpdate).toBe(true);
  });
});
