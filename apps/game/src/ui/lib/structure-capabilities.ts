import {
  isVillageLikeStructureCategory,
  normalizeStructureCategory,
  type StructureCategoryLike,
} from "@/lib/structure-type-utils";
import type { GameModeId } from "@/config/game-modes";
import { ID, StructureType } from "@bibliothecadao/types";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

type SlotValue = bigint | number | null | undefined;

type StructureBaseLike = {
  category?: StructureType | number;
  troop_max_explorer_count?: SlotValue;
  troop_max_guard_count?: SlotValue;
};

type StructureMetadataLike = {
  realm_id?: ID | bigint | number;
  village_realm?: ID | bigint | number;
};

export type StructureCapabilityTarget =
  | {
      category?: StructureType | number;
      entity_id?: ID | bigint | number;
      owner?: bigint;
      base?: StructureBaseLike;
      metadata?: StructureMetadataLike;
    }
  | null
  | undefined;

type CategoryCapabilities = {
  /** Places buildings and runs production (construction.cairo's building command, production_domain.cairo). */
  builds: boolean;
  /** Holds goods a player can open and send from. */
  holdsInventory: boolean;
  /** Houses a population. */
  housesPopulation: boolean;
  /** Pledges faith to a Wonder (faith.cairo's build_pledge). */
  pledgesFaith: boolean;
  /** Crafts relics (relics.cairo's craft_relic). */
  craftsRelics: boolean;
};
const NONE: CategoryCapabilities = {
  builds: false,
  holdsInventory: false,
  housesPopulation: false,
  pledgesFaith: false,
  craftsRelics: false,
};
const SETTLEMENT: CategoryCapabilities = {
  builds: true,
  holdsInventory: true,
  housesPopulation: true,
  pledgesFaith: true,
  craftsRelics: true,
};

/**
 * What each structure category can do: the one table every panel, tab and button asks. Keyed by every category, so a
 * new one does not compile until it has its row.
 */
const CATEGORY_CAPABILITIES: Record<StructureType, CategoryCapabilities> = {
  [StructureType.Realm]: SETTLEMENT,
  [StructureType.Village]: SETTLEMENT,
  [StructureType.Camp]: { ...NONE, builds: true, holdsInventory: true, housesPopulation: true },
  [StructureType.Mine]: { ...NONE, holdsInventory: true },
  [StructureType.Hyperstructure]: { ...NONE, holdsInventory: true },
  [StructureType.Bank]: NONE,
  [StructureType.BitcoinMine]: NONE,
  [StructureType.Rift]: NONE,
  [StructureType.Ruin]: NONE,
  [StructureType.Beasts]: NONE,
};

/** Whether a structure of this category can do it; an unknown category can do nothing. */
export const categoryCan = (category: StructureCategoryLike, capability: keyof CategoryCapabilities): boolean => {
  const known = normalizeStructureCategory(category);
  const row = known === null ? undefined : (CATEGORY_CAPABILITIES[known] as CategoryCapabilities | undefined);
  return row?.[capability] === true;
};

/** The categories that can do it, for a list filtered by kind. */
export const categoriesThatCan = (capability: keyof CategoryCapabilities): StructureType[] =>
  (Object.keys(CATEGORY_CAPABILITIES).map(Number) as StructureType[]).filter(
    (category) => CATEGORY_CAPABILITIES[category][capability],
  );

const normalizeSlotCount = (value: SlotValue): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return 0;
};

const getStructureCategory = (structure: StructureCapabilityTarget): StructureType | null => {
  const category = structure?.base?.category ?? structure?.category;
  return normalizeStructureCategory(category);
};

export const resolveStructureUiCapabilities = (structure: StructureCapabilityTarget) => {
  const category = getStructureCategory(structure);
  const fieldArmySlots = normalizeSlotCount(structure?.base?.troop_max_explorer_count);
  const guardArmySlots = normalizeSlotCount(structure?.base?.troop_max_guard_count);

  return {
    category,
    fieldArmySlots,
    guardArmySlots,
    canCreateFieldArmy: fieldArmySlots > 0,
    canManageGuardArmy: guardArmySlots > 0,
    canOpenConstruction: categoryCan(category, "builds"),
    canOpenProduction: categoryCan(category, "builds"),
    canOpenTransferInventory: categoryCan(category, "holdsInventory"),
    hasPopulationDetails: categoryCan(category, "housesPopulation"),
    isVillageLike: isVillageLikeStructureCategory(category),
  };
};
export { isVillageLikeStructureCategory };

export const canTransferMilitaryInventoryFromStructure = (modeId: GameModeId, structure: StructureCapabilityTarget) => {
  const capabilities = resolveStructureUiCapabilities(structure);

  if (modeId === "blitz") {
    return capabilities.canOpenTransferInventory;
  }

  return capabilities.category === StructureType.Realm;
};

export const canTransferMilitaryInventoryBetweenStructures = ({
  modeId,
  source,
  destination,
}: {
  modeId: GameModeId;
  source: StructureCapabilityTarget;
  destination: StructureCapabilityTarget;
}) => {
  const sourceCapabilities = resolveStructureUiCapabilities(source);
  const destinationCapabilities = resolveStructureUiCapabilities(destination);

  if (!sourceCapabilities.canOpenTransferInventory || !destinationCapabilities.canOpenTransferInventory) {
    return false;
  }

  if (modeId === "blitz") {
    return source?.owner !== undefined && source.owner === destination?.owner;
  }

  return true;
};

const getStructureByEntityId = (
  store: NativeFactStore | null | undefined,
  entityId: number,
): StructureCapabilityTarget => {
  if (!store || !entityId) return null;

  try {
    return store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: entityId });
  } catch {
    return null;
  }
};

export const canTransferMilitaryInventoryBetweenStructureIds = ({
  store,
  modeId,
  sourceEntityId,
  destinationEntityId,
}: {
  store: NativeFactStore | null | undefined;
  modeId: GameModeId;
  sourceEntityId: number;
  destinationEntityId: number;
}) =>
  canTransferMilitaryInventoryBetweenStructures({
    modeId,
    source: getStructureByEntityId(store, sourceEntityId),
    destination: getStructureByEntityId(store, destinationEntityId),
  });
