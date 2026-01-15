import type { TroopTier, TroopType, StructureType } from "@bibliothecadao/types";
import type { Euler, Vector3 } from "three";
import type { ModelType } from "../types/army";

export type CosmeticCategory = "army-skin" | "structure-skin" | "attachment";

export enum CosmeticTraitType {
  RealmTitle = 1,
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
  /** Optional graphics tier guardrail (e.g. "low", "medium", "high"). */
  minGraphicsTier?: "low" | "medium" | "high";
  /** Attachment slot enforced for category `attachment`. */
  attachmentSlot?: string;
}

export interface ArmyCosmeticSelection {
  skin?: string;
  attachments?: string[];
}

export interface StructureCosmeticSelection {
  skin?: string;
  attachments?: string[];
}

export interface PlayerCosmeticSelection {
  armies?: Record<string, ArmyCosmeticSelection>; // key: troopType|tier -> selection
  structures?: Record<string, StructureCosmeticSelection>; // key: structureType|stage -> selection
  globalAttachments?: string[]; // cosmetics applied to every entity (auras etc.)
  tokens?: string[]; // raw cosmetic token ids (hex strings)
}

export interface PlayerCosmeticsSnapshot {
  owner: string; // ContractAddress serialized as hex string
  version: number;
  selection: PlayerCosmeticSelection;
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

export interface CosmeticResolutionResult {
  cosmeticId: string;
  modelKey: string;
  modelType?: ModelType;
  attachments: CosmeticAttachmentTemplate[];
  registryEntry?: CosmeticRegistryEntry;
  metadata?: Record<string, unknown>;
}
