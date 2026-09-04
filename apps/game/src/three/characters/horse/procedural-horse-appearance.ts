import type { HorseRigAdapterId } from "./horse-rig-adapters";

export type ProceduralHorseAppearanceId = "quaternius";
export type ProceduralHorseAssetId = "quaternius-horse";
type ProceduralHorseAppearanceTier = 1 | 2 | 3;

export interface ProceduralHorseMaterialProfile {
  coat: RegExp;
  dark: RegExp;
  light: RegExp;
}

export interface ProceduralHorseAppearanceDefinition {
  assetByTier: Readonly<Record<ProceduralHorseAppearanceTier, ProceduralHorseAssetId>>;
  id: ProceduralHorseAppearanceId;
  label: string;
  materials: ProceduralHorseMaterialProfile;
  rigAdapterId: HorseRigAdapterId;
}

const QUATERNIUS_MATERIAL_PROFILE: ProceduralHorseMaterialProfile = {
  coat: /^main$/i,
  dark: /dark/i,
  light: /light/i,
};

export const DEFAULT_PROCEDURAL_HORSE_APPEARANCE_ID: ProceduralHorseAppearanceId = "quaternius";

export const PROCEDURAL_HORSE_APPEARANCES: readonly ProceduralHorseAppearanceDefinition[] = [
  {
    assetByTier: { 1: "quaternius-horse", 2: "quaternius-horse", 3: "quaternius-horse" },
    id: "quaternius",
    label: "Quaternius Animated Animal",
    materials: QUATERNIUS_MATERIAL_PROFILE,
    rigAdapterId: "quaternius-horse",
  },
];

const APPEARANCE_BY_ID = Object.fromEntries(
  PROCEDURAL_HORSE_APPEARANCES.map((appearance) => [appearance.id, appearance]),
) as Record<ProceduralHorseAppearanceId, ProceduralHorseAppearanceDefinition>;

export function normalizeProceduralHorseAppearanceId(value: unknown): ProceduralHorseAppearanceId {
  if (typeof value === "string" && Object.hasOwn(APPEARANCE_BY_ID, value)) {
    return value as ProceduralHorseAppearanceId;
  }
  if (value !== undefined && value !== null) {
    console.warn(
      `Unknown procedural horse appearance "${String(value)}"; using "${DEFAULT_PROCEDURAL_HORSE_APPEARANCE_ID}"`,
    );
  }
  return DEFAULT_PROCEDURAL_HORSE_APPEARANCE_ID;
}

export function resolveProceduralHorseAppearance(id: ProceduralHorseAppearanceId): ProceduralHorseAppearanceDefinition {
  return APPEARANCE_BY_ID[id];
}

export function resolveProceduralHorseAppearanceAssetId(
  id: ProceduralHorseAppearanceId,
  tier: ProceduralHorseAppearanceTier,
): ProceduralHorseAssetId {
  return resolveProceduralHorseAppearance(id).assetByTier[tier];
}
