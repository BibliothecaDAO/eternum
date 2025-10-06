import { beforeEach, describe, expect, it, vi } from "vitest";

const gltfLoadMock = vi.fn();
const textureLoadAsyncMock = vi.fn();
const getStandardMaterialMock = vi.fn((material) => material);
const getBasicMaterialMock = vi.fn((material) => material);

vi.mock("@/three/utils/utils", () => ({
  gltfLoader: {
    load: (...args: any[]) => gltfLoadMock(...args),
  },
}));

class MockMaterial {
  dispose() {}
}

class MockMesh {
  material: any;
}

class MockTexture {}

class MockMeshStandardMaterial extends MockMaterial {}

class MockMeshBasicMaterial extends MockMaterial {}

vi.mock("three", () => ({
  TextureLoader: class {
    loadAsync(path: string) {
      return textureLoadAsyncMock(path);
    }
  },
  Texture: MockTexture,
  Mesh: MockMesh,
  MeshBasicMaterial: MockMeshBasicMaterial,
  MeshStandardMaterial: MockMeshStandardMaterial,
  Material: MockMaterial,
}));

vi.mock("../../utils/material-pool", () => ({
  MaterialPool: {
    getInstance: () => ({
      getStandardMaterial: getStandardMaterialMock,
      getBasicMaterial: getBasicMaterialMock,
    }),
  },
}));

import { clearCosmeticAssetCache, getCosmeticAsset, preloadAllCosmeticAssets } from "../asset-cache";
import { clearRegistry, registerCosmetic } from "../registry";

describe("cosmetic asset cache", () => {
  beforeEach(() => {
    clearCosmeticAssetCache();
    clearRegistry();
    gltfLoadMock.mockReset();
    textureLoadAsyncMock.mockReset();
    getStandardMaterialMock.mockClear();
    getBasicMaterialMock.mockClear();
  });

  it("loads gltf and texture assets and records the handle", async () => {
    const entry = registerCosmetic({
      id: "army:Test:T1:base",
      category: "army-skin",
      appliesTo: ["army:Test:T1"],
      assetPaths: ["units/example.glb", "/images/example.png"],
    });

    textureLoadAsyncMock.mockResolvedValue(new MockTexture());
    gltfLoadMock.mockImplementation((_path, onLoad) => {
      const material = new MockMeshStandardMaterial();
      const mesh = new MockMesh();
      mesh.material = material;
      onLoad({ scene: { traverse: (callback: (node: any) => void) => callback(mesh) } });
    });

    await preloadAllCosmeticAssets();

    const handle = getCosmeticAsset(entry.id);

    expect(handle?.status).toBe("ready");
    expect(handle?.payload.gltfs).toHaveLength(1);
    expect(handle?.payload.textures).toHaveLength(1);
    expect(getStandardMaterialMock).toHaveBeenCalledWith(expect.any(MockMeshStandardMaterial));
  });
});
