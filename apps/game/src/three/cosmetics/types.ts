import type { TroopTier, TroopType, StructureType } from "@bibliothecadao/types";
import type { Euler, Vector3 } from "three";
import type { ModelType } from "../types/army";

export type CosmeticCategory = "army-skin" | "structure-skin" | "attachment";

export enum CosmeticTraitType {
  RealmAura = 2,
  RealmSkin = 3,
  TroopAura = 4,
  TroopPrimary = 5,
  TroopSecondary = 6,
  TroopArmor = 7,
  TroopBase = 8,
}

export interface CosmeticAttachmentTemplate {
  /** Identifier for lookup (e.g. aura, banner). */
  id: string;
  /** Optional asset pointer (texture, gltf) relative to public/assets. */
  assetPath?: string;
  /** Default scale applied when the attachment spawns. */
  scale?: number;
  /** Offset from the owning entity origin. */
  offset?: [number, number, number];
  /** Optional rotation in radians. */
  rotation?: [number, number, number];
  /** When true the attachment persists for the entity lifetime. */
  persistent?: boolean;
  /** Mount point or bone name used by the attachment manager (e.g. "weapon_r"). */
  mountPoint?: string;
  /** Logical slot for mutual exclusivity (e.g. "weapon", "back"). */
  slot?: string;
}

export interface AttachmentTransform {
  position: Vector3;
  rotation?: Euler;
  scale?: Vector3;
}

export interface CosmeticRegistryEntry {
  id: string;
  category: CosmeticCategory;
  /** Base entities that can use this cosmetic (e.g. troop types). */
  appliesTo: string[];
  /** Primary GLTF or texture assets that need to be preloaded. */
  assetPaths: string[];
  /** Optional attachment templates to spawn with the entity. */
  attachments?: CosmeticAttachmentTemplate[];
  /** Optional metadata for downstream systems (FX intensity etc.). */
  metadata?: Record<string, unknown>;
  /** Attachment slot enforced for category `attachment`. */
  attachmentSlot?: string;
  /** Normalized ownership keys that unlock this cosmetic at runtime. */
  ownershipKeys?: string[];
}

export interface ArmyCosmeticParams {
  owner: string | bigint | undefined;
  troopType: TroopType;
  tier: TroopTier;
  defaultModelType: ModelType;
}

export interface StructureCosmeticParams {
  owner: string | bigint | undefined;
  structureType: StructureType;
  stage?: number;
  defaultModelKey: string;
}

export interface ResolvedCosmeticSkin {
  cosmeticId: string;
  assetPaths: string[];
  isFallback: boolean;
  modelType?: ModelType;
  modelKey?: string;
  registryEntry?: CosmeticRegistryEntry;
}

export interface CosmeticResolutionResult {
  skin: ResolvedCosmeticSkin;
  attachments: CosmeticAttachmentTemplate[];
  metadata?: Record<string, unknown>;
}
