import { describe, expect, it } from "vitest";
import { Group, Mesh } from "three";

import { requireCompleteTerrainPropCatalog } from "./terrain-prop-asset-cache";
import {
  TERRAIN_PROP_ARCHETYPE_IDS,
  getRequiredTerrainPropMeshNames,
  getTerrainPropDisturbanceAffinity,
  getTerrainPropRole,
  getTerrainPropMeshName,
  getTerrainPropWetlandAffinity,
  isTerrainGroundCover,
  isTerrainPropVisibleAtLod,
} from "./terrain-prop-catalog";

describe("terrain prop catalog", () => {
  it("defines one near and far mesh for every approved archetype", () => {
    expect(TERRAIN_PROP_ARCHETYPE_IDS).toHaveLength(15);
    expect(getRequiredTerrainPropMeshNames()).toHaveLength(30);
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

  it("keeps flexible vegetation separate from rigid fixtures", () => {
    expect(getTerrainPropRole("broadleaf")).toBe("canopy");
    expect(getTerrainPropRole("shrub")).toBe("understory");
    expect(getTerrainPropRole("boulder")).toBe("rigid");
    expect(getTerrainPropRole("cactus")).toBe("rigid");
    expect(getTerrainPropRole("fern")).toBe("groundcover");
  });

  it("favors pioneer cover and deadwood at settlement regrowth edges", () => {
    expect(getTerrainPropDisturbanceAffinity("shrub")).toBeGreaterThan(getTerrainPropDisturbanceAffinity("broadleaf"));
    expect(getTerrainPropDisturbanceAffinity("birch")).toBeGreaterThan(getTerrainPropDisturbanceAffinity("willow"));
    expect(getTerrainPropDisturbanceAffinity("stump")).toBeGreaterThan(getTerrainPropDisturbanceAffinity("boulder"));
    expect(getTerrainPropDisturbanceAffinity("fallen-log")).toBeGreaterThan(
      getTerrainPropDisturbanceAffinity("boulder"),
    );
  });

  it("keeps ground cover near-only and favors wetland species at water edges", () => {
    expect(isTerrainGroundCover("grass-tuft")).toBe(true);
    expect(isTerrainPropVisibleAtLod("grass-tuft", "near")).toBe(true);
    expect(isTerrainPropVisibleAtLod("grass-tuft", "far")).toBe(false);
    expect(getTerrainPropWetlandAffinity("reed")).toBeGreaterThan(getTerrainPropWetlandAffinity("grass-tuft"));
    expect(getTerrainPropWetlandAffinity("willow")).toBeGreaterThan(getTerrainPropWetlandAffinity("cactus"));
  });
});
