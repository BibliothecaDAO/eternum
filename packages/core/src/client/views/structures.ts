import { safeInteger } from "../../utils/safe-integer";
import {
  type Building,
  type BuildingType,
  buildingName,
  type ContractAddress,
  getProducedResource,
  type ID,
  type RealmInfo,
  type Structure,
  StructureType,
  type SystemCalls,
} from "@bibliothecadao/types";
import type { NativeRows } from "../../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeFactStore } from "../native-fact-store";
import { configManager } from "../../managers/config-manager";
import { TileManager } from "../../managers/tile-manager";
import { getRealmInfo } from "../../utils/realm";
import { getStructure } from "../../utils/structure";
import { readExpeditionRules } from "../../utils/expeditions";
import type { PlayerNameResolver } from "../../utils/entities";

export type StructureRow = NativeRows["Structure"];
export type HyperstructureRow = NativeRows["Hyperstructure"];
export type BuildingTiles = Pick<
  TileManager,
  | "getHexCoords"
  | "getRealmLevel"
  | "getWonder"
  | "existingBuildings"
  | "getBuilding"
  | "isHexOccupied"
  | "structureType"
>;

export const readBuildingTiles = (
  store: NativeFactStore,
  systemCalls: SystemCalls,
  structureEntityId: ID,
): BuildingTiles => TileManager.forStructure(store, systemCalls, structureEntityId);

/**
 * The owner's structures that stand on the map. One can be owned yet have no site: a Frontier realm founded before its
 * season's first day stands nowhere until that day begins (structureMapPosition), and the day's turn brings it in.
 */
export const readStructures = (
  store: NativeFactStore,
  owner: ContractAddress,
  viewer: ContractAddress | null,
  playerName: PlayerNameResolver,
): Structure[] =>
  [...store.structuresOwnedBy(configManager.getActiveGameId(), owner)]
    .flatMap((row) => getStructure(safeInteger(row.entity_id), viewer, store, playerName) ?? [])
    .toSorted((a, b) => a.category - b.category || a.entityId - b.entityId);

/** The owner's realms or villages that stand on the map, as readStructures reads them. */
export const readRealmInfos = (
  store: NativeFactStore,
  owner: ContractAddress,
  category: StructureType,
  playerName: PlayerNameResolver,
): RealmInfo[] =>
  [...store.structuresOwnedBy(configManager.getActiveGameId(), owner)]
    .filter((row) => row.base.category === category)
    .flatMap((row) => getRealmInfo(safeInteger(row.entity_id), store, playerName) ?? []);

export const readStructureRows = (store: NativeFactStore, category: StructureType): StructureRow[] =>
  [...store.inGame("Structure", configManager.getActiveGameId())].filter((row) => row.base.category === category);

export const readStructureIds = (store: NativeFactStore, owner: ContractAddress, category: StructureType): ID[] =>
  [...store.structuresOwnedBy(configManager.getActiveGameId(), owner)]
    .filter((row) => row.base.category === category)
    .map((row) => safeInteger(row.entity_id));

export const readHyperstructureUpdates = (store: NativeFactStore, entityId: ID): HyperstructureRow[] => {
  const row = store.get("Hyperstructure", { game_id: configManager.getActiveGameId(), entity_id: entityId });
  return row ? [row] : [];
};

export const readBuildings = (store: NativeFactStore, structureId: number): Building[] => {
  const frontier = readExpeditionRules(store, configManager.getActiveGameId()) !== null;
  return [...store.inGame("Building", configManager.getActiveGameId())]
    .filter((row) => row.structure_id === BigInt(structureId))
    .flatMap((building) => {
      const category = building.category as BuildingType;
      const resource = getProducedResource(category);
      if (!resource) return [];
      return [
        {
          name: buildingName(category, frontier),
          category,
          paused: building.paused,
          produced: { resource },
          innerCol: building.inner_col,
          innerRow: building.inner_row,
        },
      ];
    });
};
