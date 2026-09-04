import { Bone, BufferAttribute, BufferGeometry, Group, Mesh, Skeleton, SkinnedMesh } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";

import { resolveHumanoidRigAdapter } from "./humanoid-rig-adapters";
import { resolveHumanoidRigRequiredBoneNames } from "./humanoid-rig-adapter";
import type { ProceduralCharacterAssetId } from "./procedural-character-appearance";
import type {
  LoadedProceduralCharacterAssetTemplate,
  ProceduralCharacterAssetDefinition,
} from "./procedural-character-assets";
import { disposeSkinnedSceneTemplates } from "./skinned-asset-resources";

export type QuaterniusCharacterAssetDefinition = ProceduralCharacterAssetDefinition;

export const QUATERNIUS_CHARACTER_ASSETS: Readonly<
  Record<ProceduralCharacterAssetId, QuaterniusCharacterAssetDefinition>
> = {
  base: {
    adapterId: "quaternius-universal",
    id: "base",
    label: "Universal base",
    url: "/models/characters/quaternius/base-male.glb",
  },
  peasant: {
    adapterId: "quaternius-universal",
    id: "peasant",
    label: "Peasant outfit",
    url: "/models/characters/quaternius/peasant-male.glb",
  },
  ranger: {
    adapterId: "quaternius-universal",
    id: "ranger",
    label: "Ranger outfit",
    url: "/models/characters/quaternius/ranger-male.glb",
  },
};

export const QUATERNIUS_REQUIRED_BONE_NAMES = resolveHumanoidRigRequiredBoneNames(
  resolveHumanoidRigAdapter("quaternius-universal"),
);

const HEAD_SOURCE_MESH_NAMES = ["Eyebrows", "Eyes", "SuperHero_Male"] as const;
const HEAD_NECK_RANGE = 0.42;
const MIN_HEAD_SKIN_WEIGHT = 0.5;
const REQUIRED_OBJECT_NAMES = ["Armature"] as const;

export async function loadQuaterniusCharacterAssetTemplates(): Promise<LoadedProceduralCharacterAssetTemplate[]> {
  const loader = new GLTFLoader();
  const results = await Promise.allSettled(
    Object.values(QUATERNIUS_CHARACTER_ASSETS).map(async (definition) => {
      const gltf = await loader.loadAsync(definition.url);
      const asset = { ...definition, gltf };
      try {
        validateQuaterniusCharacterAsset(definition, gltf);
        return asset;
      } catch (error) {
        disposeQuaterniusCharacterAssetTemplates([asset]);
        throw error;
      }
    }),
  );
  const loadedAssets = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") {
    disposeQuaterniusCharacterAssetTemplates(loadedAssets);
    throw failure.reason;
  }
  try {
    prepareQuaterniusCharacterTemplates(loadedAssets);
    return loadedAssets;
  } catch (error) {
    disposeQuaterniusCharacterAssetTemplates(loadedAssets);
    throw error;
  }
}

function disposeQuaterniusCharacterAssetTemplates(assets: readonly LoadedProceduralCharacterAssetTemplate[]): void {
  disposeSkinnedSceneTemplates(assets.map(({ gltf }) => gltf.scene));
}

export function resolveQuaterniusCharacterAsset(id: ProceduralCharacterAssetId): QuaterniusCharacterAssetDefinition {
  return QUATERNIUS_CHARACTER_ASSETS[id];
}

function validateQuaterniusCharacterAsset(definition: QuaterniusCharacterAssetDefinition, gltf: GLTF): void {
  const adapter = resolveHumanoidRigAdapter(definition.adapterId);
  const missingBones = resolveHumanoidRigRequiredBoneNames(adapter).filter(
    (boneName) => !(gltf.scene.getObjectByName(boneName) instanceof Bone),
  );
  if (missingBones.length > 0) {
    throw new Error(`${definition.label} is missing required ${adapter.label} bones: ${missingBones.join(", ")}`);
  }
  const missingObjects = REQUIRED_OBJECT_NAMES.filter((objectName) => !gltf.scene.getObjectByName(objectName));
  if (missingObjects.length > 0) {
    throw new Error(`${definition.label} is missing required objects: ${missingObjects.join(", ")}`);
  }
  if (gltf.animations.length > 0) {
    throw new Error(`${definition.label} unexpectedly contains authored animation clips`);
  }
}

function prepareQuaterniusCharacterTemplates(assets: LoadedProceduralCharacterAssetTemplate[]): void {
  assets.forEach(({ gltf }) => {
    gltf.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      // Quaternius exports a vertex-color customization channel that Three's
      // WebGPU backend promotes to an invalid `unorm32x4` pipeline format.
      object.geometry.deleteAttribute("color");
    });
  });
  composeBaseHeadOntoOutfitTemplates(assets);
}

function composeBaseHeadOntoOutfitTemplates(assets: LoadedProceduralCharacterAssetTemplate[]): void {
  const targets = assets.filter(({ id }) => id !== "base");
  if (targets.length === 0) return;
  const baseAsset = assets.find(({ id }) => id === "base");
  if (!baseAsset) throw new Error("Quaternius Universal base asset was not loaded");
  const headSources = HEAD_SOURCE_MESH_NAMES.map((name) => requireSkinnedMesh(baseAsset.gltf.scene, name));
  targets.forEach((asset) => attachHeadToOutfitTemplate(asset, headSources));
}

function attachHeadToOutfitTemplate(
  asset: LoadedProceduralCharacterAssetTemplate,
  headSources: readonly SkinnedMesh[],
): void {
  const targetMesh = findFirstSkinnedMesh(asset.gltf.scene);
  const armature = asset.gltf.scene.getObjectByName("Armature");
  if (!targetMesh || !armature) throw new Error(`${asset.label} cannot accept the Universal base head`);
  validateCompatibleSkeletons(headSources[0].skeleton, targetMesh.skeleton, asset.label);

  headSources.forEach((source) => {
    const geometry = source.name === "SuperHero_Male" ? extractHeadGeometry(source) : source.geometry.clone();
    const material = Array.isArray(source.material)
      ? source.material.map((entry) => entry.clone())
      : source.material.clone();
    const headPiece = new SkinnedMesh(geometry, material);
    headPiece.name = `UniversalHead_${source.name}`;
    headPiece.position.copy(source.position);
    headPiece.quaternion.copy(source.quaternion);
    headPiece.scale.copy(source.scale);
    headPiece.bindMode = source.bindMode;
    headPiece.bind(targetMesh.skeleton, source.bindMatrix);
    armature.add(headPiece);
  });
}

function extractHeadGeometry(source: SkinnedMesh): BufferGeometry {
  const geometry = source.geometry.clone();
  geometry.computeBoundingBox();
  const position = geometry.getAttribute("position");
  const skinIndex = geometry.getAttribute("skinIndex");
  const skinWeight = geometry.getAttribute("skinWeight");
  const sourceIndex = geometry.index;
  const maxY = geometry.boundingBox?.max.y;
  if (!sourceIndex || !skinIndex || !skinWeight || maxY === undefined) {
    throw new Error("Universal base body cannot be separated into a head mesh");
  }
  const headBoneIndices = new Set(
    source.skeleton.bones
      .map((bone, index) => ({ index, name: bone.name }))
      .filter(({ name }) => name === "Head" || name === "neck_01")
      .map(({ index }) => index),
  );
  const neckCutY = maxY - HEAD_NECK_RANGE;
  const retainedIndices: number[] = [];

  for (let index = 0; index < sourceIndex.count; index += 3) {
    const a = sourceIndex.getX(index);
    const b = sourceIndex.getX(index + 1);
    const c = sourceIndex.getX(index + 2);
    const centroidY = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
    const headWeight = (resolveHeadWeight(a) + resolveHeadWeight(b) + resolveHeadWeight(c)) / 3;
    if (centroidY >= neckCutY && headWeight >= MIN_HEAD_SKIN_WEIGHT) retainedIndices.push(a, b, c);
  }
  if (retainedIndices.length === 0) throw new Error("Universal base head extraction retained no triangles");

  const IndexArray = position.count > 65_535 ? Uint32Array : Uint16Array;
  geometry.setIndex(new BufferAttribute(new IndexArray(retainedIndices), 1));
  geometry.clearGroups();
  geometry.addGroup(0, retainedIndices.length, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;

  function resolveHeadWeight(vertexIndex: number): number {
    let weight = 0;
    for (let item = 0; item < 4; item += 1) {
      if (headBoneIndices.has(skinIndex.getComponent(vertexIndex, item))) {
        weight += skinWeight.getComponent(vertexIndex, item);
      }
    }
    return weight;
  }
}

function requireSkinnedMesh(scene: Group, name: string): SkinnedMesh {
  const object = scene.getObjectByName(name);
  if (!(object instanceof SkinnedMesh)) throw new Error(`Universal base mesh ${name} was not found`);
  return object;
}

function findFirstSkinnedMesh(scene: Group): SkinnedMesh | undefined {
  let result: SkinnedMesh | undefined;
  scene.traverse((object) => {
    if (!result && object instanceof SkinnedMesh) result = object;
  });
  return result;
}

function validateCompatibleSkeletons(source: Skeleton, target: Skeleton, assetLabel: string): void {
  const sourceNames = source.bones.map((bone) => bone.name);
  const targetNames = target.bones.map((bone) => bone.name);
  if (sourceNames.length !== targetNames.length || sourceNames.some((name, index) => name !== targetNames[index])) {
    throw new Error(`${assetLabel} does not share the Universal base skeleton order`);
  }
}
