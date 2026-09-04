import { Bone, SkinnedMesh } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";

import { disposeSkinnedSceneTemplates } from "../skinned-asset-resources";
import { resolveHorseRigRequiredBoneNames } from "./horse-rig-adapter";
import type { LoadedProceduralHorseAssetTemplate, ProceduralHorseAssetDefinition } from "./procedural-horse-assets";
import { QUATERNIUS_HORSE_RIG_ADAPTER } from "./quaternius-horse-rig-adapter";

export const QUATERNIUS_HORSE_ASSET = {
  adapterId: QUATERNIUS_HORSE_RIG_ADAPTER.id,
  id: "quaternius-horse",
  label: "Quaternius horse",
  scale: 0.52,
  url: "/models/characters/quaternius-horse/horse.glb",
} as const satisfies ProceduralHorseAssetDefinition;

export const QUATERNIUS_HORSE_REFERENCE_CLIPS = [
  "Attack_Headbutt",
  "Attack_Kick",
  "Death",
  "Eating",
  "Gallop",
  "Gallop_Jump",
  "Idle",
  "Idle_2",
  "Idle_Headlow",
  "Idle_HitReact1",
  "Idle_HitReact2",
  "Jump_toIdle",
  "Walk",
] as const;

export async function loadQuaterniusHorseAssetTemplates(): Promise<LoadedProceduralHorseAssetTemplate[]> {
  const gltf = await new GLTFLoader().loadAsync(QUATERNIUS_HORSE_ASSET.url);
  try {
    validateQuaterniusHorse(gltf);
    return [{ ...QUATERNIUS_HORSE_ASSET, gltf }];
  } catch (error) {
    disposeSkinnedSceneTemplates([gltf.scene]);
    throw error;
  }
}

function validateQuaterniusHorse(gltf: GLTF): void {
  const requiredBones = resolveHorseRigRequiredBoneNames(QUATERNIUS_HORSE_RIG_ADAPTER);
  const missingBones = requiredBones.filter((name) => !(gltf.scene.getObjectByName(name) instanceof Bone));
  if (missingBones.length > 0)
    throw new Error(`Quaternius horse is missing required bones: ${missingBones.join(", ")}`);

  let skinnedMeshCount = 0;
  gltf.scene.traverse((object) => {
    if (object instanceof SkinnedMesh) skinnedMeshCount += 1;
  });
  if (skinnedMeshCount === 0) throw new Error("Quaternius horse does not contain a skinned mesh");

  const clipNames = new Set(gltf.animations.map(({ name }) => name));
  const missingClips = QUATERNIUS_HORSE_REFERENCE_CLIPS.filter((name) => !clipNames.has(name));
  if (missingClips.length > 0) {
    throw new Error(`Quaternius horse is missing reference clips: ${missingClips.join(", ")}`);
  }
}
