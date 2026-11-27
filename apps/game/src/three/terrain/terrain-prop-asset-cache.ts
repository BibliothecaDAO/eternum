import type { Group } from "three";

import { buildProceduralTerrainPropCatalog } from "./flora-kit";
import { TERRAIN_PROP_ARCHETYPE_IDS } from "./terrain-prop-catalog";

export interface TerrainPropCatalog {
  scene: Group;
}

let catalogPromise: Promise<TerrainPropCatalog> | null = null;

export function loadTerrainPropCatalog(): Promise<TerrainPropCatalog> {
  if (catalogPromise) return catalogPromise;

  catalogPromise = Promise.resolve(buildProceduralTerrainPropCatalog(TERRAIN_PROP_ARCHETYPE_IDS)).then((catalog) => {
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
