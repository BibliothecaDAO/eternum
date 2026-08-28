import type { HumanoidRigAdapterId } from "./humanoid-rig-adapters";

export type ProceduralCharacterAppearanceId = "modular-fantasy" | "universal-base";
export type ProceduralCharacterAssetId = "base" | "peasant" | "ranger";
type ProceduralCharacterAppearanceTier = 1 | 2 | 3;

export interface ProceduralCharacterAppearanceDefinition {
  assetByTier: Readonly<Record<ProceduralCharacterAppearanceTier, ProceduralCharacterAssetId>>;
  id: ProceduralCharacterAppearanceId;
  label: string;
  materials: ProceduralCharacterMaterialProfile;
  rigAdapterId: HumanoidRigAdapterId;
}

export interface ProceduralCharacterMaterialProfile {
  body: RegExp;
  crowdHiddenMesh: RegExp;
  mergeableOutfit: RegExp;
  outfit: RegExp;
}

const QUATERNIUS_MATERIAL_PROFILE: ProceduralCharacterMaterialProfile = {
  body: /regular|eyes|hair/i,
  crowdHiddenMesh: /(?:^|_)(?:Eyebrows|Eyes)(?:$|_)|Acc_Pauldron|Arms_Bracer|Body_Belt/i,
  mergeableOutfit: /^MI_(?:Peasant|Ranger)$/i,
  outfit: /ranger|peasant/i,
};

export const DEFAULT_PROCEDURAL_CHARACTER_APPEARANCE_ID: ProceduralCharacterAppearanceId = "modular-fantasy";

export const PROCEDURAL_CHARACTER_APPEARANCES: readonly ProceduralCharacterAppearanceDefinition[] = [
  {
    assetByTier: { 1: "base", 2: "peasant", 3: "ranger" },
    id: "modular-fantasy",
    label: "Modular fantasy outfits",
    materials: QUATERNIUS_MATERIAL_PROFILE,
    rigAdapterId: "quaternius-universal",
  },
  {
    assetByTier: { 1: "base", 2: "base", 3: "base" },
    id: "universal-base",
    label: "Universal base body",
    materials: QUATERNIUS_MATERIAL_PROFILE,
    rigAdapterId: "quaternius-universal",
  },
];

const APPEARANCE_BY_ID = Object.fromEntries(
  PROCEDURAL_CHARACTER_APPEARANCES.map((appearance) => [appearance.id, appearance]),
) as Record<ProceduralCharacterAppearanceId, ProceduralCharacterAppearanceDefinition>;

export function normalizeProceduralCharacterAppearanceId(value: unknown): ProceduralCharacterAppearanceId {
  if (typeof value === "string" && Object.hasOwn(APPEARANCE_BY_ID, value)) {
    return value as ProceduralCharacterAppearanceId;
  }
  if (value !== undefined && value !== null) {
    console.warn(
      `Unknown procedural character appearance "${String(value)}"; using "${DEFAULT_PROCEDURAL_CHARACTER_APPEARANCE_ID}"`,
    );
  }
  return DEFAULT_PROCEDURAL_CHARACTER_APPEARANCE_ID;
}

export function resolveProceduralCharacterAppearance(
  id: ProceduralCharacterAppearanceId,
): ProceduralCharacterAppearanceDefinition {
  return APPEARANCE_BY_ID[id];
}

export function resolveProceduralCharacterAppearanceAssetId(
  id: ProceduralCharacterAppearanceId,
  tier: ProceduralCharacterAppearanceTier,
): ProceduralCharacterAssetId {
  return resolveProceduralCharacterAppearance(id).assetByTier[tier];
}
