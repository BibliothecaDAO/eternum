import {
  BlitzStructureTypeToNameMapping,
  CapacityConfig,
  ClientComponents,
  ContractAddress,
  DirectionName,
  getDirectionBetweenAdjacentHexes,
  ID,
  StructureType,
} from "@bibliothecadao/types";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import knownAddressesJSONData from "../data/known-addresses.json";
import { configManager } from "../managers/config-manager";
import { getRealmNameById } from "./realm";

const knownAddressesJSON: Record<string, string> = knownAddressesJSONData;

export const getEntityInfo = (
  entityId: ID,
  playerAccount: ContractAddress,
  components: ClientComponents,
  isBlitz: boolean,
) => {
  const { Structure, ExplorerTroops } = components;
  const entityIdBigInt = BigInt(entityId);

  const explorer = getComponentValue(ExplorerTroops, getEntityIdFromKeys([entityIdBigInt]));
  const structure = getComponentValue(Structure, getEntityIdFromKeys([entityIdBigInt]));

  let name = undefined;
  if (explorer) {
    const armyName = getArmyName(explorer.explorer_id);
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
    const structureOwner = getComponentValue(Structure, getEntityIdFromKeys([BigInt(explorer.owner)]));
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
        ? { x: structure.base.coord_x, y: structure.base.coord_y }
        : undefined,
    owner,
    isMine: ContractAddress(owner || 0n) === playerAccount,
    structureCategory: structure?.base.category,
    structure,
    name,
  };
};

export const getArmyName = (armyEntityId: ID) => {
  return `Army ${armyEntityId}`;
};

const getRealmName = (structure: ComponentValue<ClientComponents["Structure"]["schema"]>) => {
  const baseName = getRealmNameById(structure.metadata.realm_id);
  return structure.metadata.has_wonder ? `WONDER - ${baseName}` : baseName;
};

export const getStructureName = (
  structure: ComponentValue<ClientComponents["Structure"]["schema"]>,
  isBlitz: boolean,
  parentRealmContractPosition?: { col: number; row: number },
) => {
  const cachedName = getEntityNameFromLocalStorage(structure.entity_id);
  let originalName = undefined;

  if (structure.base.category === StructureType.Realm) {
    originalName = getRealmName(structure);
  } else if (structure.base.category === StructureType.Village && parentRealmContractPosition) {
    originalName = getVillageName(structure, parentRealmContractPosition);
  } else {
    if (isBlitz) {
      originalName = `${BlitzStructureTypeToNameMapping[structure.base.category as StructureType]} ${structure.entity_id}`;
    } else {
      originalName = `${StructureType[structure.base.category]} ${structure.entity_id}`;
    }
  }

  return { name: cachedName || originalName, originalName };
};

export const getVillageName = (
  structure: ComponentValue<ClientComponents["Structure"]["schema"]>,
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

export const getAddressName = (address: ContractAddress, components: ClientComponents) => {
  const internalName = getInternalAddressName(address.toString());
  if (internalName) return internalName;

  const addressBigInt = BigInt(address);
  const addressName = getComponentValue(components.AddressName, getEntityIdFromKeys([addressBigInt]));

  return addressName ? shortString.decodeShortString(addressName.name.toString()) : undefined;
};

export const getAddressNameFromEntity = (entityId: ID, components: ClientComponents): string | undefined => {
  const address = getAddressFromStructureEntity(entityId, components);
  if (!address) return undefined;

  const internalName = getInternalAddressName(address.toString());
  if (internalName) return internalName;

  const addressName = getComponentValue(components.AddressName, getEntityIdFromKeys([BigInt(address)]));
  return addressName ? shortString.decodeShortString(addressName.name.toString()) : undefined;
};

export const getAddressFromStructureEntity = (
  entityId: ID,
  components: ClientComponents,
): ContractAddress | undefined => {
  return getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(entityId)]))?.owner || undefined;
};

export const getInternalAddressName = (address: string): string | undefined => {
  const normalizedAddress = BigInt(address).toString();
  return knownAddressesJSON[normalizedAddress];
};
