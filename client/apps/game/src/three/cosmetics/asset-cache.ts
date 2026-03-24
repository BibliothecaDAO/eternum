import { gltfLoader } from "@/three/utils/utils";
import type { GLTF } from "three-stdlib";
import { Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Texture, TextureLoader } from "three";
import { CosmeticRegistryEntry } from "./types";
import { getCosmeticRegistry } from "./registry";
import { MaterialPool } from "../utils/material-pool";

const textureLoader = new TextureLoader();
const materialPool = MaterialPool.getInstance();

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 350;

export type CosmeticAssetStatus = "idle" | "loading" | "ready" | "failed";

export interface CosmeticAssetPayload {
  gltfs: GLTF[];
  textures: Texture[];
  materials: Material[];
}

export interface CosmeticAssetHandle {
  entry: CosmeticRegistryEntry;
  status: CosmeticAssetStatus;
  payload: CosmeticAssetPayload;
  cacheGeneration: number;
  error?: Error;
  promise?: Promise<CosmeticAssetPayload>;
}

const assetCache = new Map<string, CosmeticAssetHandle>();
let assetCacheGeneration = 0;

class CosmeticAssetLoadCancelledError extends Error {
  constructor(assetId: string) {
    super(`[Cosmetics] Asset load cancelled due to cache reset: ${assetId}`);
    this.name = "CosmeticAssetLoadCancelledError";
  }
}

const createEmptyPayload = (): CosmeticAssetPayload => ({ gltfs: [], textures: [], materials: [] });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isGltfAsset = (path: string) => path.endsWith(".glb") || path.endsWith(".gltf");

async function loadWithRetry<T>(loader: () => Promise<T>): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < MAX_RETRIES) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= MAX_RETRIES) {
        break;
      }
      await wait(RETRY_DELAY_MS * attempt);
    }
  }

  throw (lastError as Error) ?? new Error("Unknown asset load failure");
}

function poolMaterial(material: Material, accumulator: Set<Material>): Material {
  let pooled = material;

  if (material instanceof MeshStandardMaterial) {
    pooled = materialPool.getStandardMaterial(material);
  } else if (material instanceof MeshBasicMaterial) {
    pooled = materialPool.getBasicMaterial(material);
  }

  if (pooled !== material && typeof material.dispose === "function") {
    material.dispose();
  }

  accumulator.add(pooled);
  return pooled;
}

function applyMaterialPooling(gltf: GLTF, accumulator: Set<Material>) {
  gltf.scene.traverse((node) => {
    if (!(node instanceof Mesh)) return;

    const material = node.material;
    if (Array.isArray(material)) {
      node.material = material.map((mat) => poolMaterial(mat, accumulator));
    } else if (material) {
      node.material = poolMaterial(material, accumulator);
    }
  });
}

const isCosmeticAssetLoadCancelledError = (error: unknown): error is CosmeticAssetLoadCancelledError =>
  error instanceof CosmeticAssetLoadCancelledError;

const assertCosmeticHandleIsActive = (handle: CosmeticAssetHandle, cacheGeneration: number): void => {
  const isCurrentGeneration = cacheGeneration === assetCacheGeneration;
  const isCurrentHandleOwner = assetCache.get(handle.entry.id) === handle;
  if (!isCurrentGeneration || !isCurrentHandleOwner) {
    throw new CosmeticAssetLoadCancelledError(handle.entry.id);
  }
};

async function loadCosmeticEntry(handle: CosmeticAssetHandle, cacheGeneration: number): Promise<CosmeticAssetPayload> {
  const gltfs: GLTF[] = [];
  const textures: Texture[] = [];
  const materials = new Set<Material>();

  try {
    for (const path of handle.entry.assetPaths) {
      assertCosmeticHandleIsActive(handle, cacheGeneration);
      if (isGltfAsset(path)) {
        const gltf = await loadWithRetry<GLTF>(
          () =>
            new Promise((resolve, reject) => {
              gltfLoader.load(path, resolve, undefined, reject);
            }),
        );
        assertCosmeticHandleIsActive(handle, cacheGeneration);
        applyMaterialPooling(gltf, materials);
        gltfs.push(gltf);
      } else {
        const texture = await loadWithRetry(() => textureLoader.loadAsync(path));
        assertCosmeticHandleIsActive(handle, cacheGeneration);
        textures.push(texture);
      }
    }

    assertCosmeticHandleIsActive(handle, cacheGeneration);
    const payload: CosmeticAssetPayload = {
      gltfs,
      textures,
      materials: Array.from(materials),
    };

    handle.payload = payload;
    handle.status = "ready";
    handle.error = undefined;
    return payload;
  } catch (error) {
    disposeCosmeticPayload({ gltfs: [], textures, materials: Array.from(materials) });
    if (isCosmeticAssetLoadCancelledError(error)) {
      handle.status = "idle";
      handle.error = undefined;
      throw error;
    }

    handle.error = error as Error;
    handle.status = "failed";
    throw error;
  }
}

function startAssetLoad(handle: CosmeticAssetHandle): Promise<CosmeticAssetPayload> {
  if (handle.status === "ready") {
    return Promise.resolve(handle.payload);
  }

  if (handle.promise) {
    return handle.promise;
  }

  handle.status = "loading";
  const requestGeneration = assetCacheGeneration;
  handle.cacheGeneration = requestGeneration;
  const promise = loadCosmeticEntry(handle, requestGeneration).finally(() => {
    if (handle.promise === promise) {
      handle.promise = undefined;
    }
  });
  handle.promise = promise;

  return promise;
}

function disposeCosmeticPayload(payload: CosmeticAssetPayload) {
  payload.textures.forEach((texture) => texture.dispose?.());
  payload.materials.forEach((material) => materialPool.releaseMaterial(material));
}

interface PreloadOptions {
  onProgress?: (details: { id: string; loaded: number; total: number }) => void;
  quiet?: boolean;
}

/**
 * Preloads every registered cosmetic asset. Errors are logged and surfaced via the returned promise.
 */
export async function preloadAllCosmeticAssets(options?: PreloadOptions) {
  const registry = getCosmeticRegistry();
  const total = registry.length;
  let loaded = 0;

  const tasks = registry.map((entry) => {
    const handle = ensureCosmeticAsset(entry);
    return startAssetLoad(handle)
      .catch((error) => {
        if (isCosmeticAssetLoadCancelledError(error)) {
          return;
        }
        if (!options?.quiet) {
          console.warn(`[Cosmetics] Failed to preload asset ${entry.id}`, error);
        }
      })
      .finally(() => {
        loaded += 1;
        options?.onProgress?.({ id: entry.id, loaded, total });
      });
  });

  await Promise.all(tasks);
}

export function ensureCosmeticAsset(entry: CosmeticRegistryEntry): CosmeticAssetHandle {
  let handle = assetCache.get(entry.id);
  if (!handle) {
    handle = {
      entry,
      status: "idle",
      payload: createEmptyPayload(),
      cacheGeneration: assetCacheGeneration,
    };
    assetCache.set(entry.id, handle);
  }
  return handle;
}

export function loadCosmeticAsset(entry: CosmeticRegistryEntry): Promise<CosmeticAssetPayload> {
  const handle = ensureCosmeticAsset(entry);
  return startAssetLoad(handle);
}

export function getCosmeticAsset(id: string): CosmeticAssetHandle | undefined {
  return assetCache.get(id);
}

export function clearCosmeticAssetCache() {
  assetCacheGeneration += 1;
  assetCache.forEach((handle) => {
    handle.cacheGeneration = assetCacheGeneration;
    handle.status = "idle";
    handle.error = undefined;
    disposeCosmeticPayload(handle.payload);
    handle.payload = createEmptyPayload();
  });
  assetCache.clear();
}
