import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { configManager } from "../managers/config-manager";
import { CapacityConfig, StructureType, ClientComponents, ContractAddress, EntityType, ID } from "@bibliothecadao/types";
import { getRealmNameById } from "./realm";

export const getEntityInfo = (entityId: ID, playerAccount: ContractAddress, components: ClientComponents) => {
  const { Structure, ExplorerTroops } = components;
  const entityIdBigInt = BigInt(entityId);

  const explorer = getComponentValue(ExplorerTroops, getEntityIdFromKeys([entityIdBigInt]));

  const name = getEntityName(entityId, components);

  const structure = getComponentValue(Structure, getEntityIdFromKeys([entityIdBigInt]));

  let owner = undefined;

  if (explorer) {
    owner = explorer.owner;
    const structureOwner = getComponentValue(Structure, getEntityIdFromKeys([BigInt(explorer.owner)]));
    owner = structureOwner?.owner;
  } else if (structure) {
    owner = structure.owner;
  }

  const capacityCategoryId = explorer
    ? CapacityConfig.Army
    : structure
      ? CapacityConfig.Storehouse
      : structure
        ? CapacityConfig.Structure
        : CapacityConfig.None;
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
    entityType: explorer ? EntityType.TROOP : EntityType.DONKEY,
    structureCategory: structure?.base.category,
    structure,
    name,
  };
};

const getRealmName = (structure: ComponentValue<ClientComponents["Structure"]["schema"]>) => {
  const baseName = getRealmNameById(structure.metadata.realm_id);
  return structure.metadata.has_wonder ? `WONDER - ${baseName}` : baseName;
};

export const getEntityName = (entityId: ID, components: ClientComponents, abbreviate: boolean = false) => {
  const entityName = getComponentValue(components.AddressName, getEntityIdFromKeys([BigInt(entityId)]));
  const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(entityId)]));
  if (!structure) return "";
  if (structure.base.category === StructureType.Realm) {
    return getRealmName(structure);
  }

  if (entityName) {
    return shortString.decodeShortString(entityName.name.toString());
  }

  if (abbreviate) {
    const abbreviations: Record<string, string> = {
      FragmentMine: "FM",
      Hyperstructure: "HS",
      Bank: "BK",
    };

    const abbr = abbreviations[structure.base.category];
    if (abbr) {
      return `${abbr} ${structure.entity_id}`;
    }
  }
  return `${StructureType[structure.base.category]} ${structure.entity_id}`;
};

export const getAddressName = (address: ContractAddress, components: ClientComponents) => {
  const addressName = getComponentValue(components.AddressName, getEntityIdFromKeys([BigInt(address)]));

  return addressName ? shortString.decodeShortString(addressName.name.toString()) : undefined;
};

export const getAddressNameFromEntity = (entityId: ID, components: ClientComponents) => {
  const address = getAddressFromStructureEntity(entityId, components);
  if (!address) return;
  const addressName = getComponentValue(components.AddressName, getEntityIdFromKeys([BigInt(address)]));

  return addressName ? shortString.decodeShortString(addressName.name.toString()) : undefined;
};

export const getAddressFromStructureEntity = (
  entityId: ID,
  components: ClientComponents,
): ContractAddress | undefined => {
  return getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(entityId)]))?.owner || undefined;
};
