import { gltfLoader } from "@/three/utils/utils";
import { TextureLoader } from "three";
import { CosmeticRegistryEntry } from "./types";
import { getCosmeticRegistry } from "./registry";

const textureLoader = new TextureLoader();

type AssetHandle = {
  entry: CosmeticRegistryEntry;
  assets: any[]; // GLTF or texture references; refined in later phases.
  status: "pending" | "ready" | "failed";
  error?: Error;
};

const assetCache = new Map<string, AssetHandle>();

/**
 * Kick off async loading for every cosmetic entry. Actual processing is filled in during later phases.
 */
export async function preloadAllCosmeticAssets() {
  const registry = getCosmeticRegistry();
  const tasks = registry.map(async (entry) => {
    const handle: AssetHandle = { entry, assets: [], status: "pending" };
    assetCache.set(entry.id, handle);

    try {
      const results = await Promise.all(
        entry.assetPaths.map(async (path) => {
          if (path.endsWith(".glb") || path.endsWith(".gltf")) {
            return await new Promise((resolve, reject) => {
              gltfLoader.load(path, resolve, undefined, reject);
            });
          }
          return await textureLoader.loadAsync(path);
        }),
      );
      handle.assets = results;
      handle.status = "ready";
    } catch (error) {
      handle.status = "failed";
      handle.error = error as Error;
    }
  });

  await Promise.all(tasks);
}

export function ensureCosmeticAsset(entry: CosmeticRegistryEntry): AssetHandle | undefined {
  const cached = assetCache.get(entry.id);
  if (cached) {
    return cached;
  }

  const handle: AssetHandle = { entry, assets: [], status: "pending" };
  assetCache.set(entry.id, handle);
  return handle;
}

export function getCosmeticAsset(id: string): AssetHandle | undefined {
  return assetCache.get(id);
}

export function clearCosmeticAssetCache() {
  assetCache.clear();
}
