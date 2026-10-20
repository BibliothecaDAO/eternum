import { safeInteger } from "./safe-integer";
import { entityMapPosition } from "./tile";
import { structureMapPosition } from "./expeditions";
import {
  armyName,
  CapacityConfig,
  ContractAddress,
  ID,
  NEUTRAL_OWNER_NAME,
  StructureType,
  siteName,
  type StructureNamingMode,
} from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { shortString } from "starknet";
import knownAddressesJSONData from "../data/known-addresses.json";
import { configManager } from "../managers/config-manager";
import { getHyperstructureName } from "./hyperstructure";
import { getRealmNameById } from "./realm";
import { isViewerOwner } from "./viewer";

const knownAddressesJSON: Record<string, string> = knownAddressesJSONData;

export const getEntityInfo = (
  entityId: ID,
  playerAccount: ContractAddress | null,
  store: NativeFactStore,
  mode: StructureNamingMode,
) => {
  const game_id = configManager.getActiveGameId();

  const explorer = store.get("ExplorerTroops", { game_id, explorer_id: entityId });
  const structure = store.get("Structure", { game_id, entity_id: entityId });

  let name = undefined;
  if (explorer) {
    const armyName = getArmyName(safeInteger(explorer.explorer_id), store);
    name = {
      name: armyName,
      originalName: armyName,
    };
  } else {
    if (structure) {
      name = getStructureName(structure, mode);
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
  return named && named.name !== 0n ? shortString.decodeShortString(named.name.toString()) : armyName(armyEntityId);
};

const getRealmName = (structure: NativeRows["Structure"]) => {
  const baseName = getRealmNameById(structure.metadata.realm_id);
  return structure.metadata.has_wonder ? `WONDER - ${baseName}` : baseName;
};

/**
 * A site's name (every structure but a realm and a Hyperstructure), the one its map plate, its card, every list and
 * every story read: the name its holder gave it, else its generated name ("Gloomsgrasp"). It needs only the site's id,
 * so a site whose Structure is gone (a cleared site's receipt) or not yet synced is named by the same rule.
 */
export const siteDisplayName = (entityId: ID): string => getEntityNameFromLocalStorage(entityId) || siteName(entityId);

/**
 * A structure's name, and the name it had before its holder renamed it (originalName, which the rename control shows).
 * A site is named by siteDisplayName, the rule every reader of a site shares.
 */
export const getStructureName = (structure: NativeRows["Structure"], mode: StructureNamingMode) => {
  const entityId = safeInteger(structure.entity_id);
  if (structure.base.category !== StructureType.Realm && structure.base.category !== StructureType.Hyperstructure) {
    return { name: siteDisplayName(entityId), originalName: siteName(entityId) };
  }
  const originalName =
    structure.base.category === StructureType.Realm ? getRealmName(structure) : getHyperstructureName(structure);
  return { name: getEntityNameFromLocalStorage(entityId) || originalName, originalName };
};

/**
 * The one name a player reads for an army or a structure, on the map and in event text: its given name; else an army's
 * generated name (armyName, "Iron Wardens") and a site's (siteName, "Gloomsgrasp"), never its entity id, which is a
 * storage key, not a name. Undefined when the store holds neither (an army already gone): the caller words that.
 */
export const getEntityName = (entityId: ID, store: NativeFactStore, mode: StructureNamingMode): string | undefined => {
  const game_id = configManager.getActiveGameId();
  if (store.get("ExplorerTroops", { game_id, explorer_id: entityId })) return getArmyName(entityId, store);
  const structure = store.get("Structure", { game_id, entity_id: entityId });
  return structure ? getStructureName(structure, mode).name : undefined;
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

/**
 * The one display rule for an owner: the Vanguard for the zero address, which holds what no player does; else the
 * player's claimed name, else the unclaimed one; never an address.
 */
export const displayPlayerName = (address: ContractAddress | string, name: string | null | undefined): string =>
  BigInt(address) === 0n ? NEUTRAL_OWNER_NAME : name || unclaimedPlayerName(address);

/**
 * The name to show for a player, from the client that owns the store and its one name rule: a claimed name, the
 * unclaimed one, or that the name is waiting or unavailable (the game client's readPlayerName). Null where the client
 * names no one (a headless client); `displayPlayerName` then shows the unclaimed rule.
 */
export type PlayerNameResolver = (address: ContractAddress | string) => string | null;

export const getInternalAddressName = (address: string): string | undefined => {
  const normalizedAddress = BigInt(address).toString();
  return knownAddressesJSON[normalizedAddress];
};
