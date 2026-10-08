import { entityMapPosition } from "./tile";
import { structureMapPosition } from "./expeditions";
import { CapacityConfig, ContractAddress, ID, StructureType } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { shortString } from "starknet";
import knownAddressesJSONData from "../data/known-addresses.json";
import { configManager } from "../managers/config-manager";
import { getHyperstructureName } from "./hyperstructure";
import { getRealmNameById } from "./realm";
import { getStructureTypeName, presentedMineKind } from "./structure";
import { isViewerOwner } from "./viewer";

const knownAddressesJSON: Record<string, string> = knownAddressesJSONData;

export const getEntityInfo = (
  entityId: ID,
  playerAccount: ContractAddress | null,
  store: NativeFactStore,
  isBlitz: boolean,
) => {
  const game_id = configManager.getActiveGameId();

  const explorer = store.get("ExplorerTroops", { game_id, explorer_id: entityId });
  const structure = store.get("Structure", { game_id, entity_id: entityId });

  let name = undefined;
  if (explorer) {
    const armyName = getArmyName(explorer.explorer_id, store);
    name = {
      name: armyName,
      originalName: armyName,
    };
  } else {
    if (structure) {
      name = getStructureName(structure, isBlitz);
    }
  }

  let owner = undefined;
  if (explorer) {
    owner = explorer.owner;
    const structureOwner = store.get("Structure", { game_id, entity_id: explorer.owner });
    owner = structureOwner?.owner;
  } else if (structure) {
    owner = structure.owner;
  }

  let capacityCategoryId: CapacityConfig;
  if (explorer) {
    capacityCategoryId = CapacityConfig.Army;
  } else if (structure) {
    // hmm
    capacityCategoryId = CapacityConfig.Storehouse;
  } else {
    capacityCategoryId = CapacityConfig.None;
  }

  const capacityKg = configManager.getCapacityConfigKg(capacityCategoryId);

  return {
    entityId,
    capacityKg: Number(capacityKg) || 0,
    position: explorer
      ? entityMapPosition(store, game_id, explorer.explorer_id)
      : structure
        ? structureMapPosition(store, structure)
        : undefined,
    owner,
    isMine: isViewerOwner(owner === undefined ? undefined : ContractAddress(owner), playerAccount),
    structureCategory: structure?.base.category,
    structure,
    explorer,
    name,
  };
};

export const getArmyName = (armyEntityId: ID, store: NativeFactStore) => {
  const named = store.get("EntityName", { game_id: configManager.getActiveGameId(), entity_id: armyEntityId });
  return named && named.name !== 0n ? shortString.decodeShortString(named.name.toString()) : `Army ${armyEntityId}`;
};

const getRealmName = (structure: NativeRows["Structure"]) => {
  const baseName = getRealmNameById(structure.metadata.realm_id);
  return structure.metadata.has_wonder ? `WONDER - ${baseName}` : baseName;
};

export const getStructureName = (structure: NativeRows["Structure"], isBlitz: boolean) => {
  const cachedName = getEntityNameFromLocalStorage(structure.entity_id);
  let originalName = undefined;

  if (structure.base.category === StructureType.Realm) {
    originalName = getRealmName(structure);
  } else if (structure.base.category === StructureType.Hyperstructure) {
    originalName = getHyperstructureName(structure);
  } else {
    const structureTypeName =
      getStructureTypeName(structure.base.category as StructureType, presentedMineKind(structure)) || "Structure";
    originalName = `${structureTypeName} ${structure.entity_id}`;
  }

  return { name: cachedName || originalName, originalName };
};

export const setEntityNameLocalStorage = (entityId: ID, name: string) => {
  localStorage.setItem(`entity-name-${entityId}`, name);
};

const getEntityNameFromLocalStorage = (entityId: ID) => {
  return localStorage.getItem(`entity-name-${entityId}`);
};

/**
 * A player who has not claimed a name (ruled): "Lord" and the account's last four characters, so two such players stay
 * apart and no surface shows an address or an email as a name.
 */
export const unclaimedPlayerName = (address: ContractAddress | string): string =>
  `Lord ${BigInt(address).toString(16).padStart(4, "0").slice(-4)}`;

/** The one display rule for a player: the claimed name, else the unclaimed one, never an address. */
export const displayPlayerName = (address: ContractAddress | string, name: string | null | undefined): string =>
  name || unclaimedPlayerName(address);

/**
 * A player's name, from the one place names live: the player's Realms profile, looked up by the client that owns the
 * store (a headless client may name no one). Null when the player has not chosen a name; `displayPlayerName` then
 * shows the fallback.
 */
export type PlayerNameResolver = (address: ContractAddress | string) => string | null;

export const getInternalAddressName = (address: string): string | undefined => {
  const normalizedAddress = BigInt(address).toString();
  return knownAddressesJSON[normalizedAddress];
};
