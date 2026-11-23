import { fetchModel } from "@/three/utils/model-url";
import { gltfLoader } from "@/three/utils/utils";
import { Group, type Object3D } from "three";

import {
  TERRAIN_FLORA_MANIFEST_PATH,
  TERRAIN_PROP_ARCHETYPE_IDS,
  type TerrainPropArchetypeId,
} from "./terrain-prop-catalog";

export interface TerrainPropCatalog {
  scene: Group;
}

interface FloraManifest {
  species: { id: string; file: string }[];
}

let catalogPromise: Promise<TerrainPropCatalog> | null = null;

export function loadTerrainPropCatalog(): Promise<TerrainPropCatalog> {
  if (catalogPromise) return catalogPromise;

  catalogPromise = loadFloraCatalog().then((catalog) => {
    requireCompleteTerrainPropCatalog(catalog);
    return catalog;
  });
  catalogPromise.catch(() => {
    catalogPromise = null;
  });
  return catalogPromise;
}

export function requireCompleteTerrainPropCatalog(catalog: TerrainPropCatalog): void {
  const missing = TERRAIN_PROP_ARCHETYPE_IDS.filter((archetype) => !catalog.scene.getObjectByName(archetype));
  if (missing.length > 0) {
    throw new Error(`Terrain prop catalog is missing required meshes: ${missing.join(", ")}`);
  }
}

async function loadFloraCatalog(): Promise<TerrainPropCatalog> {
  const response = await fetchModel(TERRAIN_FLORA_MANIFEST_PATH);
  if (!response.ok) throw new Error(`${TERRAIN_FLORA_MANIFEST_PATH} answered ${response.status}`);
  const manifest = (await response.json()) as FloraManifest;
  const scene = new Group();
  scene.name = "terrain-flora-catalog";
  const species = manifest.species.filter((row): row is { id: TerrainPropArchetypeId; file: string } =>
    (TERRAIN_PROP_ARCHETYPE_IDS as readonly string[]).includes(row.id),
  );
  const variants = await Promise.all(
    species.map(async ({ id, file }) => [id, await loadFloraVariant(id, file)] as const),
  );
  for (const [id, variant] of variants) {
    variant.name = id;
    scene.add(variant);
  }
  return { scene };
}

async function loadFloraVariant(id: TerrainPropArchetypeId, file: string): Promise<Object3D> {
  const { scene } = await gltfLoader.loadAsync(TERRAIN_FLORA_MANIFEST_PATH.replace("manifest.json", file));
  const variant = scene.getObjectByName(`${id}-a`);
  if (!variant) throw new Error(`Procedural flora ${file} has no first variant`);
  return variant;
}
