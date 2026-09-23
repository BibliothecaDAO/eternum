import { structureMapPosition } from "./expeditions";
import {
  CapacityConfig,
  ContractAddress,
  DirectionName,
  getDirectionBetweenAdjacentHexes,
  ID,
  StructureType,
} from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { shortString } from "starknet";
import knownAddressesJSONData from "../data/known-addresses.json";
import { configManager } from "../managers/config-manager";
import { getHyperstructureName } from "./hyperstructure";
import { getRealmNameById } from "./realm";
import { getStructureTypeName } from "./structure";

const knownAddressesJSON: Record<string, string> = knownAddressesJSONData;

export const getEntityInfo = (
  entityId: ID,
  playerAccount: ContractAddress,
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
      ? { x: explorer.coord.x, y: explorer.coord.y }
      : structure
        ? structureMapPosition(store, structure)
        : undefined,
    owner,
    isMine: owner !== undefined && ContractAddress(owner) === playerAccount,
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

export const getStructureName = (
  structure: NativeRows["Structure"],
  isBlitz: boolean,
  parentRealmContractPosition?: { col: number; row: number },
) => {
  const cachedName = getEntityNameFromLocalStorage(structure.entity_id);
  let originalName = undefined;

  if (structure.base.category === StructureType.Realm) {
    originalName = getRealmName(structure);
  } else if (structure.base.category === StructureType.Village && parentRealmContractPosition) {
    originalName = getVillageName(structure, parentRealmContractPosition);
  } else if (structure.base.category === StructureType.Hyperstructure) {
    originalName = getHyperstructureName(structure);
  } else {
    const structureTypeName =
      getStructureTypeName(structure.base.category as StructureType, structure.metadata.mine_kind) || "Structure";
    originalName = `${structureTypeName} ${structure.entity_id}`;
  }

  return { name: cachedName || originalName, originalName };
};

export const getVillageName = (
  structure: NativeRows["Structure"],
  parentRealmPosition: { col: number; row: number },
) => {
  const direction = getDirectionBetweenAdjacentHexes(parentRealmPosition, {
    col: structure.base.coord_x,
    row: structure.base.coord_y,
  });

  const directionName = direction ? DirectionName[direction] : "";

  const realmId = structure.metadata.village_realm;
  const baseName = getRealmNameById(realmId);
  return `${baseName} - ${directionName} Village`;
};

export const setEntityNameLocalStorage = (entityId: ID, name: string) => {
  localStorage.setItem(`entity-name-${entityId}`, name);
};

export const deleteEntityNameLocalStorage = (entityId: ID) => {
  localStorage.removeItem(`entity-name-${entityId}`);
};

export const getEntityNameFromLocalStorage = (entityId: ID) => {
  return localStorage.getItem(`entity-name-${entityId}`);
};

/** The name registration writes when the account has no username; every reader treats it as no name. */
export const buildFallbackPlayerName = (address: string): string => `Player-${address.slice(-6)}`;
export const isFallbackPlayerName = (name: string): boolean => /^Player-[0-9a-fA-F]{6}$/.test(name);

/** The one display rule for a player: the resolved name, else the registration fallback, never an address. */
export const displayPlayerName = (address: ContractAddress | string, name: string | null | undefined): string =>
  name || buildFallbackPlayerName(typeof address === "string" ? address : `0x${address.toString(16)}`);

export const getAddressName = (address: ContractAddress, store: NativeFactStore) => {
  const internalName = getInternalAddressName(address.toString());
  if (internalName) return internalName;

  const addressBigInt = BigInt(address);
  const addressName = store.get("AddressName", { address: addressBigInt });
  if (!addressName) return undefined;
  const name = shortString.decodeShortString(addressName.name.toString());
  return isFallbackPlayerName(name) ? undefined : name;
};

export const getAddressNameFromEntity = (entityId: ID, store: NativeFactStore): string | undefined => {
  const address = getAddressFromStructureEntity(entityId, store);
  return address ? getAddressName(address, store) : undefined;
};

export const getAddressFromStructureEntity = (entityId: ID, store: NativeFactStore): ContractAddress | undefined => {
  return store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: entityId })?.owner;
};

export const getInternalAddressName = (address: string): string | undefined => {
  const normalizedAddress = BigInt(address).toString();
  return knownAddressesJSON[normalizedAddress];
};
