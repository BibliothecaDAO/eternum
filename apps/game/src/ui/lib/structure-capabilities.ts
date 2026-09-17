import { isVillageLikeStructureCategory, normalizeStructureCategory } from "@/lib/structure-type-utils";
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

const CONSTRUCTION_STRUCTURE_CATEGORIES = new Set<StructureType>([
  StructureType.Realm,
  StructureType.Village,
  StructureType.Camp,
]);
const INVENTORY_STRUCTURE_CATEGORIES = new Set<StructureType>([
  StructureType.Realm,
  StructureType.Village,
  StructureType.Camp,
  StructureType.Mine,
  StructureType.Hyperstructure,
]);
const POPULATION_STRUCTURE_CATEGORIES = new Set<StructureType>([
  StructureType.Realm,
  StructureType.Village,
  StructureType.Camp,
]);

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

const isInventoryStructureCategory = (category: StructureType | null) =>
  category !== null && INVENTORY_STRUCTURE_CATEGORIES.has(category);

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
    canOpenConstruction: category !== null && CONSTRUCTION_STRUCTURE_CATEGORIES.has(category),
    canOpenProduction: category !== null && CONSTRUCTION_STRUCTURE_CATEGORIES.has(category),
    canOpenTransferInventory: isInventoryStructureCategory(category),
    hasPopulationDetails: category !== null && POPULATION_STRUCTURE_CATEGORIES.has(category),
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
