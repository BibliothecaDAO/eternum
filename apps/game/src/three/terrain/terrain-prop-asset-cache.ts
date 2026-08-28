import { gltfLoader } from "@/three/utils/utils";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

import { TERRAIN_PROP_CATALOG_PATH, getRequiredTerrainPropMeshNames } from "./terrain-prop-catalog";

let catalogPromise: Promise<GLTF> | null = null;

export function loadTerrainPropCatalog(): Promise<GLTF> {
  if (catalogPromise) return catalogPromise;

  catalogPromise = gltfLoader.loadAsync(TERRAIN_PROP_CATALOG_PATH).then((gltf) => {
    requireCompleteTerrainPropCatalog(gltf);
    return gltf;
  });
  catalogPromise.catch(() => {
    catalogPromise = null;
  });
  return catalogPromise;
}

export function requireCompleteTerrainPropCatalog(gltf: Pick<GLTF, "scene">): void {
  const missing = getRequiredTerrainPropMeshNames().filter((name) => !gltf.scene.getObjectByName(name));
  if (missing.length > 0) {
    throw new Error(`Terrain prop catalog is missing required meshes: ${missing.join(", ")}`);
  }
}
