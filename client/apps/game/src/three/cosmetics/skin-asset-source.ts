import { gltfLoader } from "@/three/utils/utils";
import type { GLTF } from "three-stdlib";
import { loadCosmeticAsset } from "./asset-cache";
import type { CosmeticRegistryEntry } from "./types";

interface ResolveSkinGltfsParams {
  cosmeticId: string;
  assetPaths: string[];
  registryEntry?: CosmeticRegistryEntry;
}

interface ResolvePrimarySkinGltfParams {
  cosmeticId: string;
  assetPath: string;
  registryEntry?: CosmeticRegistryEntry;
}

const loadGltfFromPath = async (assetPath: string): Promise<GLTF> =>
  new Promise((resolve, reject) => {
    gltfLoader.load(assetPath, resolve, undefined, reject);
  });

export const resolveAllSkinGltfs = async ({
  assetPaths,
  registryEntry,
}: ResolveSkinGltfsParams): Promise<GLTF[]> => {
  if (registryEntry) {
    const payload = await loadCosmeticAsset(registryEntry);
    if (payload.gltfs.length > 0) {
      return payload.gltfs;
    }
  }

  return Promise.all(assetPaths.map((assetPath) => loadGltfFromPath(assetPath)));
};

export const resolvePrimarySkinGltf = async ({
  assetPath,
  registryEntry,
}: ResolvePrimarySkinGltfParams): Promise<GLTF> => {
  const gltfs = await resolveAllSkinGltfs({
    cosmeticId: registryEntry?.id ?? assetPath,
    assetPaths: [assetPath],
    registryEntry,
  });

  return gltfs[0];
};
