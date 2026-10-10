import type { ProceduralCharacterRenderDetail } from "./procedural-character-config";
import type { HumanoidRigAdapterId } from "./humanoid-rig-adapters";
import type { ProceduralUnitKind } from "./procedural-unit-config";

export type ProceduralCharacterAppearanceId = "modular-fantasy" | "universal-base" | "t1-knight-default";
export type ProceduralCharacterAssetId =
  | "base"
  | "peasant"
  | "ranger"
  | "t1-knight-default-near"
  | "t1-knight-default-mid";
type ProceduralCharacterAppearanceTier = 1 | 2 | 3;

export interface ProceduralCharacterAppearanceDefinition {
  assetByTier: Readonly<Record<ProceduralCharacterAppearanceTier, ProceduralCharacterAssetId>>;
  crowdAssetId?: ProceduralCharacterAssetId;
  compatibleKinds?: readonly ProceduralUnitKind[];
  id: ProceduralCharacterAppearanceId;
  label: string;
  materials: ProceduralCharacterMaterialProfile;
  rigAdapterId: HumanoidRigAdapterId;
}

/** Materials told apart by name, restyled and merged by the runtime. */
interface ProceduralCharacterNamedMaterialProfile {
  body: RegExp;
  crowdHiddenMesh: RegExp;
  mergeableOutfit: RegExp;
  outfit: RegExp;
}

/** Authored palette and surface settings are retained as exported. */
interface ProceduralCharacterAuthoredMaterialProfile {
  authoredSource: true;
}

export type ProceduralCharacterMaterialProfile =
  | ProceduralCharacterNamedMaterialProfile
  | ProceduralCharacterAuthoredMaterialProfile;

const QUATERNIUS_MATERIAL_PROFILE: ProceduralCharacterNamedMaterialProfile = {
  body: /regular|eyes|hair/i,
  crowdHiddenMesh: /(?:^|_)(?:Eyebrows|Eyes)(?:$|_)|Acc_Pauldron|Arms_Bracer|Body_Belt/i,
  mergeableOutfit: /^MI_(?:Peasant|Ranger)$/i,
  outfit: /ranger|peasant/i,
};

export const DEFAULT_PROCEDURAL_CHARACTER_APPEARANCE_ID: ProceduralCharacterAppearanceId = "modular-fantasy";

export const PROCEDURAL_CHARACTER_APPEARANCES: readonly ProceduralCharacterAppearanceDefinition[] = [
  {
    assetByTier: { 1: "t1-knight-default-near", 2: "t1-knight-default-near", 3: "t1-knight-default-near" },
    crowdAssetId: "t1-knight-default-mid",
    compatibleKinds: ["knight"],
    id: "t1-knight-default",
    label: "T1 Knight Default",
    materials: { authoredSource: true },
    rigAdapterId: "t1-knight-default",
  },
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

/** An appearance with no `compatibleKinds` serves every unit kind that renders a humanoid. */
export function isProceduralCharacterAppearanceCompatibleWithKind(
  id: ProceduralCharacterAppearanceId,
  kind: ProceduralUnitKind,
): boolean {
  const { compatibleKinds } = resolveProceduralCharacterAppearance(id);
  return compatibleKinds === undefined || compatibleKinds.includes(kind);
}

export function resolveProceduralCharacterAppearanceAssetId(
  id: ProceduralCharacterAppearanceId,
  tier: ProceduralCharacterAppearanceTier,
  renderDetail: ProceduralCharacterRenderDetail = "hero",
): ProceduralCharacterAssetId {
  const appearance = resolveProceduralCharacterAppearance(id);
  return renderDetail === "crowd" && appearance.crowdAssetId ? appearance.crowdAssetId : appearance.assetByTier[tier];
}

export function doesProceduralCharacterRenderDetailChangeAsset(
  id: ProceduralCharacterAppearanceId,
  tier: ProceduralCharacterAppearanceTier,
  current: ProceduralCharacterRenderDetail,
  next: ProceduralCharacterRenderDetail,
): boolean {
  return (
    resolveProceduralCharacterAppearanceAssetId(id, tier, current) !==
    resolveProceduralCharacterAppearanceAssetId(id, tier, next)
  );
}
