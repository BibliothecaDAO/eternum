import { isVillageLikeStructureCategory, normalizeStructureCategory } from "@/lib/structure-type-utils";
import type { GameModeId } from "@/config/game-modes";
import { ClientComponents, ID, StructureType } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";

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
  StructureType.FragmentMine,
  StructureType.Hyperstructure,
]);
const BLITZ_ARMY_TO_STRUCTURE_BLOCKED_CATEGORIES = new Set<StructureType>([
  StructureType.Camp,
  StructureType.FragmentMine,
  StructureType.Hyperstructure,
]);
const POPULATION_STRUCTURE_CATEGORIES = new Set<StructureType>([
  StructureType.Realm,
  StructureType.Village,
  StructureType.Camp,
]);

const normalizeEntityId = (value: ID | bigint | number | null | undefined): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

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

const getStructureEntityId = (structure: StructureCapabilityTarget): number | null =>
  normalizeEntityId(structure?.entity_id);

const getStructureRealmId = (structure: StructureCapabilityTarget): number | null => {
  const explicitRealmId = normalizeEntityId(structure?.metadata?.realm_id);
  if (explicitRealmId !== null && explicitRealmId > 0) {
    return explicitRealmId;
  }

  const villageRealmId = normalizeEntityId(structure?.metadata?.village_realm);
  if (villageRealmId !== null && villageRealmId > 0) {
    return villageRealmId;
  }

  const category = getStructureCategory(structure);
  if (category === StructureType.Realm) {
    return getStructureEntityId(structure);
  }

  return null;
};

const isInventoryStructureCategory = (category: StructureType | null) =>
  category !== null && INVENTORY_STRUCTURE_CATEGORIES.has(category);

const canTransferMilitaryInventoryInEternum = (
  source: StructureCapabilityTarget,
  destination: StructureCapabilityTarget,
): boolean => {
  const sourceCategory = getStructureCategory(source);
  const destinationCategory = getStructureCategory(destination);

  if (sourceCategory === StructureType.Village) {
    return getStructureEntityId(destination) === normalizeEntityId(source?.metadata?.village_realm);
  }

  if (destinationCategory === StructureType.Village) {
    return getStructureEntityId(source) === normalizeEntityId(destination?.metadata?.village_realm);
  }

  return true;
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
    return true;
  }

  return canTransferMilitaryInventoryInEternum(source, destination);
};

export const resolveArmyToStructureTransferRestriction = ({
  modeId,
  destination,
}: {
  modeId: GameModeId;
  destination: StructureCapabilityTarget;
}) => {
  if (modeId !== "blitz") {
    return null;
  }

  const destinationCategory = getStructureCategory(destination);
  if (destinationCategory === null) {
    return null;
  }

  if (!BLITZ_ARMY_TO_STRUCTURE_BLOCKED_CATEGORIES.has(destinationCategory)) {
    return null;
  }

  return "cannot transfer army to structure";
};

export const resolveArmyToArmyTransferRestriction = ({
  modeId,
  source,
  destination,
}: {
  modeId: GameModeId;
  source: StructureCapabilityTarget;
  destination: StructureCapabilityTarget;
}) => {
  if (modeId !== "blitz") {
    return null;
  }

  const sourceRealmId = getStructureRealmId(source);
  const destinationRealmId = getStructureRealmId(destination);
  if (sourceRealmId === null || destinationRealmId === null) {
    return null;
  }

  if (sourceRealmId === destinationRealmId) {
    return null;
  }

  return "you can only transfer between armies from the same realm";
};

const getStructureByEntityId = (
  components: ClientComponents | null | undefined,
  entityId: number,
): StructureCapabilityTarget => {
  if (!components || !entityId) return null;

  try {
    return getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(entityId)]));
  } catch {
    return null;
  }
};

export const canTransferMilitaryInventoryBetweenStructureIds = ({
  components,
  modeId,
  sourceEntityId,
  destinationEntityId,
}: {
  components: ClientComponents | null | undefined;
  modeId: GameModeId;
  sourceEntityId: number;
  destinationEntityId: number;
}) =>
  canTransferMilitaryInventoryBetweenStructures({
    modeId,
    source: getStructureByEntityId(components, sourceEntityId),
    destination: getStructureByEntityId(components, destinationEntityId),
  });
