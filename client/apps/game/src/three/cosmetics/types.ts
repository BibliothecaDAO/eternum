export type CosmeticCategory = "army-skin" | "structure-skin" | "attachment";

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
}

export interface PlayerCosmeticSelection {
  armies?: Record<string, string>; // key: troopType|tier, value: cosmeticId
  structures?: Record<string, string>; // key: structureType|stage, value: cosmeticId
  attachments?: string[]; // global attachments (auras etc.)
  tokens?: string[]; // raw cosmetic token ids (hex strings)
}

export interface PlayerCosmeticsSnapshot {
  owner: string; // ContractAddress serialized as hex string
  version: number;
  selection: PlayerCosmeticSelection;
}

export interface CosmeticResolutionParams {
  owner: string;
  kind: "army" | "structure";
  baseType: string;
  variant?: string;
}

export interface CosmeticResolutionResult {
  modelKey: string;
  attachments: CosmeticAttachmentTemplate[];
  metadata?: Record<string, unknown>;
}
