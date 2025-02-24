import { Entity, getComponentValue, getComponentValueStrict } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { configManager, gramToKg } from "..";
import { BuildingType, CapacityConfig, findResourceIdByTrait, orders } from "../constants";
import realmsJson from "../data/realms.json";
import { ClientComponents } from "../dojo";
import { ID, RealmInfo, RealmInterface, RealmWithPosition } from "../types";
import { packValues, unpackValue } from "./packed-data";

export const getRealmWithPosition = (entity: Entity, components: ClientComponents) => {
  const { Realm, Structure } = components;
  const realm = getComponentValue(Realm, entity);
  if (!realm) return undefined;

  const structure = getComponentValue(Structure, entity);

  return {
    ...realm,
    resources: unpackValue(BigInt(realm.produced_resources)),
    position: { x: structure?.base.coord_x, y: structure?.base.coord_y },
    name: getRealmNameById(realm.realm_id),
    owner: structure?.base.owner,
  } as RealmWithPosition;
};

export const getRealmAddressName = (realmEntityId: ID, components: ClientComponents) => {
  // use value strict because we know the structure exists
  const structure = getComponentValueStrict(components.Structure, getEntityIdFromKeys([BigInt(realmEntityId)]));
  const addressName = getComponentValue(components.AddressName, getEntityIdFromKeys([structure.base.owner]));

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
  const structure = getComponentValue(components.Structure, entity);
  const structureBuildings = getComponentValue(components.StructureBuildings, entity);

  const buildingCounts = unpackValue(structureBuildings?.building_count || 0n);
  const storehouseQuantity = buildingCounts[BuildingType.Storehouse] || 0;

  const storehouses = (() => {
    const storehouseCapacity = configManager.getCapacityConfig(CapacityConfig.Storehouse);
    return { capacityKg: (storehouseQuantity + 1) * gramToKg(storehouseCapacity), quantity: storehouseQuantity };
  })();

  if (realm && structure) {
    const { realm_id, entity_id, produced_resources, order, level } = realm;

    const name = getRealmNameById(realm_id);

    const resources = unpackValue(BigInt(produced_resources));

    return {
      realmId: realm_id,
      entityId: entity_id,
      storehouses,
      name,
      level,
      resources,
      order,
      position: { x: structure.base.coord_x, y: structure.base.coord_y },
      population: structureBuildings?.population.current,
      capacity: structureBuildings?.population.max,
      hasCapacity:
        !structureBuildings?.population ||
        structureBuildings.population.max + configManager.getBasePopulationCapacity() >
          structureBuildings.population.current,
      owner: structure?.base.owner,
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

  const resourceTypesPacked = BigInt(packValues(resourceIds));

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
