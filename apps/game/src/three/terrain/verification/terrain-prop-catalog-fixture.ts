import { BoxGeometry, BufferAttribute, Group, Mesh, MeshBasicMaterial } from "three";

import { TERRAIN_PROP_ARCHETYPE_IDS } from "../terrain-prop-catalog";

export function createTerrainPropCatalogFixture(): Group {
  const scene = new Group();
  scene.name = "terrain-prop-catalog-fixture";
  for (const name of TERRAIN_PROP_ARCHETYPE_IDS) {
    const geometry = new BoxGeometry(1, 1, 1);
    const vertices = geometry.getAttribute("position").count;
    geometry.setAttribute("_wind_weight", new BufferAttribute(new Float32Array(vertices).fill(1), 1));
    geometry.setAttribute("_wind_bend", new BufferAttribute(new Float32Array(vertices).fill(0.5), 1));
    geometry.setAttribute("_glow", new BufferAttribute(new Float32Array(vertices), 1));
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    mesh.name = name;
    scene.add(mesh);
  }
  return scene;
}
