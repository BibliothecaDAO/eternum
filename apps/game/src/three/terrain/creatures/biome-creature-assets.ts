import { Box3, Group, Mesh, MeshStandardMaterial, Texture, Vector3 } from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { creatureMovement } from "./biome-creature-catalog";
import { createCreatureAnimator } from "./biome-creature-animator.js";

/** Owned by one terrain instance; clones share GPU resources but never joint transforms. */
export async function loadBiomeCreature(
  species: string,
  reveal: (material: MeshStandardNodeMaterial) => void,
): Promise<Group> {
  const { scene } = await new GLTFLoader().loadAsync(`/models/biome-creatures/${species}.glb`);
  try {
    createCreatureAnimator(scene).reset();
    prepareCreatureMaterials(scene, creatureMovement(species) !== "water", reveal);
    fitCreatureToHex(scene, species);
    return scene;
  } catch (error) {
    disposeBiomeCreature(scene);
    throw error;
  }
}

function prepareCreatureMaterials(
  scene: Group,
  castsShadow: boolean,
  reveal: (material: MeshStandardNodeMaterial) => void,
): void {
  const materials = new Map<MeshStandardMaterial, MeshStandardNodeMaterial>();
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const convert = (source: MeshStandardMaterial) => {
      let material = materials.get(source);
      if (!material) {
        material = new MeshStandardNodeMaterial();
        MeshStandardMaterial.prototype.copy.call(material, source);
        reveal(material);
        materials.set(source, material);
      }
      return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
    object.castShadow = castsShadow;
    object.receiveShadow = true;
    object.raycast = () => {};
  });
  materials.forEach((_, source) => source.dispose());
}

function fitCreatureToHex(scene: Group, species: string): void {
  const bounds = new Box3().setFromObject(scene);
  const size = bounds.getSize(new Vector3());
  // Fit even a moose or spread wings inside a hex, retaining authored ground pivots.
  const scale = 0.65 / Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(scale) || scale <= 0) throw new Error(`Invalid creature bounds: ${species}`);
  scene.scale.setScalar(scale);
  if (creatureMovement(species) === "water") {
    // Aquatic assets have raised display pivots; center their bodies on the swimming depth.
    scene.position.y = -bounds.getCenter(new Vector3()).y * scale;
  }
}

export function disposeBiomeCreature(root: Group): void {
  const resources = new Set<{ dispose(): void }>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    resources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) resources.add(value);
    }
  });
  resources.forEach((resource) => resource.dispose());
  root.clear();
}
