import { beforeEach, describe, expect, it, vi } from "vitest";

const loadCosmeticAssetMock = vi.fn();
const gltfLoaderLoadMock = vi.fn();

vi.mock("../asset-cache", () => ({
  loadCosmeticAsset: (...args: unknown[]) => loadCosmeticAssetMock(...args),
}));

vi.mock("@/three/utils/utils", () => ({
  gltfLoader: {
    load: (...args: unknown[]) => gltfLoaderLoadMock(...args),
  },
}));

import { resolveAllSkinGltfs, resolvePrimarySkinGltf } from "../skin-asset-source";

describe("skin asset source", () => {
  beforeEach(() => {
    loadCosmeticAssetMock.mockReset();
    gltfLoaderLoadMock.mockReset();
  });

  it("uses the shared cosmetic asset cache for army skin resolution", async () => {
    const cachedGltf = { scene: { name: "cached-army" } };
    loadCosmeticAssetMock.mockResolvedValue({
      gltfs: [cachedGltf],
      textures: [],
      materials: [],
    });

    const gltf = await resolvePrimarySkinGltf({
      cosmeticId: "army:Knight:T3:legacy",
      assetPath: "models/cosmetics/legacy.glb",
      registryEntry: {
        id: "army:Knight:T3:legacy",
        category: "army-skin",
        appliesTo: ["army:Knight:T3"],
        assetPaths: ["models/cosmetics/legacy.glb"],
      },
    });

    expect(gltf).toBe(cachedGltf);
    expect(loadCosmeticAssetMock).toHaveBeenCalledTimes(1);
    expect(gltfLoaderLoadMock).not.toHaveBeenCalled();
  });

  it("uses the shared cosmetic asset cache for multi-asset structure skins", async () => {
    const cachedGltfs = [{ scene: { name: "a" } }, { scene: { name: "b" } }];
    loadCosmeticAssetMock.mockResolvedValue({
      gltfs: cachedGltfs,
      textures: [],
      materials: [],
    });

    const gltfs = await resolveAllSkinGltfs({
      cosmeticId: "structure:realm:castle-s1-lvl2",
      assetPaths: ["models/a.glb", "models/b.glb"],
      registryEntry: {
        id: "structure:realm:castle-s1-lvl2",
        category: "structure-skin",
        appliesTo: ["structure:Realm:2"],
        assetPaths: ["models/a.glb", "models/b.glb"],
      },
    });

    expect(gltfs).toEqual(cachedGltfs);
    expect(loadCosmeticAssetMock).toHaveBeenCalledTimes(1);
    expect(gltfLoaderLoadMock).not.toHaveBeenCalled();
  });

  it("falls back to the loader only when no registry-backed cache entry exists", async () => {
    const loadedGltf = { scene: { name: "fallback" } };
    gltfLoaderLoadMock.mockImplementation((_path, onLoad) => onLoad(loadedGltf));

    const gltf = await resolvePrimarySkinGltf({
      cosmeticId: "custom:debug",
      assetPath: "models/custom.glb",
    });

    expect(gltf).toBe(loadedGltf);
    expect(loadCosmeticAssetMock).not.toHaveBeenCalled();
    expect(gltfLoaderLoadMock).toHaveBeenCalledTimes(1);
  });
});
