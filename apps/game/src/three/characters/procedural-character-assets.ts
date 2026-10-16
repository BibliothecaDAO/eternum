import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

import { resolveHumanoidRigAdapter, type HumanoidRigAdapterId } from "./humanoid-rig-adapters";
import type { HumanoidRigAdapter } from "./humanoid-rig-adapter";
import {
  resolveProceduralCharacterAppearance,
  resolveProceduralCharacterAppearanceAssetId,
  type ProceduralCharacterAppearanceId,
  type ProceduralCharacterAssetId,
  type ProceduralCharacterMaterialProfile,
} from "./procedural-character-appearance";
import type { ProceduralCharacterRenderDetail, ProceduralCharacterTier } from "./procedural-character-config";
import { loadT1KnightDefaultCharacterAssetTemplate } from "./t1-knight-default-character-assets";
import { loadQuaterniusCharacterAssetTemplates } from "./quaternius-character-assets";
import { disposeSkinnedSceneTemplates, instantiateSkinnedScene } from "./skinned-asset-resources";

export interface ProceduralCharacterAssetDefinition {
  adapterId: HumanoidRigAdapterId;
  id: ProceduralCharacterAssetId;
  label: string;
  url: string;
}

export interface LoadedProceduralCharacterAssetTemplate extends ProceduralCharacterAssetDefinition {
  gltf: GLTF;
}

export interface LoadedProceduralCharacterAsset {
  adapter: HumanoidRigAdapter;
  adapterId: HumanoidRigAdapterId;
  appearanceId: ProceduralCharacterAppearanceId;
  appearanceLabel: string;
  gltf: GLTF;
  id: ProceduralCharacterAssetId;
  label: string;
  materials: ProceduralCharacterMaterialProfile;
  tier: ProceduralCharacterTier;
  url: string;
}

/**
 * Owns decoded model templates. Actors receive one independently posed model
 * at a time while immutable geometry and textures remain shared.
 */
export class ProceduralCharacterLibrary {
  private disposed = false;
  private readonly pending = new Map<ProceduralCharacterAssetId, Promise<void>>();
  private readonly templates: Map<ProceduralCharacterAssetId, LoadedProceduralCharacterAssetTemplate>;

  public constructor(templates: readonly LoadedProceduralCharacterAssetTemplate[]) {
    this.templates = new Map(templates.map((template) => [template.id, template]));
    if (this.templates.size !== templates.length) throw new Error("Procedural character asset ids must be unique");
  }

  public isReady(config: {
    appearanceId: ProceduralCharacterAppearanceId;
    tier: ProceduralCharacterTier;
    renderDetail: ProceduralCharacterRenderDetail;
  }): boolean {
    return this.templates.has(
      resolveProceduralCharacterAppearanceAssetId(config.appearanceId, config.tier, config.renderDetail),
    );
  }

  public async prepare(config: {
    appearanceId: ProceduralCharacterAppearanceId;
    tier: ProceduralCharacterTier;
    renderDetail: ProceduralCharacterRenderDetail;
  }): Promise<void> {
    if (this.disposed) throw new Error("Cannot prepare a disposed character library");
    if (this.isReady(config)) return;
    const id = resolveProceduralCharacterAppearanceAssetId(config.appearanceId, config.tier, config.renderDetail);
    if (config.appearanceId !== "t1-knight-default") throw new Error(`Missing character template ${id}`);
    let pending = this.pending.get(id);
    if (!pending) {
      pending = loadT1KnightDefaultCharacterAssetTemplate(config.renderDetail)
        .then((template) => {
          if (this.disposed) {
            disposeSkinnedSceneTemplates([template.gltf.scene]);
            throw new Error("Character library closed during loading");
          }
          this.templates.set(id, template);
        })
        .finally(() => this.pending.delete(id));
      this.pending.set(id, pending);
    }
    await pending;
  }

  public instantiate(
    appearanceId: ProceduralCharacterAppearanceId,
    tier: ProceduralCharacterTier,
    renderDetail: ProceduralCharacterRenderDetail = "hero",
  ): LoadedProceduralCharacterAsset {
    if (this.disposed) throw new Error("Cannot instantiate a disposed procedural character library");
    const appearance = resolveProceduralCharacterAppearance(appearanceId);
    const assetId = resolveProceduralCharacterAppearanceAssetId(appearanceId, tier, renderDetail);
    const template = this.templates.get(assetId);
    if (!template) throw new Error(`Appearance ${appearance.label} requires missing character asset "${assetId}"`);
    if (template.adapterId !== appearance.rigAdapterId) {
      throw new Error(
        `Appearance ${appearance.label} expects ${appearance.rigAdapterId}, but ${template.label} uses ${template.adapterId}`,
      );
    }
    const scene = instantiateSkinnedScene(template.gltf.scene);
    return {
      ...template,
      adapter: resolveHumanoidRigAdapter(template.adapterId),
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

export async function loadProceduralCharacterLibrary(): Promise<ProceduralCharacterLibrary> {
  return new ProceduralCharacterLibrary(await loadQuaterniusCharacterAssetTemplates());
}
