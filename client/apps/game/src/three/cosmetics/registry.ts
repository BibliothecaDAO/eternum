import { StructureType, TroopTier, TroopType } from "@bibliothecadao/types";
import { MODEL_TYPE_TO_FILE, TROOP_TO_MODEL } from "../constants/army-constants";
import { getStructureModelPaths } from "../constants/scene-constants";
import { CosmeticRegistryEntry } from "./types";

/**
 * Centralised cosmetic registry. Entries stay data-only so gameplay logic remains generic.
 */
const registryList: CosmeticRegistryEntry[] = [];
const registryMap = new Map<string, CosmeticRegistryEntry>();
let seeded = false;

const ARMY_TROOP_TYPES = Object.values(TroopType) as TroopType[];
const ARMY_TIERS = Object.values(TroopTier) as TroopTier[];
const STRUCTURE_TYPES = Object.values(StructureType).filter((value) => typeof value === "number") as StructureType[];

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
    }).filter((entry): entry is CosmeticRegistryEntry => Boolean(entry));
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
    id: "attachment:knight:axe",
    category: "attachment",
    appliesTo: [formatArmyCosmeticFamily(TroopType.Knight)],
    assetPaths: [],
    attachments: [
      {
        id: "knight-axe",
        mountPoint: "weapon_r",
        slot: "weapon",
      },
    ],
    attachmentSlot: "weapon",
    metadata: {
      description: "Placeholder knight axe attachment",
    },
  },
];

const DEFAULT_ENTRIES: CosmeticRegistryEntry[] = [
  ...buildDefaultArmyEntries(),
  ...buildDefaultStructureEntries(),
  ...DEFAULT_ATTACHMENT_ENTRIES,
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
