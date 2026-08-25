import { gltfLoader } from "@/three/utils/utils";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import {
  type BufferGeometry,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Texture,
  TextureLoader,
} from "three";
import { CosmeticRegistryEntry } from "./types";
import { MaterialPool } from "../utils/material-pool";
import { collectMaterialTextures } from "../utils/material-textures";

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
  error?: Error;
  promise?: Promise<CosmeticAssetPayload>;
}

const assetCache = new Map<string, CosmeticAssetHandle>();

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

function poolMaterial(material: Material, accumulator: Material[]): Material {
  let pooled = material;

  if (material instanceof MeshStandardMaterial) {
    pooled = materialPool.getStandardMaterial(material);
  } else if (material instanceof MeshBasicMaterial) {
    pooled = materialPool.getBasicMaterial(material);
  }

  accumulator.push(pooled);
  return pooled;
}

function applyMaterialPooling(gltf: GLTF, accumulator: Material[]) {
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

async function loadCosmeticEntry(handle: CosmeticAssetHandle): Promise<CosmeticAssetPayload> {
  const gltfs: GLTF[] = [];
  const textures: Texture[] = [];
  const materials: Material[] = [];

  try {
    for (const path of handle.entry.assetPaths) {
      if (isGltfAsset(path)) {
        const gltf = await loadWithRetry<GLTF>(
          () =>
            new Promise((resolve, reject) => {
              gltfLoader.load(path, resolve, undefined, reject);
            }),
        );
        applyMaterialPooling(gltf, materials);
        gltfs.push(gltf);
      } else {
        const texture = await loadWithRetry(() => textureLoader.loadAsync(path));
        textures.push(texture);
      }
    }
  } catch (error) {
    disposeCosmeticPayloads([{ gltfs, materials, textures }]);
    handle.error = error as Error;
    handle.status = "failed";
    throw error;
  }

  const payload: CosmeticAssetPayload = {
    gltfs,
    textures,
    materials,
  };

  if (assetCache.get(handle.entry.id) !== handle) {
    disposeCosmeticPayloads([payload]);
    const error = new Error(`[Cosmetics] Asset load for ${handle.entry.id} was cleared before completion`);
    handle.error = error;
    handle.status = "failed";
    throw error;
  }

  handle.payload = payload;
  handle.status = "ready";
  handle.error = undefined;
  return payload;
}

function startAssetLoad(handle: CosmeticAssetHandle): Promise<CosmeticAssetPayload> {
  if (handle.status === "ready") {
    return Promise.resolve(handle.payload);
  }

  if (handle.promise) {
    return handle.promise;
  }

  handle.status = "loading";
  handle.promise = loadCosmeticEntry(handle)
    .catch((error) => {
      handle.error = error as Error;
      return Promise.reject(error);
    })
    .finally(() => {
      handle.promise = undefined;
    });

  return handle.promise;
}

export function ensureCosmeticAsset(entry: CosmeticRegistryEntry): CosmeticAssetHandle {
  let handle = assetCache.get(entry.id);
  if (!handle) {
    handle = {
      entry,
      status: "idle",
      payload: createEmptyPayload(),
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
  disposeCosmeticPayloads(Array.from(assetCache.values(), (handle) => handle.payload));
  assetCache.clear();
}

function disposeCosmeticPayloads(payloads: CosmeticAssetPayload[]): void {
  const geometries = new Set<BufferGeometry>();
  const textures = new Set<Texture>();

  payloads.forEach((payload) => {
    collectCosmeticPayloadResources(payload, geometries, textures);
    payload.materials.forEach((material) => materialPool.releaseMaterial(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
}

function collectCosmeticPayloadResources(
  payload: CosmeticAssetPayload,
  geometries: Set<BufferGeometry>,
  textures: Set<Texture>,
): void {
  payload.textures.forEach((texture) => textures.add(texture));
  payload.gltfs.forEach((gltf) => {
    gltf.scene.traverse((node) => {
      if (!(node instanceof Mesh)) {
        return;
      }

      geometries.add(node.geometry);
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => collectMaterialTextures(material, textures));
    });
  });
}
