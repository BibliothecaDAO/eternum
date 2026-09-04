import {
  Bone,
  Box3,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  SkinnedMesh,
  Vector3,
  type AnimationClip,
  type KeyframeTrack,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { disposeSkinnedSceneTemplates, instantiateSkinnedScene } from "../skinned-asset-resources";
import { resolveIcyDragonRequiredBoneNames } from "./icy-dragon-rig-adapter";

export const ICY_DRAGON_ASSET_URL = "/models/characters/icy-dragon/scene.gltf";
const ICY_DRAGON_TARGET_EXTENT = 4.6;
const PRIMARY_MESH_MINIMUM_VERTEX_COUNT = 10_000;

export interface LoadedIcyDragonAsset {
  scene: Group;
}

/** Owns the decoded Icy Dragon source while actors retain independent skeleton and material state. */
export class IcyDragonLibrary {
  private disposed = false;

  public constructor(private readonly template: LoadedIcyDragonAsset) {}

  public instantiate(): LoadedIcyDragonAsset {
    if (this.disposed) throw new Error("Cannot instantiate a disposed Icy dragon library");
    return { scene: instantiateSkinnedScene(this.template.scene) };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    disposeSkinnedSceneTemplates([this.template.scene]);
  }
}

export async function loadIcyDragonLibrary(): Promise<IcyDragonLibrary> {
  const { animations, scene } = await new GLTFLoader().loadAsync(ICY_DRAGON_ASSET_URL);
  applyIcyDragonReferencePose(scene, animations[0]);
  validateIcyDragon(scene);
  discardIcyAuthoredAnimations(scene);
  normalizeIcyDragonMaterials(scene);
  normalizeIcyDragonScene(scene);
  return new IcyDragonLibrary({ scene });
}

export function applyIcyDragonReferencePose(scene: Group, clip?: AnimationClip): void {
  if (!clip) throw new Error("Icy dragon is missing its reference animation clip");
  clip.tracks.forEach((track) => applyReferenceTrackSample(scene, track));
  scene.updateWorldMatrix(true, true);
}

function applyReferenceTrackSample(scene: Group, track: KeyframeTrack): void {
  const propertySeparator = track.name.lastIndexOf(".");
  if (propertySeparator < 1) return;
  const node = scene.getObjectByName(track.name.slice(0, propertySeparator));
  if (!node) return;
  const property = track.name.slice(propertySeparator + 1);
  if (property === "position" || property === "scale") {
    node[property].set(track.values[0], track.values[1], track.values[2]);
  } else if (property === "quaternion") {
    node.quaternion.set(track.values[0], track.values[1], track.values[2], track.values[3]).normalize();
  }
}

function validateIcyDragon(scene: Group): void {
  const bones = new Set<string>();
  let skinnedMeshCount = 0;
  scene.traverse((object) => {
    if (object instanceof Bone) bones.add(object.name);
    if (object instanceof SkinnedMesh) skinnedMeshCount += 1;
  });
  const requiredBones = resolveIcyDragonRequiredBoneNames();
  const missingBones = requiredBones.filter((name) => !bones.has(name));
  if (missingBones.length > 0) throw new Error(`Icy dragon is missing bones: ${missingBones.join(", ")}`);
  if (skinnedMeshCount !== 6) throw new Error(`Icy dragon expected 6 skinned meshes, received ${skinnedMeshCount}`);
}

function discardIcyAuthoredAnimations(scene: Group): void {
  scene.animations = [];
}

export function normalizeIcyDragonMaterials(scene: Group): void {
  const materials = new Set<MeshStandardMaterial>();
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => {
      if (!(material instanceof MeshStandardMaterial)) {
        throw new Error(`Icy dragon material ${material.name || "<unnamed>"} is not a standard material`);
      }
      materials.add(material);
    });
  });
  materials.forEach(normalizeIcyDragonMaterial);
}

function normalizeIcyDragonMaterial(material: MeshStandardMaterial): void {
  material.alphaTest = 0;
  material.depthWrite = true;
  material.opacity = 1;
  material.side = DoubleSide;
  material.transparent = false;
  material.needsUpdate = true;
}

function normalizeIcyDragonScene(scene: Group): void {
  const sourceBounds = measureIcyDragonBounds(scene);
  const sourceSize = sourceBounds.getSize(new Vector3());
  const sourceExtent = Math.max(sourceSize.x, sourceSize.y, sourceSize.z);
  if (!Number.isFinite(sourceExtent) || sourceExtent <= 0) throw new Error("Icy dragon has invalid scene bounds");
  scene.scale.setScalar(ICY_DRAGON_TARGET_EXTENT / sourceExtent);
  scene.updateWorldMatrix(true, true);
  const bounds = measureIcyDragonBounds(scene);
  const center = bounds.getCenter(new Vector3());
  scene.position.set(-center.x, -bounds.min.y, -center.z);
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = false;
    object.receiveShadow = false;
    object.frustumCulled = false;
  });
  scene.updateWorldMatrix(true, true);
}

function measureIcyDragonBounds(scene: Group): Box3 {
  const bounds = new Box3();
  let primaryMeshCount = 0;
  scene.updateWorldMatrix(true, true);
  scene.traverse((object) => {
    if (!(object instanceof SkinnedMesh)) return;
    const vertexCount = object.geometry.getAttribute("position")?.count ?? 0;
    if (vertexCount < PRIMARY_MESH_MINIMUM_VERTEX_COUNT) return;
    bounds.expandByObject(object, true);
    primaryMeshCount += 1;
  });
  if (primaryMeshCount !== 2) {
    throw new Error(`Icy dragon expected 2 primary meshes, received ${primaryMeshCount}`);
  }
  return bounds;
}
