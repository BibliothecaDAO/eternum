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

// Only using low-res models now - files are named by attributesRaw (e.g., 0x305020701.glb)
const lowResPath = (attributesRaw: string) => `${COSMETIC_ROOT}/low-res/${attributesRaw}.glb`;

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
    assetPaths: [lowResPath("0x205010901")], // Hunter's Bow
    attachments: [
      {
        id: "bow-common",
        assetPath: lowResPath("0x205010901"),
        mountPoint: "weapon_r",
        slot: "weapon",
        persistent: true,
      },
    ],
    attachmentSlot: "weapon",
    metadata: {
      lod: {
        high: lowResPath("0x205010901"),
        low: lowResPath("0x205010901"),
      },
      trait: CosmeticTraitType.TroopPrimary,
    },
  },
  {
    id: "attachment:back:common-quiver",
    category: "attachment",
    appliesTo: [formatArmyCosmeticFamily(TroopType.Crossbowman)],
    assetPaths: [lowResPath("0x206010a01")], // Hunter's Quiver
    attachments: [
      {
        id: "common-quiver",
        assetPath: lowResPath("0x206010a01"),
        mountPoint: "spine",
        slot: "back",
        persistent: true,
      },
    ],
    attachmentSlot: "back",
    metadata: {
      lod: {
        high: lowResPath("0x206010a01"),
        low: lowResPath("0x206010a01"),
      },
      trait: CosmeticTraitType.TroopSecondary,
    },
  },
  {
    id: "attachment:paladin:winter-primary",
    category: "attachment",
    appliesTo: [formatArmyCosmeticFamily(TroopType.Paladin)],
    assetPaths: [lowResPath("0x305020701")], // Winter Rider's Battleaxe
    attachments: [
      {
        id: "winter-paladin-primary",
        assetPath: lowResPath("0x305020701"),
        mountPoint: "weapon_r",
        slot: "weapon",
        persistent: true,
      },
    ],
    attachmentSlot: "weapon",
    metadata: {
      lod: {
        high: lowResPath("0x305020701"),
        low: lowResPath("0x305020701"),
      },
      trait: CosmeticTraitType.TroopPrimary,
    },
  },
  {
    id: "attachment:paladin:winter-secondary",
    category: "attachment",
    appliesTo: [formatArmyCosmeticFamily(TroopType.Paladin)],
    assetPaths: [lowResPath("0x306020801")], // Winter Rider's Shield
    attachments: [
      {
        id: "winter-paladin-secondary",
        assetPath: lowResPath("0x306020801"),
        mountPoint: "weapon_l",
        slot: "offhand",
        persistent: true,
      },
    ],
    attachmentSlot: "offhand",
    metadata: {
      lod: {
        high: lowResPath("0x306020801"),
        low: lowResPath("0x306020801"),
      },
      trait: CosmeticTraitType.TroopSecondary,
    },
  },
  {
    id: "attachment:army:aura-legacy",
    category: "attachment",
    appliesTo: ARMY_TROOP_TYPES.map(formatArmyCosmeticFamily),
    assetPaths: [lowResPath("0x4050301")], // Aura of the Legacy Warrior
    attachments: [
      {
        id: "legacy-troop-aura",
        assetPath: lowResPath("0x4050301"),
        mountPoint: "root",
        slot: "aura",
        persistent: true,
      },
    ],
    attachmentSlot: "aura",
    metadata: {
      lod: {
        high: lowResPath("0x4050301"),
        low: lowResPath("0x4050301"),
      },
      trait: CosmeticTraitType.TroopAura,
    },
  },
  {
    id: "attachment:structure:common-platform",
    category: "attachment",
    appliesTo: [formatStructureCosmeticTarget(StructureType.Realm)],
    assetPaths: [lowResPath("0x8010b01")], // Carved Wooden Base
    attachments: [
      {
        id: "common-platform",
        assetPath: lowResPath("0x8010b01"),
        mountPoint: "origin",
        slot: "base",
        persistent: true,
      },
    ],
    attachmentSlot: "base",
    metadata: {
      lod: {
        high: lowResPath("0x8010b01"),
        low: lowResPath("0x8010b01"),
      },
      trait: CosmeticTraitType.TroopBase,
    },
  },
  {
    id: "attachment:structure:aura-legacy",
    category: "attachment",
    appliesTo: [formatStructureCosmeticTarget(StructureType.Realm)],
    assetPaths: [lowResPath("0x2040401")], // Aura of the Legacy Realm
    attachments: [
      {
        id: "legacy-realm-aura",
        assetPath: lowResPath("0x2040401"),
        mountPoint: "origin",
        slot: "aura",
        persistent: true,
      },
    ],
    attachmentSlot: "aura",
    metadata: {
      lod: {
        high: lowResPath("0x2040401"),
        low: lowResPath("0x2040401"),
      },
      trait: CosmeticTraitType.RealmAura,
    },
  },
  {
    id: "attachment:structure:aura-winter-spike",
    category: "attachment",
    appliesTo: [formatStructureCosmeticTarget(StructureType.Realm)],
    assetPaths: [lowResPath("0x2030601")], // Winter's Palisade
    attachments: [
      {
        id: "winter-spike-aura",
        assetPath: lowResPath("0x2030601"),
        mountPoint: "origin",
        slot: "aura",
        persistent: true,
      },
    ],
    attachmentSlot: "aura",
    metadata: {
      lod: {
        high: lowResPath("0x2030601"),
        low: lowResPath("0x2030601"),
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
    assetPaths: [lowResPath("0x107050201")], // Legacy Guardian
    metadata: {
      lod: {
        high: lowResPath("0x107050201"),
        low: lowResPath("0x107050201"),
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
    assetPaths: [lowResPath("0x3040101")], // Legacy Keep
    metadata: {
      lod: {
        high: lowResPath("0x3040101"),
        low: lowResPath("0x3040101"),
      },
      trait: CosmeticTraitType.RealmSkin,
    },
  },
  {
    id: "structure:realm:castle-winter-l3",
    category: "structure-skin",
    appliesTo: [formatStructureCosmeticTarget(StructureType.Realm, 3)],
    assetPaths: [lowResPath("0x3030501")], // Winterhold
    metadata: {
      lod: {
        high: lowResPath("0x3030501"),
        low: lowResPath("0x3030501"),
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
