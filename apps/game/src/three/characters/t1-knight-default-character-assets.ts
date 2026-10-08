import { Bone, SkinnedMesh } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";

import { resolveHumanoidRigRequiredBoneNames } from "./humanoid-rig-adapter";
import { T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER } from "./t1-knight-default-humanoid-rig-adapter";
import type {
  LoadedProceduralCharacterAssetTemplate,
  ProceduralCharacterAssetDefinition,
} from "./procedural-character-assets";
import { disposeSkinnedSceneTemplates } from "./skinned-asset-resources";

const T1_KNIGHT_DEFAULT_NEAR = {
  adapterId: "t1-knight-default",
  id: "t1-knight-default-near",
  label: "T1 Knight Default near",
  url: "/models/characters/t1-knight-default/near/skin.glb",
} as const satisfies ProceduralCharacterAssetDefinition;

const T1_KNIGHT_DEFAULT_MID = {
  ...T1_KNIGHT_DEFAULT_NEAR,
  id: "t1-knight-default-mid",
  label: "T1 Knight Default mid",
  url: "/models/characters/t1-knight-default/mid/skin.glb",
} as const satisfies ProceduralCharacterAssetDefinition;

export async function loadT1KnightDefaultCharacterAssetTemplates(): Promise<LoadedProceduralCharacterAssetTemplate[]> {
  const loaded: LoadedProceduralCharacterAssetTemplate[] = [];
  try {
    for (const asset of [T1_KNIGHT_DEFAULT_NEAR, T1_KNIGHT_DEFAULT_MID]) {
      const gltf = await new GLTFLoader().loadAsync(asset.url);
      loaded.push({ ...asset, gltf });
      validateT1KnightDefaultCharacterAsset(gltf, asset.id);
    }
    return loaded;
  } catch (error) {
    disposeSkinnedSceneTemplates(loaded.map(({ gltf }) => gltf.scene));
    throw error;
  }
}

export function validateT1KnightDefaultCharacterAsset(gltf: Pick<GLTF, "animations" | "scene">, id: string): void {
  if (gltf.animations.length > 0) throw new Error(`${id} must be clip-free`);
  const missing = resolveHumanoidRigRequiredBoneNames(T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER).filter(
    (name) => !(gltf.scene.getObjectByName(name) instanceof Bone),
  );
  if (missing.length > 0) throw new Error(`${id} is missing Knight bones: ${missing.join(", ")}`);
  let skinned = false;
  gltf.scene.traverse((object) => {
    if (object instanceof SkinnedMesh) skinned = true;
  });
  if (!skinned) throw new Error(`${id} has no skinned surface`);
}
