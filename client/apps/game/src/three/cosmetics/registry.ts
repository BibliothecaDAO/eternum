import { StructureType, TroopTier, TroopType } from "@bibliothecadao/types";
import { MODEL_TYPE_TO_FILE, TROOP_TO_MODEL } from "../constants/army-constants";
import { getStructureModelPaths } from "../constants/scene-constants";
import { CosmeticRegistryEntry, CosmeticTraitType } from "./types";

/**
 * Centralised cosmetic registry. Entries stay data-only so gameplay logic remains generic.
 */
const registryList: CosmeticRegistryEntry[] = [];
const registryMap = new Map<string, CosmeticRegistryEntry>();
let seeded = false;

const ARMY_TROOP_TYPES = Object.values(TroopType) as TroopType[];
const ARMY_TIERS = Object.values(TroopTier) as TroopTier[];
const STRUCTURE_TYPES = Object.values(StructureType).filter((value) => typeof value === "number") as StructureType[];
const COSMETIC_ROOT = "models/cosmetics";

const highResPath = (fileName: string) => `${COSMETIC_ROOT}/high-res/${fileName}`;
const lowResPath = (fileName: string) => `${COSMETIC_ROOT}/low-res/${fileName}`;

/**
 * Normalises asset paths so loaders can resolve both relative and absolute entries.
 */
function normalizeAssetPath(path: string): string {
  if (path.startsWith("/")) return path;
  if (path.startsWith("models/")) return path;
  return `models/${path}`;
}

/**
 * Serialises troop cosmetics targets (army:Knight:T1 etc.).
 */
export function formatArmyCosmeticTarget(troopType: TroopType, tier: TroopTier): string {
  return `army:${troopType}:${tier}`;
}

export function formatArmyCosmeticFamily(troopType: TroopType): string {
  return `army:${troopType}`;
}

/**
 * Serialises structure cosmetics targets (structure:Realm or structure:Realm:stage-3).
 */
function resolveStructureName(structureType: StructureType): string {
  const enumMap = StructureType as unknown as Record<number, string>;
  return enumMap[structureType] ?? String(structureType);
}

export function formatStructureCosmeticTarget(type: StructureType, stage?: string | number): string {
  const structureName = resolveStructureName(type);
  return stage !== undefined ? `structure:${structureName}:${stage}` : `structure:${structureName}`;
}

/**
 * Registers a cosmetic entry while guarding against accidental duplicates.
 */
export function registerCosmetic(entry: CosmeticRegistryEntry): CosmeticRegistryEntry {
  if (registryMap.has(entry.id)) {
    return registryMap.get(entry.id)!;
  }

  const normalised: CosmeticRegistryEntry = {
    ...entry,
    assetPaths: entry.assetPaths.map(normalizeAssetPath),
  };

  registryMap.set(normalised.id, normalised);
  registryList.push(normalised);
  return normalised;
}

export function getCosmeticRegistry(): readonly CosmeticRegistryEntry[] {
  return registryList;
}

export function findCosmeticById(id: string): CosmeticRegistryEntry | undefined {
  return registryMap.get(id);
}

export function clearRegistry() {
  registryList.length = 0;
  registryMap.clear();
  seeded = false;
}

function buildDefaultArmyEntries(): CosmeticRegistryEntry[] {
  return ARMY_TROOP_TYPES.flatMap((troopType) => {
    return ARMY_TIERS.map((tier) => {
      const modelType = TROOP_TO_MODEL[troopType]?.[tier];
      const modelFile = modelType ? MODEL_TYPE_TO_FILE[modelType] : undefined;

      if (!modelFile) {
        return undefined;
      }

      return {
        id: `army:${troopType}:${tier}:base`,
        category: "army-skin" as const,
        appliesTo: [formatArmyCosmeticTarget(troopType, tier)],
        assetPaths: [modelFile],
        metadata: {
          baseModelType: modelType,
        },
      } satisfies CosmeticRegistryEntry;
    }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  });
}

function buildDefaultStructureEntries(): CosmeticRegistryEntry[] {
  const structurePaths = getStructureModelPaths(true);

  return STRUCTURE_TYPES.map((structureType) => {
    const paths = structurePaths[structureType] ?? [];
    const structureName = resolveStructureName(structureType);

    return {
      id: `structure:${structureName.toLowerCase()}:base`,
      category: "structure-skin" as const,
      appliesTo: [formatStructureCosmeticTarget(structureType)],
      assetPaths: paths,
      metadata: {
        structureType,
      },
    } satisfies CosmeticRegistryEntry;
  });
}

const DEFAULT_ATTACHMENT_ENTRIES: CosmeticRegistryEntry[] = [
  {
    id: "attachment:weapon:bow-common",
    category: "attachment",
    appliesTo: [formatArmyCosmeticFamily(TroopType.Crossbowman)],
    assetPaths: [highResPath("bow_common.glb")],
    attachments: [
      {
        id: "bow-common",
        assetPath: highResPath("bow_common.glb"),
        mountPoint: "weapon_r",
        slot: "weapon",
        persistent: true,
      },
    ],
    attachmentSlot: "weapon",
    metadata: {
      lod: {
        high: highResPath("bow_common.glb"),
        low: lowResPath("bow_common.glb"),
      },
      trait: CosmeticTraitType.TroopPrimary,
    },
  },
  {
    id: "attachment:back:common-quiver",
    category: "attachment",
    appliesTo: [formatArmyCosmeticFamily(TroopType.Crossbowman)],
    assetPaths: [highResPath("common_quiver.glb")],
    attachments: [
      {
        id: "common-quiver",
        assetPath: highResPath("common_quiver.glb"),
        mountPoint: "spine",
        slot: "back",
        persistent: true,
      },
    ],
    attachmentSlot: "back",
    metadata: {
      lod: {
        high: highResPath("common_quiver.glb"),
        low: lowResPath("common_quiver.glb"),
      },
      trait: CosmeticTraitType.TroopSecondary,
    },
  },
  {
    id: "attachment:paladin:winter-primary",
    category: "attachment",
    appliesTo: [formatArmyCosmeticFamily(TroopType.Paladin)],
    assetPaths: [highResPath("winter_lord_paladin_primary.glb")],
    attachments: [
      {
        id: "winter-paladin-primary",
        assetPath: highResPath("winter_lord_paladin_primary.glb"),
        mountPoint: "weapon_r",
        slot: "weapon",
        persistent: true,
      },
    ],
    attachmentSlot: "weapon",
    metadata: {
      lod: {
        high: highResPath("winter_lord_paladin_primary.glb"),
        low: lowResPath("winter_lord_paladin_primary.glb"),
      },
      trait: CosmeticTraitType.TroopPrimary,
    },
  },
  {
    id: "attachment:paladin:winter-secondary",
    category: "attachment",
    appliesTo: [formatArmyCosmeticFamily(TroopType.Paladin)],
    assetPaths: [highResPath("winter_lord_paladin_secondary.glb")],
    attachments: [
      {
        id: "winter-paladin-secondary",
        assetPath: highResPath("winter_lord_paladin_secondary.glb"),
        mountPoint: "weapon_l",
        slot: "offhand",
        persistent: true,
      },
    ],
    attachmentSlot: "offhand",
    metadata: {
      lod: {
        high: highResPath("winter_lord_paladin_secondary.glb"),
        low: lowResPath("winter_lord_paladin_secondary.glb"),
      },
      trait: CosmeticTraitType.TroopSecondary,
    },
  },
  {
    id: "attachment:army:aura-legacy",
    category: "attachment",
    appliesTo: ARMY_TROOP_TYPES.map(formatArmyCosmeticFamily),
    assetPaths: [highResPath("s1_legacy_troop_aura.glb")],
    attachments: [
      {
        id: "legacy-troop-aura",
        assetPath: highResPath("s1_legacy_troop_aura.glb"),
        mountPoint: "root",
        slot: "aura",
        persistent: true,
      },
    ],
    attachmentSlot: "aura",
    metadata: {
      lod: {
        high: highResPath("s1_legacy_troop_aura.glb"),
        low: lowResPath("s1_legacy_troop_aura.glb"),
      },
      trait: CosmeticTraitType.TroopAura,
    },
  },
  {
    id: "attachment:structure:common-platform",
    category: "attachment",
    appliesTo: [formatStructureCosmeticTarget(StructureType.Realm)],
    assetPaths: [highResPath("common_platform.glb")],
    attachments: [
      {
        id: "common-platform",
        assetPath: highResPath("common_platform.glb"),
        mountPoint: "origin",
        slot: "base",
        persistent: true,
      },
    ],
    attachmentSlot: "base",
    metadata: {
      lod: {
        high: highResPath("common_platform.glb"),
        low: lowResPath("common_platform.glb"),
      },
      trait: CosmeticTraitType.TroopBase,
    },
  },
  {
    id: "attachment:structure:aura-legacy",
    category: "attachment",
    appliesTo: [formatStructureCosmeticTarget(StructureType.Realm)],
    assetPaths: [highResPath("s1_legacy_realm_aura.glb")],
    attachments: [
      {
        id: "legacy-realm-aura",
        assetPath: highResPath("s1_legacy_realm_aura.glb"),
        mountPoint: "origin",
        slot: "aura",
        persistent: true,
      },
    ],
    attachmentSlot: "aura",
    metadata: {
      lod: {
        high: highResPath("s1_legacy_realm_aura.glb"),
        low: lowResPath("s1_legacy_realm_aura.glb"),
      },
      trait: CosmeticTraitType.RealmAura,
    },
  },
  {
    id: "attachment:structure:aura-winter-spike",
    category: "attachment",
    appliesTo: [formatStructureCosmeticTarget(StructureType.Realm)],
    assetPaths: [highResPath("winter_lord_spike_aura.glb")],
    attachments: [
      {
        id: "winter-spike-aura",
        assetPath: highResPath("winter_lord_spike_aura.glb"),
        mountPoint: "origin",
        slot: "aura",
        persistent: true,
      },
    ],
    attachmentSlot: "aura",
    metadata: {
      lod: {
        high: highResPath("winter_lord_spike_aura.glb"),
        low: lowResPath("winter_lord_spike_aura.glb"),
      },
      trait: CosmeticTraitType.RealmAura,
    },
  },
];

const DEFAULT_EXTRA_ARMY_SKINS: CosmeticRegistryEntry[] = [
  {
    id: "army:Knight:T3:legacy",
    category: "army-skin",
    appliesTo: [formatArmyCosmeticTarget(TroopType.Knight, TroopTier.T3)],
    assetPaths: [highResPath("legacy_knight_t3.glb")],
    metadata: {
      lod: {
        high: highResPath("legacy_knight_t3.glb"),
        low: lowResPath("legacy_knight_t3.glb"),
      },
      trait: CosmeticTraitType.TroopArmor,
    },
  },
];

const DEFAULT_EXTRA_STRUCTURE_SKINS: CosmeticRegistryEntry[] = [
  {
    id: "structure:realm:castle-s1-lvl2",
    category: "structure-skin",
    appliesTo: [formatStructureCosmeticTarget(StructureType.Realm, 2)],
    assetPaths: [highResPath("castle_s1_lvl2.glb")],
    metadata: {
      lod: {
        high: highResPath("castle_s1_lvl2.glb"),
        low: lowResPath("castle_s1_lvl2.glb"),
      },
      trait: CosmeticTraitType.RealmSkin,
    },
  },
  {
    id: "structure:realm:castle-winter-l3",
    category: "structure-skin",
    appliesTo: [formatStructureCosmeticTarget(StructureType.Realm, 3)],
    assetPaths: [highResPath("castle_winter_lord_l3.glb")],
    metadata: {
      lod: {
        high: highResPath("castle_winter_lord_l3.glb"),
        low: lowResPath("castle_winter_lord_l3.glb"),
      },
      trait: CosmeticTraitType.RealmSkin,
    },
  },
];

const DEFAULT_ENTRIES: CosmeticRegistryEntry[] = [
  ...buildDefaultArmyEntries(),
  ...buildDefaultStructureEntries(),
  ...DEFAULT_ATTACHMENT_ENTRIES,
  ...DEFAULT_EXTRA_ARMY_SKINS,
  ...DEFAULT_EXTRA_STRUCTURE_SKINS,
];

export function seedDefaultCosmetics(options?: { force?: boolean }) {
  if (seeded && !options?.force) {
    return;
  }

  if (options?.force) {
    clearRegistry();
  }

  DEFAULT_ENTRIES.forEach((entry) => registerCosmetic(entry));
  seeded = true;
}

seedDefaultCosmetics();
