import { describe, expect, it } from "vitest";
import { Group, Mesh } from "three";

import { requireCompleteTerrainPropCatalog } from "./terrain-prop-asset-cache";
import {
  TERRAIN_PROP_ARCHETYPE_IDS,
  getRequiredTerrainPropMeshNames,
  getTerrainPropMeshName,
} from "./terrain-prop-catalog";

describe("terrain prop catalog", () => {
  it("defines one near and far mesh for every approved archetype", () => {
    expect(TERRAIN_PROP_ARCHETYPE_IDS).toHaveLength(11);
    expect(getRequiredTerrainPropMeshNames()).toHaveLength(22);
    expect(getTerrainPropMeshName("broadleaf", "near")).toBe("broadleaf-near");
  });

  it("accepts a complete catalog and rejects a missing LOD", () => {
    const scene = new Group();
    getRequiredTerrainPropMeshNames().forEach((name) => {
      const mesh = new Mesh();
      mesh.name = name;
      scene.add(mesh);
    });

    expect(() => requireCompleteTerrainPropCatalog({ scene })).not.toThrow();
    scene.remove(scene.getObjectByName("willow-far")!);
    expect(() => requireCompleteTerrainPropCatalog({ scene })).toThrow(
      "Terrain prop catalog is missing required meshes: willow-far",
    );
  });
});
