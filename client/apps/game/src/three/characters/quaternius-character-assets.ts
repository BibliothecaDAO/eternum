import { Mesh } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";

import type { ProceduralCharacterTier } from "./procedural-character-config";
import { disposeSkinnedSceneTemplates, instantiateSkinnedScene } from "./skinned-asset-resources";

export interface QuaterniusCharacterAssetDefinition {
  id: "base" | "peasant" | "ranger";
  label: string;
  tier: ProceduralCharacterTier;
  url: string;
}

export interface LoadedQuaterniusCharacterAsset extends QuaterniusCharacterAssetDefinition {
  gltf: GLTF;
}

export const QUATERNIUS_CHARACTER_ASSETS: Readonly<
  Record<ProceduralCharacterTier, QuaterniusCharacterAssetDefinition>
> = {
  1: {
    id: "base",
    label: "Universal base",
    tier: 1,
    url: "/models/characters/quaternius/base-male.glb",
  },
  2: {
    id: "peasant",
    label: "Peasant outfit",
    tier: 2,
    url: "/models/characters/quaternius/peasant-male.glb",
  },
  3: {
    id: "ranger",
    label: "Ranger outfit",
    tier: 3,
    url: "/models/characters/quaternius/ranger-male.glb",
  },
};

export const QUATERNIUS_BONE_NAMES = {
  pelvis: "pelvis",
  chest: "spine_01",
  head: "neck_01",
  upperArmLeft: "upperarm_l",
  forearmLeft: "lowerarm_l",
  upperArmRight: "upperarm_r",
  forearmRight: "lowerarm_r",
  thighLeft: "thigh_l",
  shinLeft: "calf_l",
  thighRight: "thigh_r",
  shinRight: "calf_r",
} as const;

export const QUATERNIUS_REQUIRED_BONE_NAMES = [
  "root",
  ...Object.values(QUATERNIUS_BONE_NAMES),
  "spine_02",
  "spine_03",
  "Head",
  "hand_l",
  "hand_r",
  "foot_l",
  "foot_r",
] as const;

async function loadQuaterniusCharacterAssets(): Promise<LoadedQuaterniusCharacterAsset[]> {
  const loader = new GLTFLoader();
  const results = await Promise.allSettled(
    Object.values(QUATERNIUS_CHARACTER_ASSETS).map(async (definition) => {
      const gltf = await loader.loadAsync(definition.url);
      const asset = { ...definition, gltf };
      try {
        validateQuaterniusCharacterAsset(definition, gltf);
        return asset;
      } catch (error) {
        disposeQuaterniusCharacterAssets([asset]);
        throw error;
      }
    }),
  );
  const loadedAssets = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") {
    disposeQuaterniusCharacterAssets(loadedAssets);
    throw failure.reason;
  }
  return loadedAssets;
}

/**
 * Owns one decoded copy of the character set and creates independently posed
 * actors from it. Instances share immutable geometry and textures while bones,
 * skeletons, and materials remain actor-local.
 */
export class QuaterniusCharacterLibrary {
  private disposed = false;

  public constructor(private readonly templates: LoadedQuaterniusCharacterAsset[]) {
    prepareQuaterniusCharacterTemplates(templates);
  }

  public instantiate(): LoadedQuaterniusCharacterAsset[] {
    if (this.disposed) throw new Error("Cannot instantiate a disposed Quaternius character library");
    return this.templates.map(createQuaterniusCharacterInstance);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    disposeQuaterniusCharacterAssets(this.templates);
  }
}

export async function loadQuaterniusCharacterLibrary(): Promise<QuaterniusCharacterLibrary> {
  return new QuaterniusCharacterLibrary(await loadQuaterniusCharacterAssets());
}

export function resolveQuaterniusCharacterAsset(tier: ProceduralCharacterTier): QuaterniusCharacterAssetDefinition {
  return QUATERNIUS_CHARACTER_ASSETS[tier];
}

function validateQuaterniusCharacterAsset(definition: QuaterniusCharacterAssetDefinition, gltf: GLTF): void {
  const missingBones = QUATERNIUS_REQUIRED_BONE_NAMES.filter((boneName) => !gltf.scene.getObjectByName(boneName));
  if (missingBones.length > 0) {
    throw new Error(`${definition.label} is missing required bones: ${missingBones.join(", ")}`);
  }
  if (gltf.animations.length > 0) {
    throw new Error(`${definition.label} unexpectedly contains authored animation clips`);
  }
}

function createQuaterniusCharacterInstance(template: LoadedQuaterniusCharacterAsset): LoadedQuaterniusCharacterAsset {
  const scene = instantiateSkinnedScene(template.gltf.scene);

  return {
    ...template,
    gltf: {
      ...template.gltf,
      scene,
      scenes: [scene],
    },
  };
}

function prepareQuaterniusCharacterTemplates(assets: LoadedQuaterniusCharacterAsset[]): void {
  assets.forEach(({ gltf }) => {
    gltf.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      // Quaternius exports a vertex-color customization channel that Three's
      // WebGPU backend promotes to an invalid `unorm32x4` pipeline format. The
      // authored PBR textures remain the surface-color source, with heraldry
      // applied through actor-local material factors.
      object.geometry.deleteAttribute("color");
    });
  });
}

function disposeQuaterniusCharacterAssets(assets: LoadedQuaterniusCharacterAsset[]): void {
  disposeSkinnedSceneTemplates(assets.map(({ gltf }) => gltf.scene));
}
