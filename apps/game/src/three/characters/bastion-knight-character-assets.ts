import { Bone, SkinnedMesh } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";

import { resolveHumanoidRigRequiredBoneNames } from "./humanoid-rig-adapter";
import { BASTION_KNIGHT_HUMANOID_RIG_ADAPTER } from "./bastion-knight-humanoid-rig-adapter";
import type {
  LoadedProceduralCharacterAssetTemplate,
  ProceduralCharacterAssetDefinition,
} from "./procedural-character-assets";
import { disposeSkinnedSceneTemplates } from "./skinned-asset-resources";

const BASTION_KNIGHT_NEAR = {
  adapterId: "t1-knight-bastion-v1",
  id: "t1-knight-bastion-near",
  label: "T1 Knight default — near",
  url: "/models/characters/t1-knight-default/near/skin.glb",
} as const satisfies ProceduralCharacterAssetDefinition;

const BASTION_KNIGHT_MID = {
  ...BASTION_KNIGHT_NEAR,
  id: "t1-knight-bastion-mid",
  label: "T1 Knight default — mid",
  url: "/models/characters/t1-knight-default/mid/skin.glb",
} as const satisfies ProceduralCharacterAssetDefinition;

export async function loadBastionKnightCharacterAssetTemplates(): Promise<LoadedProceduralCharacterAssetTemplate[]> {
  const loaded: LoadedProceduralCharacterAssetTemplate[] = [];
  try {
    for (const asset of [BASTION_KNIGHT_NEAR, BASTION_KNIGHT_MID]) {
      const gltf = await new GLTFLoader().loadAsync(asset.url);
      loaded.push({ ...asset, gltf });
      validateBastionKnightCharacterAsset(gltf, asset.id);
    }
    return loaded;
  } catch (error) {
    disposeSkinnedSceneTemplates(loaded.map(({ gltf }) => gltf.scene));
    throw error;
  }
}

export function validateBastionKnightCharacterAsset(gltf: Pick<GLTF, "animations" | "scene">, id: string): void {
  if (gltf.animations.length > 0) throw new Error(`${id} must be clip-free`);
  const missing = resolveHumanoidRigRequiredBoneNames(BASTION_KNIGHT_HUMANOID_RIG_ADAPTER).filter(
    (name) => !(gltf.scene.getObjectByName(name) instanceof Bone),
  );
  if (missing.length > 0) throw new Error(`${id} is missing Knight bones: ${missing.join(", ")}`);
  let skinned = false;
  gltf.scene.traverse((object) => {
    if (object instanceof SkinnedMesh) skinned = true;
  });
  if (!skinned) throw new Error(`${id} has no skinned surface`);
}
