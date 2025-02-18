import { Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { configManager, gramToKg } from "..";
import { BuildingType, CapacityConfig, findResourceIdByTrait, orders } from "../constants";
import realmsJson from "../data/realms.json";
import { ClientComponents } from "../dojo";
import { ID, RealmInfo, RealmInterface, RealmWithPosition } from "../types";
import { packResources, unpackResources } from "./packed-data";

export const getRealmWithPosition = (entity: Entity, components: ClientComponents) => {
  const { Realm, Owner, Position } = components;
  const realm = getComponentValue(Realm, entity);
  if (!realm) return undefined;

  const position = getComponentValue(Position, entity);
  const owner = getComponentValue(Owner, entity);

  return {
    ...realm,
    resources: unpackResources(BigInt(realm.produced_resources)),
    position,
    name: getRealmNameById(realm.realm_id),
    owner,
  } as RealmWithPosition;
};

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

interface Attribute {
  trait_type: string;
  value: any;
}

let realms: {
  [key: string]: any;
} = {};

const loadRealms = async () => {
  if (typeof window === "undefined") return;
  const response = await fetch("/jsons/realms.json");
  realms = await response.json();
};

loadRealms();

export const getRealmNameById = (realmId: ID): string => {
  const features = realmsJson["features"][realmId - 1];
  if (!features) return "";
  return features["name"];
};

export function getRealmInfo(entity: Entity, components: ClientComponents): RealmInfo | undefined {
  const realm = getComponentValue(components.Realm, entity);
  const owner = getComponentValue(components.Owner, entity);
  const position = getComponentValue(components.Position, entity);
  const population = getComponentValue(components.Population, entity);

  const storehouses = (() => {
    const quantity =
      getComponentValue(
        components.BuildingQuantityv2,
        getEntityIdFromKeys([BigInt(realm?.entity_id || 0), BigInt(BuildingType.Storehouse)]),
      )?.value || 0;
    const storehouseCapacity = configManager.getCapacityConfig(CapacityConfig.Storehouse);
    return { capacityKg: (quantity + 1) * gramToKg(storehouseCapacity), quantity };
  })();

  if (realm && owner && position) {
    const { realm_id, entity_id, produced_resources, order, level } = realm;

    const name = getRealmNameById(realm_id);

    const resources = unpackResources(BigInt(produced_resources));

    const { address } = owner;

    return {
      realmId: realm_id,
      entityId: entity_id,
      storehouses,
      name,
      level,
      resources,
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

export function getOffchainRealm(realmId: ID): RealmInterface | undefined {
  const realmsData = realms;
  const realm = realmsData[realmId.toString()];
  if (!realm) return;

  const resourceIds = realm.attributes
    .filter(({ trait_type }: Attribute) => trait_type === "Resource")
    .map(({ value }: Attribute) => findResourceIdByTrait(value));

  const resourceTypesPacked = BigInt(packResources(resourceIds));

  const getAttributeValue = (attributeName: string): number => {
    const attribute = realm.attributes.find(({ trait_type }: Attribute) => trait_type === attributeName);
    return attribute ? attribute.value : 0;
  };

  const cities = getAttributeValue("Cities");
  const harbors = getAttributeValue("Harbors");
  const rivers = getAttributeValue("Rivers");
  const regions = getAttributeValue("Regions");

  const wonder: number = 1;

  const orderAttribute = realm.attributes.find(({ trait_type }: Attribute) => trait_type === "Order");
  const orderName = orderAttribute ? orderAttribute.value.split(" ").pop() || "" : "";
  const order = orders.find(({ orderName: name }) => name === orderName)?.orderId || 0;

  const imageUrl = realm.image;

  return {
    realmId,
    name: getRealmNameById(realmId),
    resourceTypesPacked,
    resourceTypesCount: resourceIds.length,
    cities,
    harbors,
    rivers,
    regions,
    wonder,
    order,
    imageUrl,
  };
}

export const hasEnoughPopulationForBuilding = (realm: any, building: number) => {
  const buildingPopulation = configManager.getBuildingPopConfig(building).population;
  const basePopulationCapacity = configManager.getBasePopulationCapacity();

  return (realm?.population || 0) + buildingPopulation <= basePopulationCapacity + (realm?.capacity || 0);
};
