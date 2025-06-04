import { ClientComponents, findResourceIdByTrait, ID, orders, RealmInfo, RealmInterface } from "@bibliothecadao/types";
import { Entity, getComponentValue } from "@dojoengine/recs";
import { configManager, getAddressNameFromEntity, ResourceManager } from "..";
import realmsJson from "../data/realms.json";
import { packValues, unpackValue } from "./packed-data";

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

  if (structure) {
    const realm_id = structure.metadata.realm_id;
    const order = structure.metadata.order;
    const level = structure.base.level;
    const entity_id = structure.entity_id;
    const produced_resources = structure.resources_packed;

    const resources = unpackValue(BigInt(produced_resources));

    const resourceManager = new ResourceManager(components, entity_id);

    return {
      realmId: realm_id,
      entityId: entity_id,
      category: structure.category,
      level,
      resources,
      order,
      storehouses: resourceManager.getStoreCapacityKg(),
      position: { x: structure.base.coord_x, y: structure.base.coord_y },
      population: structureBuildings?.population.current,
      capacity: structureBuildings?.population.max,
      hasCapacity:
        !structureBuildings?.population ||
        structureBuildings.population.max + configManager.getBasePopulationCapacity() >
          structureBuildings.population.current,
      owner: structure?.owner,
      ownerName: getAddressNameFromEntity(entity_id, components) || "",
      hasWonder: structure.metadata.has_wonder,
      structure,
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

  return (realm?.population || 0) + buildingPopulation <= basePopulationCapacity + (realm?.capacity || 0);
};

export const maxLayer = (realmCount: number): number => {
  // Calculate the maximum layer on the concentric hexagon
  // that can be built on based on realm count

  if (realmCount <= 1500) {
    return 26; // 2105 capacity
  }

  if (realmCount <= 2500) {
    return 32; // 3167 capacity
  }

  if (realmCount <= 3500) {
    return 37; // 4217 capacity
  }

  if (realmCount <= 4500) {
    return 41; // 5165 capacity
  }

  if (realmCount <= 5500) {
    return 45; // 6209 capacity
  }

  if (realmCount <= 6500) {
    return 49; // 7349 capacity
  }

  return 52; // 8267 capacity
};
