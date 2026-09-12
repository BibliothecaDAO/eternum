import {
  type Building,
  type BuildingType,
  BuildingTypeToString,
  type ClientComponents,
  type ContractAddress,
  getProducedResource,
  type ID,
  type RealmInfo,
  type Structure,
  StructureType,
} from "@bibliothecadao/types";
import {
  type ComponentValue,
  type Entity,
  getComponentValue,
  Has,
  HasValue,
  type QueryFragment,
} from "@dojoengine/recs";

import { configManager } from "../../managers/config-manager";
import { getRealmInfo } from "../../utils/realm";
import { getStructure } from "../../utils/structure";
import { isDefined, readRows } from "./rows";

export type StructureRow = ComponentValue<ClientComponents["Structure"]["schema"]>;
export type HyperstructureRow = ComponentValue<ClientComponents["Hyperstructure"]["schema"]>;
type BuildingRow = ComponentValue<ClientComponents["Building"]["schema"]>;

// Structures

export const structuresByOwnerQuery = (components: ClientComponents, owner: ContractAddress): QueryFragment[] => [
  HasValue(components.Structure, { owner }),
];

/** Grouped by category, then by entity id, the order the structure panels list them; isMine is relative to the viewer. */
export const readStructures = (
  components: ClientComponents,
  entities: Entity[],
  viewer: ContractAddress,
): Structure[] =>
  entities
    .map((entity) => getStructure(entity, viewer, components))
    .filter(isDefined)
    .toSorted(byCategoryThenEntityId);

const byCategoryThenEntityId = (left: Structure, right: Structure): number =>
  left.structure.base.category - right.structure.base.category || Number(left.entityId) - Number(right.entityId);

// Realms and villages

export const realmsByOwnerQuery = (components: ClientComponents, owner: ContractAddress): QueryFragment[] =>
  ownedStructuresOfCategoryQuery(components, owner, StructureType.Realm);

export const villagesByOwnerQuery = (components: ClientComponents, owner: ContractAddress): QueryFragment[] =>
  ownedStructuresOfCategoryQuery(components, owner, StructureType.Village);

const ownedStructuresOfCategoryQuery = (
  components: ClientComponents,
  owner: ContractAddress,
  category: StructureType,
): QueryFragment[] => [Has(components.Structure), HasValue(components.Structure, { owner, category })];

export const readRealmInfos = (components: ClientComponents, entities: Entity[]): RealmInfo[] =>
  entities.map((entity) => getRealmInfo(entity, components)).filter(isDefined);

export const allRealmsQuery = (components: ClientComponents): QueryFragment[] => [
  Has(components.Structure),
  HasValue(components.Structure, { category: StructureType.Realm }),
];

export const readStructureRows = (components: ClientComponents, entities: Entity[]): StructureRow[] =>
  readRows(components.Structure, entities);

// Hyperstructures

export const hyperstructuresByOwnerQuery = (components: ClientComponents, owner: ContractAddress): QueryFragment[] => [
  HasValue(components.Structure, { owner, category: StructureType.Hyperstructure }),
];

export const readStructureIds = (components: ClientComponents, entities: Entity[]): ID[] =>
  readStructureRows(components, entities).map((structure) => structure.entity_id);

export const hyperstructureUpdatesQuery = (
  components: ClientComponents,
  hyperstructureEntityId: ID,
): QueryFragment[] => [
  Has(components.Hyperstructure),
  HasValue(components.Hyperstructure, { hyperstructure_id: hyperstructureEntityId }),
];

export const readHyperstructureUpdates = (
  components: ClientComponents,
  entities: Entity[],
): (HyperstructureRow | undefined)[] => entities.map((entity) => getComponentValue(components.Hyperstructure, entity));

// Buildings

/** The buildings on one structure's hex, keyed by the hex's outer coordinates. */
export const buildingsAtQuery = (components: ClientComponents, outerCol: number, outerRow: number): QueryFragment[] => [
  Has(components.Building),
  HasValue(components.Building, { outer_col: outerCol, outer_row: outerRow }),
];

/** Producing buildings only, with their production recipe from the active game's config. */
export const readBuildings = (components: ClientComponents, entities: Entity[]): Building[] =>
  readRows(components.Building, entities).map(toProducingBuilding).filter(isDefined);

const toProducingBuilding = (building: BuildingRow): Building | undefined => {
  const category = building.category as BuildingType;
  const producedResource = getProducedResource(category);
  if (!producedResource) return undefined;
  return {
    name: BuildingTypeToString[category],
    category,
    paused: building.paused,
    produced: configManager.complexSystemResourceOutput[producedResource],
    consumed: configManager.complexSystemResourceInputs[producedResource],
    bonusPercent: building.bonus_percent,
    innerCol: building.inner_col,
    innerRow: building.inner_row,
  };
};
