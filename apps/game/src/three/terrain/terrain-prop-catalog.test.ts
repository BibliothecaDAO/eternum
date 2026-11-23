import { describe, expect, it } from "vitest";
import { Group, Mesh } from "three";

import { requireCompleteTerrainPropCatalog } from "./terrain-prop-asset-cache";
import {
  getTerrainPropPlacementLayer,
  getTerrainPropRole,
  TERRAIN_PROP_ARCHETYPE_IDS,
  type TerrainPropArchetypeId,
} from "./terrain-prop-catalog";

describe("terrain prop catalog", () => {
  it("accepts a complete catalog and rejects a missing kind", () => {
    const scene = new Group();
    TERRAIN_PROP_ARCHETYPE_IDS.forEach((name) => {
      const mesh = new Mesh();
      mesh.name = name;
      scene.add(mesh);
    });

    expect(() => requireCompleteTerrainPropCatalog({ scene })).not.toThrow();
    scene.remove(scene.getObjectByName("rainforest-canopy")!);
    expect(() => requireCompleteTerrainPropCatalog({ scene })).toThrow(
      "Terrain prop catalog is missing required meshes: rainforest-canopy",
    );
  });

  it("classifies standing stones as rigid debris and refuses unknown archetypes loudly", () => {
    expect(getTerrainPropRole("standing-stone")).toBe("rigid");
    expect(getTerrainPropPlacementLayer("standing-stone")).toBe("debris");
    expect(() => getTerrainPropRole("missing-flora" as TerrainPropArchetypeId)).toThrow(
      "Unknown terrain prop archetype: missing-flora",
    );
  });
});
