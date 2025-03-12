import { Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { configManager, gramToKg } from "..";
import { BuildingType, CapacityConfig, findResourceIdByTrait, orders, StructureType } from "../constants";
import realmsJson from "../data/realms.json";
import { ClientComponents } from "../dojo";
import { ID, RealmInfo, RealmInterface, RealmWithPosition } from "../types";
import { getBuildingCount, packValues, unpackValue } from "./packed-data";

export const getRealmWithPosition = (entity: Entity, components: ClientComponents) => {
  const { Structure } = components;
  const structure = getComponentValue(Structure, entity);
  if (structure?.base.category !== StructureType.Realm) return undefined;

  return {
    ...structure,
    resources: unpackValue(BigInt(structure.resources_packed)),
    position: { x: structure?.base.coord_x, y: structure?.base.coord_y },
    name: getRealmNameById(structure.metadata.realm_id),
    owner: structure?.owner,
  } as RealmWithPosition;
};

export const getRealmAddressName = (realmEntityId: ID, components: ClientComponents) => {
  // use value strict because we know the structure exists
  const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(realmEntityId)]));
  if (!structure) return "";
  const addressName = getComponentValue(components.AddressName, getEntityIdFromKeys([structure.owner]));

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
  const structure = getComponentValue(components.Structure, entity);
  const structureBuildings = getComponentValue(components.StructureBuildings, entity);

  const buildingCounts = [
    structureBuildings?.packed_counts_1 || 0n,
    structureBuildings?.packed_counts_2 || 0n,
    structureBuildings?.packed_counts_3 || 0n,
  ];

  const storehouseQuantity = getBuildingCount(BuildingType.Storehouse, buildingCounts) || 0;

  const storehouses = (() => {
    const storehouseCapacity = configManager.getCapacityConfig(CapacityConfig.Storehouse);
    return { capacityKg: (storehouseQuantity + 1) * gramToKg(storehouseCapacity), quantity: storehouseQuantity };
  })();

  if (structure) {
    const realm_id = structure.metadata.realm_id;
    const order = structure.metadata.order;
    const level = structure.base.level;
    const entity_id = structure.entity_id;
    const produced_resources = structure.resources_packed;

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
      owner: structure?.owner,
      ownerName: getRealmAddressName(entity_id, components),
      hasWonder: structure.metadata.has_wonder,
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
  const buildingPopulation = configManager.getBuildingCategoryConfig(building).population_cost;
  const basePopulationCapacity = configManager.getBasePopulationCapacity();

  console.log({ buildingPopulation, basePopulationCapacity, realm, building });

  return (realm?.population || 0) + buildingPopulation <= basePopulationCapacity + (realm?.capacity || 0);
};
