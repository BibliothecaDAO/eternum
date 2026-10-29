import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

import { ChestTransitions } from "./chest-transitions";

/**
 * A transitions pool over the smallest chest the summoning accepts: its body and lid pivots, its two turning rings with
 * a rune each, and its orbiting gems. For tests that drive the real pool.
 */
export function createChestPool(): ChestTransitions {
  const scene = new Group();
  const body = new Group();
  body.name = "ChestBody";
  const lid = new Group();
  lid.name = "ChestLid";
  body.add(lid);
  scene.add(body);
  for (let i = 0; i < 2; i++) {
    const ring = new Group();
    ring.name = `ArcaneSealRing${i}`;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([0.7, 0.05, 0, 0.71, 0.05, 0, 0.7, 0.05, 0.01], 3));
    const material = new MeshStandardMaterial();
    material.name = "Ritual violet";
    ring.add(new Mesh(geometry, material));
    scene.add(ring);
  }
  const gems = new Group();
  gems.name = "OrbitGems";
  scene.add(gems);
  return new ChestTransitions({ scene, animations: [] } as unknown as GLTF);
}
