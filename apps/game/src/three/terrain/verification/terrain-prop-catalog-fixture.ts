import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";

import { getRequiredTerrainPropMeshNames } from "../terrain-prop-catalog";

/** A stand-in for the prop catalog GLB: one unit box per required archetype/LOD mesh name. */
export function createTerrainPropCatalogFixture(): Group {
  const scene = new Group();
  scene.name = "terrain-prop-catalog-fixture";
  for (const name of getRequiredTerrainPropMeshNames()) {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    mesh.name = name;
    scene.add(mesh);
  }
  return scene;
}
