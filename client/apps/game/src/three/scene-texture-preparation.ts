import type { FrameBudgetWorkScheduler } from "./frame-budget-work-queue";
import { runWithFrameWorkOwner } from "./frame-work-owner";
import { Material, Object3D, Scene, Texture } from "three";

interface PrepareSceneTexturesInput {
  initializeTexture: (texture: Texture) => void;
  owner: string;
  preparedTextures: WeakSet<Texture>;
  scene: Object3D;
  scheduler: FrameBudgetWorkScheduler;
  warn?: (message: string, error: unknown) => void;
}

export async function prepareSceneTextures(input: PrepareSceneTexturesInput): Promise<number> {
  const pendingTextures = collectSceneTextures(input.scene).filter((texture) => !input.preparedTextures.has(texture));

  await Promise.all(
    pendingTextures.map((texture) =>
      runWithFrameWorkOwner(input.owner, () =>
        input.scheduler.schedule("visible", () => initializeSceneTexture(input, texture)),
      ),
    ),
  );

  return pendingTextures.length;
}

function initializeSceneTexture(input: PrepareSceneTexturesInput, texture: Texture): void {
  try {
    input.initializeTexture(texture);
    input.preparedTextures.add(texture);
  } catch (error) {
    input.warn?.(`[GpuBackendPerf] Failed to prepare scene texture ${resolveTextureName(texture)}`, error);
  }
}

function collectSceneTextures(scene: Object3D): Texture[] {
  const textures = new Map<string, Texture>();
  collectSceneEnvironmentTextures(scene, textures);
  scene.traverse((object) => {
    if (!("material" in object)) {
      return;
    }

    const material = object.material;
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((entry) => collectMaterialTextures(entry, textures));
  });
  return [...textures.values()];
}

function collectSceneEnvironmentTextures(scene: Object3D, textures: Map<string, Texture>): void {
  if (!(scene instanceof Scene)) {
    return;
  }
  addTexture(scene.background, textures);
  addTexture(scene.environment, textures);
}

function collectMaterialTextures(candidate: unknown, textures: Map<string, Texture>): void {
  if (!(candidate instanceof Material)) {
    return;
  }

  Object.values(candidate).forEach((value) => addTexture(value, textures));
  Object.values(candidate.userData ?? {}).forEach((value) => addTexture(value, textures));
}

function addTexture(candidate: unknown, textures: Map<string, Texture>): void {
  if (candidate instanceof Texture) {
    textures.set(candidate.uuid, candidate);
  }
}

function resolveTextureName(texture: Texture): string {
  return texture.name.trim() || texture.uuid;
}
