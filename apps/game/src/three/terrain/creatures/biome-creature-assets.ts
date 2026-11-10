import { Box3, Group, Mesh, MeshStandardMaterial, Texture, Vector3 } from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import { gltfLoader } from "../../utils/gltf-loader";
import { creatureTraits, type CreatureSpecies } from "./biome-creature-catalog";
import { createCreatureAnimator } from "./biome-creature-animator.js";

/** Owned by one terrain instance; clones share GPU resources but never joint transforms. */
export async function loadBiomeCreature(
  species: CreatureSpecies,
  reveal: (material: MeshStandardNodeMaterial) => void,
): Promise<Group> {
  const { scene } = await gltfLoader.loadAsync(`/models/biome-creatures/${species}.glb`);
  try {
    createCreatureAnimator(scene).reset();
    prepareCreatureMaterials(scene, creatureTraits(species).movement !== "water", reveal);
    fitCreatureToItsSize(scene, species);
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

function fitCreatureToItsSize(scene: Group, species: CreatureSpecies): void {
  const bounds = new Box3().setFromObject(scene);
  const size = bounds.getSize(new Vector3());
  const traits = creatureTraits(species);
  // The species' own size, measured across its largest dimension; authored ground pivots are retained.
  const scale = traits.size / Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(scale) || scale <= 0) throw new Error(`Invalid creature bounds: ${species}`);
  scene.scale.setScalar(scale);
  if (traits.movement === "water") {
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
