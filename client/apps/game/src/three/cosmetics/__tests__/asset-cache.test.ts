import { beforeEach, describe, expect, it, vi } from "vitest";

const testMocks = vi.hoisted(() => ({
  gltfLoadMock: vi.fn(),
  textureLoadAsyncMock: vi.fn(),
  getStandardMaterialMock: vi.fn((material: unknown) => material),
  getBasicMaterialMock: vi.fn((material: unknown) => material),
}));

const threeMocks = vi.hoisted(() => {
  class MockMaterial {
    dispose() {}
  }

  class MockMesh {
    material: any;
  }

  class MockTexture {}

  class MockMeshStandardMaterial extends MockMaterial {}

  class MockMeshBasicMaterial extends MockMaterial {}

  return {
    MockMaterial,
    MockMesh,
    MockTexture,
    MockMeshStandardMaterial,
    MockMeshBasicMaterial,
  };
});

vi.mock("@/three/utils/utils", () => ({
  gltfLoader: {
    load: (...args: any[]) => testMocks.gltfLoadMock(...args),
  },
}));

vi.mock("@bibliothecadao/types", () => ({
  TroopType: {
    Knight: "Knight",
    Crossbowman: "Crossbowman",
    Paladin: "Paladin",
  },
  TroopTier: {
    T1: "T1",
    T2: "T2",
    T3: "T3",
  },
  StructureType: {
    1: "Realm",
    Realm: 1,
  },
}));

vi.mock("@/three/constants/scene-constants", () => ({
  getStructureModelPaths: () => ({
    1: ["structures/realm.glb"],
  }),
}));

vi.mock("three", () => ({
  TextureLoader: class {
    loadAsync(path: string) {
      return testMocks.textureLoadAsyncMock(path);
    }
  },
  Texture: threeMocks.MockTexture,
  Mesh: threeMocks.MockMesh,
  MeshBasicMaterial: threeMocks.MockMeshBasicMaterial,
  MeshStandardMaterial: threeMocks.MockMeshStandardMaterial,
  Material: threeMocks.MockMaterial,
}));

vi.mock("../../utils/material-pool", () => ({
  MaterialPool: {
    getInstance: () => ({
      getStandardMaterial: testMocks.getStandardMaterialMock,
      getBasicMaterial: testMocks.getBasicMaterialMock,
    }),
  },
}));

import { clearCosmeticAssetCache, getCosmeticAsset, preloadAllCosmeticAssets } from "../asset-cache";
import { clearRegistry, registerCosmetic } from "../registry";

describe("cosmetic asset cache", () => {
  beforeEach(() => {
    clearCosmeticAssetCache();
    clearRegistry();
    testMocks.gltfLoadMock.mockReset();
    testMocks.textureLoadAsyncMock.mockReset();
    testMocks.getStandardMaterialMock.mockClear();
    testMocks.getBasicMaterialMock.mockClear();
  });

  it("loads gltf and texture assets and records the handle", async () => {
    const entry = registerCosmetic({
      id: "army:Test:T1:base",
      category: "army-skin",
      appliesTo: ["army:Test:T1"],
      assetPaths: ["units/example.glb", "/images/example.png"],
    });

    testMocks.textureLoadAsyncMock.mockResolvedValue(new threeMocks.MockTexture());
    testMocks.gltfLoadMock.mockImplementation((_path, onLoad) => {
      const material = new threeMocks.MockMeshStandardMaterial();
      const mesh = new threeMocks.MockMesh();
      mesh.material = material;
      onLoad({ scene: { traverse: (callback: (node: any) => void) => callback(mesh) } });
    });

    await preloadAllCosmeticAssets();

    const handle = getCosmeticAsset(entry.id);

    expect(handle?.status).toBe("ready");
    expect(handle?.payload.gltfs).toHaveLength(1);
    expect(handle?.payload.textures).toHaveLength(1);
    expect(testMocks.getStandardMaterialMock).toHaveBeenCalledWith(expect.any(threeMocks.MockMeshStandardMaterial));
  });
});
