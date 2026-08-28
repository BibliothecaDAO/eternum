import { getCosmeticAsset, loadCosmeticAsset } from "@/three/cosmetics/asset-cache";
import { findCosmeticById } from "@/three/cosmetics/registry";
import { Box3, Group, Mesh, Vector3 } from "three";

import {
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

/**
 * Preloads registered cosmetic equipment once, then returns shallow scene
 * clones. Geometry and pooled materials stay owned by the global cosmetic
 * asset cache; actors own only their clone hierarchy.
 */
export class ProceduralMeleeWeaponLibrary {
  private constructor() {}

  public static async create(): Promise<ProceduralMeleeWeaponLibrary> {
    return new ProceduralMeleeWeaponLibrary();
  }

  public isWeaponReady(id: ProceduralMeleeWeaponId): boolean {
    return isRegisteredAssetReady(resolveProceduralMeleeWeapon(id).registryEntryId);
  }

  public isOffhandReady(id: ProceduralMeleeOffhandId): boolean {
    return isRegisteredAssetReady(resolveProceduralMeleeOffhand(id).registryEntryId);
  }

  public instantiateWeapon(id: ProceduralMeleeWeaponId): ProceduralMeleeAssetInstance | undefined {
    const definition = resolveProceduralMeleeWeapon(id);
    return instantiateRegisteredAsset(
      definition.registryEntryId,
      definition.visualLength,
      `melee-weapon:${id}`,
      definition.assetAlignment,
    );
  }

  public instantiateOffhand(id: ProceduralMeleeOffhandId): ProceduralMeleeAssetInstance | undefined {
    const definition = resolveProceduralMeleeOffhand(id);
    return instantiateRegisteredAsset(
      definition.registryEntryId,
      definition.visualDiameter,
      `melee-offhand:${id}`,
      definition.assetAlignment,
    );
  }
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
  clone.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
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
  const center = bounds.getCenter(new Vector3());
  if (!alignment || alignment.pivot === "center") return center;
  const axis = alignment.axis ?? "y";
  center[axis] = alignment.pivot === "axis-max" ? bounds.max[axis] : bounds.min[axis];
  return center;
}
