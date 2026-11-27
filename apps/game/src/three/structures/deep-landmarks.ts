import { type deepSites } from "@bibliothecadao/types";
import {
  Box3,
  BufferGeometry,
  Color,
  Group,
  InstancedBufferAttribute,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { attribute, varying } from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";
import InstancedModel from "../managers/instanced-model";
import { DEEP_PALETTE } from "../terrain/deep-floor-material";
import { MaterialPool } from "../utils/material-pool";
import { createDeepAltarKit, createDeepArchiveKit, createDeepCoreKit, createDeepMineKit } from "./deep-site-kit";
import { isProcgenMasonryMaterial } from "./procgen-masonry-material";

type DeepSiteKey = (typeof deepSites)[number]["key"];
type DeepSiteKitBuilder = () => Pick<GLTF, "scene" | "animations">;

const DEEP_SITE_KITS = {
  foundation: createDeepArchiveKit,
  core: createDeepCoreKit,
  mine: createDeepMineKit,
  altar: createDeepAltarKit,
} as const satisfies Record<DeepSiteKey, DeepSiteKitBuilder>;

export const DEEP_EMPTY_GEM = "#121828";
const ACTIVE_GEM_INTENSITY = 1.6;
const DORMANT_TINT_FACTOR = 0.58;

export async function loadDeepLandmark(
  key: DeepSiteKey,
  activation: number,
): Promise<{ scene: Group; animations: [] }> {
  const root = new Group();
  root.name = activation < 1 ? `deep-landmark-${key}-dormant` : `deep-landmark-${key}`;
  const procedural = DEEP_SITE_KITS[key]();
  applyLandmarkActivation(procedural.scene, activation);
  root.add(procedural.scene);
  return { scene: root, animations: [] };
}

export class DeepLandmarkModel extends InstancedModel {
  readonly landmarkHeight: number;
  private readonly holderGlow?: InstancedBufferAttribute;
  private readonly holderLit?: InstancedBufferAttribute;
  private readonly holderGeometries: BufferGeometry[] = [];
  private readonly scratch = new Color();
  private disposed = false;

  constructor(landmark: { scene: Group; animations: [] }, capacity: number, name: string, activation: number) {
    super(landmark, capacity, false, name);
    this.landmarkHeight = new Box3().setFromObject(landmark.scene).max.y;
    if (activation < 1 || !this.instancedMeshes?.length) return;
    const glowGeometries = new Set<string>();
    landmark.scene.traverse((node) => {
      if (node instanceof Mesh && node.userData.holderGlow) glowGeometries.add(node.geometry.uuid);
    });
    if (glowGeometries.size === 0) return;
    const slots = this.instancedMeshes[0].instanceMatrix.count;
    this.holderGlow = new InstancedBufferAttribute(new Float32Array(slots * 3), 3);
    this.holderLit = new InstancedBufferAttribute(new Float32Array(slots), 1);
    const base = new Color(DEEP_EMPTY_GEM);
    for (let index = 0; index < slots; index++) {
      this.holderGlow.setXYZ(index, base.r, base.g, base.b);
    }
    for (const mesh of this.instancedMeshes) {
      if (!glowGeometries.has(mesh.geometry.uuid)) continue;
      const previous = mesh.material as MeshStandardMaterial;
      mesh.material = holderGlowMaterial(previous);
      MaterialPool.getInstance().releaseMaterial(previous);
      const geometry = mesh.geometry.clone();
      geometry.setAttribute("landmarkGlow", this.holderGlow);
      geometry.setAttribute("landmarkLit", this.holderLit);
      mesh.geometry = geometry;
      this.holderGeometries.push(geometry);
    }
  }

  setHolderColorAt(index: number, hex: string | null): void {
    if (!this.holderGlow || !this.holderLit) return;
    this.scratch.set(hex ?? DEEP_EMPTY_GEM);
    this.holderGlow.setXYZ(index, this.scratch.r, this.scratch.g, this.scratch.b);
    this.holderLit.setX(index, hex ? 1 : 0);
    this.holderGlow.needsUpdate = true;
    this.holderLit.needsUpdate = true;
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const geometry of this.holderGeometries) geometry.dispose();
    this.holderGeometries.length = 0;
    super.dispose();
  }
}

function holderGlowMaterial(source: MeshStandardMaterial): MeshStandardNodeMaterial {
  const glow = varying(attribute("landmarkGlow", "vec3"), "vLandmarkGlow");
  const lit = varying(attribute("landmarkLit", "float"), "vLandmarkLit");
  const material = new MeshStandardNodeMaterial({
    roughness: source.roughness,
    metalness: source.metalness,
  });
  material.colorNode = glow;
  material.emissiveNode = glow.mul(lit.mul(ACTIVE_GEM_INTENSITY));
  material.name = "deep-landmark-glow";
  return material;
}

function applyLandmarkActivation(root: Object3D, activation: number): void {
  const active = activation >= 1;
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    if (Array.isArray(object.material)) {
      if (active && object.material.some((material) => isSocketGem(object.name, material.name))) {
        object.userData.holderGlow = true;
      }
      object.material = object.material.map((material) => prepareForActivation(object.name, material, active));
    } else if (object.material) {
      if (active && isSocketGem(object.name, object.material.name)) {
        object.userData.holderGlow = true;
      }
      object.material = prepareForActivation(object.name, object.material, active);
    }
  });
}

function prepareForActivation(meshName: string, material: Material, active: boolean): Material {
  const target = material;
  if (isProcgenMasonryMaterial(target)) {
    const tinted = target as Material & { color?: Color };
    if (!active && tinted.color) {
      tinted.color.multiplyScalar(DORMANT_TINT_FACTOR);
    }
    return target;
  }
  if (!(target instanceof MeshStandardMaterial)) return target;
  if (isSocketGem(meshName, target.name)) {
    if (active) {
      target.color.set(DEEP_PALETTE.gold);
      target.emissive.set(DEEP_PALETTE.gold);
      target.emissiveIntensity = ACTIVE_GEM_INTENSITY;
    } else {
      target.color.set(DEEP_EMPTY_GEM);
      target.emissive.setHex(0x000000);
      target.emissiveIntensity = 0;
    }
    return target;
  }
  if (!active) {
    target.color.multiply(new Color().setScalar(DORMANT_TINT_FACTOR));
    if (target.emissiveIntensity > 0) {
      target.emissiveIntensity *= DORMANT_TINT_FACTOR * 0.4;
    }
  }
  return target;
}

function isSocketGem(meshName: string, materialName: string): boolean {
  return meshName.includes("deep_gem") || materialName.includes("deep_gem");
}
