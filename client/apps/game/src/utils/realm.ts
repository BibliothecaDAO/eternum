import { configManager } from "@/dojo/setup";
import { ClientComponents, ID, RealmInfo } from "@bibliothecadao/eternum";
import { Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import realmsJson from "../../../../common/data/realms.json";

export const getRealmAddressName = (realmEntityId: ID, components: ClientComponents) => {
  const owner = getComponentValue(components.Owner, getEntityIdFromKeys([BigInt(realmEntityId)]));
  const addressName = owner
    ? getComponentValue(components.AddressName, getEntityIdFromKeys([owner.address]))
    : undefined;

  if (addressName) {
    return shortString.decodeShortString(String(addressName.name));
  } else {
    return "";
  }
};

let realms: {
  [key: string]: any;
} = {};

const loadRealms = async () => {
  const response = await fetch("/jsons/realms.json");
  realms = await response.json();
};

loadRealms();

const getRealmNameById = (realmId: ID): string => {
  const features = realmsJson["features"][realmId - 1];
  if (!features) return "";
  return features["name"];
};

export function getRealmInfo(entity: Entity, components: ClientComponents): RealmInfo | undefined {
  const realm = getComponentValue(components.Realm, entity);
  const owner = getComponentValue(components.Owner, entity);
  const position = getComponentValue(components.Position, entity);
  const population = getComponentValue(components.Population, entity);

  if (realm && owner && position) {
    const { realm_id, entity_id, produced_resources, order, level } = realm;

    const name = getRealmNameById(realm_id);

    const { address } = owner;

    return {
      realmId: realm_id,
      entityId: entity_id,
      name,
      level,
      resourceTypesPacked: produced_resources,
      order,
      position,
      ...population,
      hasCapacity:
        !population || population.capacity + configManager.getBasePopulationCapacity() > population.population,
      owner: address,
      ownerName: getRealmAddressName(realm.entity_id, components),
      hasWonder: realm.has_wonder,
    };
  }
}
