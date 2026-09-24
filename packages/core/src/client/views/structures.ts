import {
  type Building,
  type BuildingType,
  BuildingTypeToString,
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

export const readStructures = (
  store: NativeFactStore,
  owner: ContractAddress,
  viewer: ContractAddress,
  playerName: PlayerNameResolver,
): Structure[] =>
  [...store.structuresOwnedBy(configManager.getActiveGameId(), owner)]
    .map((row) => getStructure(row.entity_id, viewer, store, playerName)!)
    .toSorted((a, b) => a.category - b.category || a.entityId - b.entityId);

export const readRealmInfos = (
  store: NativeFactStore,
  owner: ContractAddress,
  category: StructureType,
  playerName: PlayerNameResolver,
): RealmInfo[] =>
  [...store.structuresOwnedBy(configManager.getActiveGameId(), owner)]
    .filter((row) => row.base.category === category)
    .map((row) => getRealmInfo(row.entity_id, store, playerName)!);

export const readStructureRows = (store: NativeFactStore, category: StructureType): StructureRow[] =>
  [...store.inGame("Structure", configManager.getActiveGameId())].filter((row) => row.base.category === category);

export const readStructureIds = (store: NativeFactStore, owner: ContractAddress, category: StructureType): ID[] =>
  [...store.structuresOwnedBy(configManager.getActiveGameId(), owner)]
    .filter((row) => row.base.category === category)
    .map((row) => row.entity_id);

export const readHyperstructureUpdates = (store: NativeFactStore, entityId: ID): HyperstructureRow[] => {
  const row = store.get("Hyperstructure", { game_id: configManager.getActiveGameId(), entity_id: entityId });
  return row ? [row] : [];
};

export const readBuildings = (store: NativeFactStore, outerCol: number, outerRow: number, alt = false): Building[] =>
  [...store.inGame("Building", configManager.getActiveGameId())]
    .filter((row) => row.alt === alt && row.outer_col === outerCol && row.outer_row === outerRow)
    .flatMap((building) => {
      const category = building.category as BuildingType;
      const resource = getProducedResource(category);
      if (!resource) return [];
      return [
        {
          name: BuildingTypeToString[category],
          category,
          paused: building.paused,
          produced: { resource },
          innerCol: building.inner_col,
          innerRow: building.inner_row,
        },
      ];
    });
