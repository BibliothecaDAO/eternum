import { beforeEach, describe, expect, it, vi } from "vitest";

const testMocks = vi.hoisted(() => ({
  gltfLoadMock: vi.fn(),
  textureLoadAsyncMock: vi.fn(),
  getStandardMaterialMock: vi.fn((material: unknown) => material),
  getBasicMaterialMock: vi.fn((material: unknown) => material),
  releaseMaterialMock: vi.fn(),
}));

const threeMocks = vi.hoisted(() => {
  class MockMaterial {
    dispose() {}
  }

  class MockGeometry {
    dispose = vi.fn();
  }

  class MockMesh {
    geometry = new MockGeometry();
    material: any;
  }

  class MockTexture {
    isTexture = true;
    dispose = vi.fn();
  }

  class MockMeshStandardMaterial extends MockMaterial {}

  class MockMeshBasicMaterial extends MockMaterial {}

  return {
    MockMaterial,
    MockMesh,
    MockGeometry,
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
      releaseMaterial: testMocks.releaseMaterialMock,
    }),
  },
}));

import { clearCosmeticAssetCache, getCosmeticAsset, loadCosmeticAsset } from "../asset-cache";
import { clearRegistry, registerCosmetic } from "../registry";

describe("cosmetic asset cache", () => {
  beforeEach(() => {
    clearCosmeticAssetCache();
    clearRegistry();
    testMocks.gltfLoadMock.mockReset();
    testMocks.textureLoadAsyncMock.mockReset();
    testMocks.getStandardMaterialMock.mockClear();
    testMocks.getBasicMaterialMock.mockClear();
    testMocks.releaseMaterialMock.mockClear();
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

    await loadCosmeticAsset(entry);

    const handle = getCosmeticAsset(entry.id);

    expect(handle?.status).toBe("ready");
    expect(handle?.payload.gltfs).toHaveLength(1);
    expect(handle?.payload.textures).toHaveLength(1);
    expect(testMocks.getStandardMaterialMock).toHaveBeenCalledWith(expect.any(threeMocks.MockMeshStandardMaterial));
  });

  it("releases pooled materials and textures when clearing the cache", async () => {
    const entry = registerCosmetic({
      id: "army:Test:T1:cleanup",
      category: "army-skin",
      appliesTo: ["army:Test:T1"],
      assetPaths: ["units/example.glb", "/images/example.png"],
    });

    const texture = new threeMocks.MockTexture();
    const embeddedTexture = new threeMocks.MockTexture();
    let geometry: InstanceType<typeof threeMocks.MockGeometry> | null = null;
    testMocks.textureLoadAsyncMock.mockResolvedValue(texture);
    testMocks.gltfLoadMock.mockImplementation((_path, onLoad) => {
      const materialA = new threeMocks.MockMeshStandardMaterial();
      const materialB = new threeMocks.MockMeshBasicMaterial();
      (materialA as any).map = embeddedTexture;
      const mesh = new threeMocks.MockMesh();
      mesh.material = [materialA, materialB];
      geometry = mesh.geometry;
      onLoad({ scene: { traverse: (callback: (node: any) => void) => callback(mesh) } });
    });

    await loadCosmeticAsset(entry);

    clearCosmeticAssetCache();

    expect(getCosmeticAsset(entry.id)).toBeUndefined();
    expect(testMocks.releaseMaterialMock).toHaveBeenCalledTimes(2);
    expect(geometry!.dispose).toHaveBeenCalledTimes(1);
    expect(texture.dispose).toHaveBeenCalledTimes(1);
    expect(embeddedTexture.dispose).toHaveBeenCalledTimes(1);
  });

  it("disposes an in-flight asset that completes after renderer teardown", async () => {
    const entry = registerCosmetic({
      id: "army:Test:T1:late",
      category: "army-skin",
      appliesTo: ["army:Test:T1"],
      assetPaths: ["units/late.glb"],
    });
    const mesh = new threeMocks.MockMesh();
    mesh.material = new threeMocks.MockMeshStandardMaterial();
    let finishLoad: ((gltf: unknown) => void) | undefined;
    testMocks.gltfLoadMock.mockImplementation((_path, onLoad) => {
      finishLoad = onLoad;
    });

    const load = loadCosmeticAsset(entry);
    await vi.waitFor(() => expect(finishLoad).toBeDefined());
    clearCosmeticAssetCache();
    finishLoad!({ scene: { traverse: (callback: (node: any) => void) => callback(mesh) } });
    await expect(load).rejects.toThrow("was cleared before completion");

    expect(getCosmeticAsset(entry.id)).toBeUndefined();
    expect(mesh.geometry.dispose).toHaveBeenCalledTimes(1);
    expect(testMocks.releaseMaterialMock).toHaveBeenCalledTimes(1);
  });
});
