import type { AspectId, deepSites } from "@bibliothecadao/types";
import { Color, Group, type Material, Mesh, MeshStandardMaterial, type Object3D } from "three";
import { DEEP_PALETTE } from "../terrain/deep-floor-material";
import { gltfLoader } from "../utils/utils";

type DeepSiteKey = (typeof deepSites)[number]["key"];

export const DEEP_SITE_MODELS = {
  foundation: "/models/frontier/deep/archive.glb",
  core: "/models/frontier/deep/core.glb",
  mine: "/models/frontier/deep/mine.glb",
  altar: "/models/frontier/deep/altar.glb",
} as const satisfies Record<DeepSiteKey, string>;

export const DEEP_GATE_MODELS = {
  1: "/models/frontier/deep/gate-prowess.glb",
  2: "/models/frontier/deep/gate-luminary.glb",
  3: "/models/frontier/deep/gate-havoc.glb",
  4: "/models/frontier/deep/gate-insight.glb",
} as const satisfies Record<AspectId, string>;

const DORMANT_GEM_HEX = "#121828";
const ACTIVE_GEM_INTENSITY = 1.6;
const DORMANT_TINT_FACTOR = 0.58;

export async function loadDeepLandmark(key: DeepSiteKey, activation: number): Promise<{ scene: Group; animations: [] }> {
  const gltf = await gltfLoader.loadAsync(DEEP_SITE_MODELS[key]);
  const root = new Group();
  root.name = activation < 1 ? `deep-landmark-${key}-dormant` : `deep-landmark-${key}`;
  const clone = gltf.scene.clone(true);
  applyLandmarkActivation(clone, activation);
  root.add(clone);
  return { scene: root, animations: [] };
}

function applyLandmarkActivation(root: Object3D, activation: number): void {
  const active = activation >= 1;
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    if (Array.isArray(object.material)) {
      object.material = object.material.map((material) => cloneForActivation(object.name, material, active));
    } else if (object.material) {
      object.material = cloneForActivation(object.name, object.material, active);
    }
  });
}

function cloneForActivation(meshName: string, material: Material, active: boolean): Material {
  const cloned = material.clone();
  if (!(cloned instanceof MeshStandardMaterial)) return cloned;
  if (isSocketGem(meshName, cloned.name)) {
    if (active) {
      cloned.color.set(DEEP_PALETTE.gold);
      cloned.emissive.set(DEEP_PALETTE.gold);
      cloned.emissiveIntensity = ACTIVE_GEM_INTENSITY;
    } else {
      cloned.color.set(DORMANT_GEM_HEX);
      cloned.emissive.setHex(0x000000);
      cloned.emissiveIntensity = 0;
    }
    return cloned;
  }
  if (!active) {
    cloned.color.multiply(new Color().setScalar(DORMANT_TINT_FACTOR));
  }
  return cloned;
}

function isSocketGem(meshName: string, materialName: string): boolean {
  return meshName.includes("deep_gem") || materialName.includes("deep_gem");
}
