import { Bone, SkinnedMesh, type Group } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";

import { disposeSkinnedSceneTemplates, instantiateSkinnedScene } from "../skinned-asset-resources";

export interface LoadedQuaterniusHorseAsset {
  gltf: GLTF;
  label: string;
  url: string;
}

export const QUATERNIUS_HORSE_ASSET = {
  label: "Quaternius horse",
  url: "/models/characters/quaternius-horse/horse.glb",
} as const;

export const QUATERNIUS_HORSE_BONES = {
  root: "Body",
  pelvis: "Back",
  spine: "Torso",
  chest: "Torso2",
  withers: "Torso3",
  neck1: "Neck1",
  neck2: "Neck2",
  neck3: "Neck3",
  head: "Head",
  frontShoulderLeft: "FrontShoulderL",
  frontUpperLeft: "FrontUpperLegL",
  frontLowerLeft: "FrontLowerLegL",
  frontTargetLeft: "IKFrontLegL",
  frontHoofLeft: "FFL",
  frontShoulderRight: "FrontShoulderR",
  frontUpperRight: "FrontUpperLegR",
  frontLowerRight: "FrontLowerLegR",
  frontTargetRight: "IKFrontLegR",
  frontHoofRight: "FFR",
  hindShoulderLeft: "BackShoulderL",
  hindUpperLeft: "BackLegL",
  hindMiddleLeft: "BackUpperLegL",
  hindLowerLeft: "BackLowerLegL",
  hindTargetLeft: "IKBackLegL",
  hindHoofLeft: "FFBL",
  hindShoulderRight: "BackShoulderR",
  hindUpperRight: "BackLegR",
  hindMiddleRight: "BackUpperLegR",
  hindLowerRight: "BackLowerLegR",
  hindTargetRight: "IKBackLegR",
  hindHoofRight: "FFBR",
  tail1: "Tail1",
  tail2: "Tail2",
  tail3: "Tail3",
  tail4: "Tail4",
  tail5: "Tail5",
  tail6: "Tail6",
  tail7: "Tail7",
} as const;

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

const REQUIRED_BONES = Object.values(QUATERNIUS_HORSE_BONES);

export class QuaterniusHorseLibrary {
  private disposed = false;

  private constructor(private readonly template: LoadedQuaterniusHorseAsset) {}

  public static async load(): Promise<QuaterniusHorseLibrary> {
    const gltf = await new GLTFLoader().loadAsync(QUATERNIUS_HORSE_ASSET.url);
    try {
      validateQuaterniusHorse(gltf);
      return new QuaterniusHorseLibrary({ ...QUATERNIUS_HORSE_ASSET, gltf });
    } catch (error) {
      disposeSkinnedSceneTemplates([gltf.scene]);
      throw error;
    }
  }

  public instantiate(): LoadedQuaterniusHorseAsset {
    if (this.disposed) throw new Error("Cannot instantiate a disposed Quaternius horse library");
    const scene = instantiateSkinnedScene(this.template.gltf.scene);
    return {
      ...this.template,
      gltf: {
        ...this.template.gltf,
        scene,
        scenes: [scene],
      },
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    disposeSkinnedSceneTemplates([this.template.gltf.scene]);
  }
}

export function requireQuaterniusHorseBone(scene: Group, name: string): Bone {
  const object = scene.getObjectByName(name);
  if (!(object instanceof Bone)) throw new Error(`Quaternius horse bone ${name} was not found`);
  return object;
}

function validateQuaterniusHorse(gltf: GLTF): void {
  const missingBones = REQUIRED_BONES.filter((name) => !(gltf.scene.getObjectByName(name) instanceof Bone));
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
