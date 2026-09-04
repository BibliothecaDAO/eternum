import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

import { disposeSkinnedSceneTemplates, instantiateSkinnedScene } from "../skinned-asset-resources";
import type { ProceduralCharacterTier } from "../procedural-character-config";
import type { HorseRigAdapter } from "./horse-rig-adapter";
import { resolveHorseRigAdapter, type HorseRigAdapterId } from "./horse-rig-adapters";
import {
  resolveProceduralHorseAppearance,
  resolveProceduralHorseAppearanceAssetId,
  type ProceduralHorseAppearanceId,
  type ProceduralHorseAssetId,
  type ProceduralHorseMaterialProfile,
} from "./procedural-horse-appearance";
import { loadQuaterniusHorseAssetTemplates } from "./quaternius-horse-assets";

export interface ProceduralHorseAssetDefinition {
  adapterId: HorseRigAdapterId;
  id: ProceduralHorseAssetId;
  label: string;
  scale: number;
  url: string;
}

export interface LoadedProceduralHorseAssetTemplate extends ProceduralHorseAssetDefinition {
  gltf: GLTF;
}

export interface LoadedProceduralHorseAsset {
  adapter: HorseRigAdapter;
  adapterId: HorseRigAdapterId;
  appearanceId: ProceduralHorseAppearanceId;
  appearanceLabel: string;
  gltf: GLTF;
  id: ProceduralHorseAssetId;
  label: string;
  materials: ProceduralHorseMaterialProfile;
  scale: number;
  tier: ProceduralCharacterTier;
  url: string;
}

/** Owns decoded horse templates while actors retain independent pose and material state. */
export class ProceduralHorseLibrary {
  private disposed = false;
  private readonly templates: ReadonlyMap<ProceduralHorseAssetId, LoadedProceduralHorseAssetTemplate>;

  public constructor(templates: readonly LoadedProceduralHorseAssetTemplate[]) {
    this.templates = new Map(templates.map((template) => [template.id, template]));
    if (this.templates.size !== templates.length) throw new Error("Procedural horse asset ids must be unique");
  }

  public instantiate(
    appearanceId: ProceduralHorseAppearanceId,
    tier: ProceduralCharacterTier,
  ): LoadedProceduralHorseAsset {
    if (this.disposed) throw new Error("Cannot instantiate a disposed procedural horse library");
    const appearance = resolveProceduralHorseAppearance(appearanceId);
    const assetId = resolveProceduralHorseAppearanceAssetId(appearanceId, tier);
    const template = this.templates.get(assetId);
    if (!template) throw new Error(`Appearance ${appearance.label} requires missing horse asset "${assetId}"`);
    if (!Number.isFinite(template.scale) || template.scale <= 0) {
      throw new Error(`Horse asset ${template.label} has invalid scene scale ${template.scale}`);
    }
    if (template.adapterId !== appearance.rigAdapterId) {
      throw new Error(
        `Appearance ${appearance.label} expects ${appearance.rigAdapterId}, but ${template.label} uses ${template.adapterId}`,
      );
    }
    const scene = instantiateSkinnedScene(template.gltf.scene);
    return {
      ...template,
      adapter: resolveHorseRigAdapter(template.adapterId),
      appearanceId,
      appearanceLabel: appearance.label,
      gltf: { ...template.gltf, scene, scenes: [scene] },
      materials: appearance.materials,
      tier,
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    disposeSkinnedSceneTemplates([...this.templates.values()].map(({ gltf }) => gltf.scene));
  }
}

export async function loadProceduralHorseLibrary(): Promise<ProceduralHorseLibrary> {
  return new ProceduralHorseLibrary(await loadQuaterniusHorseAssetTemplates());
}
