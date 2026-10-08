import { getCosmeticAsset, loadCosmeticAsset } from "@/three/cosmetics/asset-cache";
import { findCosmeticById } from "@/three/cosmetics/registry";
import { Box3, Group, Mesh, SkinnedMesh, Vector3 } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";

import { disposeSkinnedSceneTemplates } from "../skinned-asset-resources";

import {
  PROCEDURAL_MELEE_OFFHANDS,
  PROCEDURAL_MELEE_WEAPONS,
  resolveProceduralMeleeOffhand,
  resolveProceduralMeleeWeapon,
  type ProceduralMeleeOffhandId,
  type ProceduralMeleeAssetAlignment,
  type ProceduralMeleeWeaponId,
} from "./procedural-melee-weapon-catalog";

export type ProceduralMeleeEquipmentSource = "asset" | "procedural";

export interface ProceduralMeleeAssetInstance {
  object: Group;
  source: "asset";
}

const scratchBounds = new Box3();
const scratchSize = new Vector3();
type FittedGearId = ProceduralMeleeWeaponId | ProceduralMeleeOffhandId;

/** Asset data: the file of each piece of gear the catalog marks as fitted to a rig. */
const FITTED_GEAR_FILES: Readonly<Partial<Record<FittedGearId, string>>> = {
  "t1-knight-default-sword": "/models/characters/t1-knight-default/near/sword.glb",
  "t1-knight-default-shield": "/models/characters/t1-knight-default/near/shield.glb",
};
const FITTED_GEAR_IDS: readonly FittedGearId[] = [...PROCEDURAL_MELEE_WEAPONS, ...PROCEDURAL_MELEE_OFFHANDS]
  .filter(({ fittedRigAdapterId }) => fittedRigAdapterId !== undefined)
  .map(({ id }) => id);

/**
 * Hands out shallow scene clones of melee equipment. Registered cosmetic assets are loaded by, and stay owned by, the
 * global cosmetic asset cache. Gear fitted to a rig (the T1 Knight Default's sword and shield) is not registered: this
 * library loads it itself, only when asked, and disposes it. Actors own only their clone hierarchy.
 */
export class ProceduralMeleeWeaponLibrary {
  private disposed = false;

  private constructor(private readonly fittedTemplates: ReadonlyMap<FittedGearId, GLTF>) {}

  public static async create(
    options: { includeT1KnightDefault?: boolean } = {},
  ): Promise<ProceduralMeleeWeaponLibrary> {
    const fittedTemplates = new Map<FittedGearId, GLTF>();
    try {
      if (options.includeT1KnightDefault) {
        for (const id of FITTED_GEAR_IDS) fittedTemplates.set(id, await loadKnightGear(resolveFittedGearFile(id), id));
      }
      return new ProceduralMeleeWeaponLibrary(fittedTemplates);
    } catch (error) {
      disposeSkinnedSceneTemplates([...fittedTemplates.values()].map(({ scene }) => scene));
      throw error;
    }
  }

  public isWeaponReady(id: ProceduralMeleeWeaponId): boolean {
    this.assertActive();
    if (isFittedGearId(id)) return this.fittedTemplates.has(id);
    return isRegisteredAssetReady(resolveProceduralMeleeWeapon(id).registryEntryId);
  }

  public isOffhandReady(id: ProceduralMeleeOffhandId): boolean {
    this.assertActive();
    if (isFittedGearId(id)) return this.fittedTemplates.has(id);
    return isRegisteredAssetReady(resolveProceduralMeleeOffhand(id).registryEntryId);
  }

  public assertFittedLoadoutAvailable(loadout: {
    detailedEquipment: boolean;
    offhandId: ProceduralMeleeOffhandId;
    weaponId: ProceduralMeleeWeaponId;
  }): void {
    this.assertActive();
    if (!loadout.detailedEquipment) return;
    for (const id of [loadout.weaponId, loadout.offhandId]) {
      if (isFittedGearId(id) && !this.fittedTemplates.has(id)) {
        throw new Error(`Knight gear ${id} was not loaded`);
      }
    }
  }

  public instantiateWeapon(id: ProceduralMeleeWeaponId): ProceduralMeleeAssetInstance | undefined {
    this.assertActive();
    const definition = resolveProceduralMeleeWeapon(id);
    if (isFittedGearId(id)) return this.instantiateFitted(id, `melee-weapon:${id}`, definition.assetAlignment);
    return instantiateRegisteredAsset(
      definition.registryEntryId,
      definition.visualLength,
      `melee-weapon:${id}`,
      definition.assetAlignment,
    );
  }

  public instantiateOffhand(id: ProceduralMeleeOffhandId): ProceduralMeleeAssetInstance | undefined {
    this.assertActive();
    const definition = resolveProceduralMeleeOffhand(id);
    if (isFittedGearId(id)) return this.instantiateFitted(id, `melee-offhand:${id}`, definition.assetAlignment);
    return instantiateRegisteredAsset(
      definition.registryEntryId,
      definition.visualDiameter,
      `melee-offhand:${id}`,
      definition.assetAlignment,
    );
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    disposeSkinnedSceneTemplates([...this.fittedTemplates.values()].map(({ scene }) => scene));
  }

  private instantiateFitted(
    id: FittedGearId,
    name: string,
    alignment: ProceduralMeleeAssetAlignment | undefined,
  ): ProceduralMeleeAssetInstance {
    const template = this.fittedTemplates.get(id);
    if (!template) throw new Error(`Knight gear ${id} was not loaded`);
    const clone = template.scene.clone(true);
    setEquipmentShadows(clone);
    const wrapper = new Group();
    wrapper.name = name;
    const aligned = new Group();
    if (alignment?.rotation) aligned.rotation.fromArray([...alignment.rotation]);
    aligned.add(clone);
    wrapper.add(aligned);
    return { object: wrapper, source: "asset" };
  }

  private assertActive(): void {
    if (this.disposed) throw new Error("Cannot use a disposed procedural melee weapon library");
  }
}

async function loadKnightGear(url: string, id: FittedGearId): Promise<GLTF> {
  const gltf = await new GLTFLoader().loadAsync(url);
  try {
    validateKnightGear(gltf, id);
    return gltf;
  } catch (error) {
    disposeSkinnedSceneTemplates([gltf.scene]);
    throw error;
  }
}

export function validateKnightGear(gltf: Pick<GLTF, "animations" | "scene">, id: FittedGearId): void {
  if (gltf.animations.length > 0) throw new Error(`${id} must be clip-free`);
  let meshCount = 0;
  let skinnedMeshCount = 0;
  gltf.scene.traverse((object) => {
    if (object instanceof SkinnedMesh) skinnedMeshCount += 1;
    if (object instanceof Mesh) meshCount += 1;
  });
  if (meshCount === 0) throw new Error(`${id} has no mesh`);
  if (skinnedMeshCount > 0) throw new Error(`${id} must be rigid, not skinned`);
}

function isFittedGearId(id: FittedGearId): boolean {
  return FITTED_GEAR_IDS.includes(id);
}

function resolveFittedGearFile(id: FittedGearId): string {
  const file = FITTED_GEAR_FILES[id];
  if (!file) throw new Error(`Gear ${id} is fitted to a rig but has no asset file`);
  return file;
}

function instantiateRegisteredAsset(
  registryEntryId: string | undefined,
  targetLongestDimension: number,
  name: string,
  alignment: ProceduralMeleeAssetAlignment | undefined,
): ProceduralMeleeAssetInstance | undefined {
  if (!registryEntryId) return undefined;
  const handle = getCosmeticAsset(registryEntryId);
  const sourceScene = handle?.status === "ready" ? handle.payload.gltfs[0]?.scene : undefined;
  if (!sourceScene) {
    const entry = findCosmeticById(registryEntryId);
    if (entry && handle?.status !== "failed") void loadCosmeticAsset(entry).catch(() => undefined);
    return undefined;
  }

  const clone = sourceScene.clone(true);
  clone.updateWorldMatrix(true, true);
  scratchBounds.setFromObject(clone);
  scratchBounds.getSize(scratchSize);
  const longestDimension = Math.max(scratchSize.x, scratchSize.y, scratchSize.z);
  const wrapper = new Group();
  const aligned = new Group();
  wrapper.name = name;
  const scale = longestDimension > 1e-5 ? targetLongestDimension / longestDimension : 1;
  const pivot = resolveAssetPivot(scratchBounds, alignment);
  clone.position.sub(pivot);
  aligned.scale.setScalar(scale);
  if (alignment?.rotation) aligned.rotation.fromArray([...alignment.rotation]);
  setEquipmentShadows(clone);
  aligned.add(clone);
  wrapper.add(aligned);
  return { object: wrapper, source: "asset" };
}

function isRegisteredAssetReady(registryEntryId: string | undefined): boolean {
  if (!registryEntryId) return false;
  const handle = getCosmeticAsset(registryEntryId);
  return handle?.status === "ready" && Boolean(handle.payload.gltfs[0]?.scene);
}

function resolveAssetPivot(bounds: Box3, alignment: ProceduralMeleeAssetAlignment | undefined): Vector3 {
  if (alignment?.pivot === "authored") return new Vector3();
  const center = bounds.getCenter(new Vector3());
  if (!alignment || alignment.pivot === "center") return center;
  const axis = alignment.axis ?? "y";
  center[axis] = alignment.pivot === "axis-max" ? bounds.max[axis] : bounds.min[axis];
  return center;
}

function setEquipmentShadows(scene: Group): void {
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
}
