import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { divideByPrecision } from ".";
import { CapacityConfig } from "../constants";
import { ClientComponents } from "../dojo";
import { configManager } from "../managers/config-manager";
import { ContractAddress, EntityType, ID } from "../types";
import { getRealmNameById } from "./realm";
import { getResourcesFromBalance } from "./resources";

export const getEntityInfo = (
  entityId: ID,
  playerAccount: ContractAddress,
  currentDefaultTick: number,
  components: ClientComponents,
) => {
  const { EntityOwner, Owner, Structure, Position, ExplorerTroops, Realm } = components;
  const entityIdBigInt = BigInt(entityId);

  const explorer = getComponentValue(ExplorerTroops, getEntityIdFromKeys([entityIdBigInt]));

  const entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([entityIdBigInt]));
  const owner = getComponentValue(Owner, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]));

  const name = getEntityName(entityId, components);

  const structure = getComponentValue(Structure, getEntityIdFromKeys([entityIdBigInt]));
  const realm = getComponentValue(Realm, getEntityIdFromKeys([entityIdBigInt]));

  const capacityCategoryId = explorer
    ? CapacityConfig.Army
    : realm
      ? CapacityConfig.Storehouse
      : structure
        ? CapacityConfig.Structure
        : CapacityConfig.None;
  const capacity = configManager.getCapacityConfig(capacityCategoryId);

  const resources = getResourcesFromBalance(entityId, currentDefaultTick, components);
  const position = getComponentValue(Position, getEntityIdFromKeys([entityIdBigInt]));

  const homePosition = entityOwner
    ? getComponentValue(Position, getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]))
    : undefined;

  return {
    entityId,
    capacity: divideByPrecision(Number(capacity) || 0),
    position: position ? { x: position.x, y: position.y } : undefined,
    homePosition: homePosition ? { x: homePosition.x, y: homePosition.y } : undefined,
    owner: owner?.address,
    isMine: ContractAddress(owner?.address || 0n) === playerAccount,
    resources,
    entityType: explorer ? EntityType.TROOP : EntityType.DONKEY,
    structureCategory: structure?.category,
    structure,
    name,
  };
};

const getRealmName = (realm: ComponentValue<ClientComponents["Realm"]["schema"]>) => {
  const baseName = getRealmNameById(realm.realm_id);
  return realm.has_wonder ? `WONDER - ${baseName}` : baseName;
};

export const getEntityName = (entityId: ID, components: ClientComponents, abbreviate: boolean = false) => {
  const entityName = getComponentValue(components.AddressName, getEntityIdFromKeys([BigInt(entityId)]));
  const realm = getComponentValue(components.Realm, getEntityIdFromKeys([BigInt(entityId)]));
  const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(entityId)]));
  if (structure?.category === "Realm" && realm) {
    return getRealmName(realm);
  }

  if (entityName) {
    return shortString.decodeShortString(entityName.name.toString());
  }

  if (abbreviate && structure) {
    const abbreviations: Record<string, string> = {
      FragmentMine: "FM",
      Hyperstructure: "HS",
      Bank: "BK",
    };

    const abbr = abbreviations[structure.category];
    if (abbr) {
      return `${abbr} ${structure.entity_id}`;
    }
  }
  return `${structure?.category} ${structure?.entity_id}`;
};

export const getAddressName = (address: ContractAddress, components: ClientComponents) => {
  const addressName = getComponentValue(components.AddressName, getEntityIdFromKeys([BigInt(address)]));

  return addressName ? addressName.name.toString() : undefined;
};

export const getAddressNameFromEntity = (entityId: ID, components: ClientComponents) => {
  const address = getAddressFromEntity(entityId, components);
  if (!address) return;

  const addressName = getComponentValue(components.AddressName, getEntityIdFromKeys([BigInt(address)]));

  return addressName ? addressName.name.toString() : undefined;
};

export const getAddressFromEntity = (entityId: ID, components: ClientComponents): ContractAddress | undefined => {
  const entityOwner = getComponentValue(components.EntityOwner, getEntityIdFromKeys([BigInt(entityId)]));
  return entityOwner?.entity_owner_id
    ? getComponentValue(components.Owner, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]))?.address
    : undefined;
};
