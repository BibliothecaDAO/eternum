import {
  BASE_POPULATION_CAPACITY,
  BUILDING_POPULATION,
  findResourceIdByTrait,
  type ID,
  orders,
  type RealmInterface,
} from "@bibliothecadao/eternum";
import realmsJson from "../../data/geodata/realms.json";
import { packResources } from "./packedData";
import { getPosition } from "./utils";

interface Attribute {
  trait_type: string;
  value: any;
}

let realms: Record<string, any> = {};

const loadRealms = async () => {
  const response = await fetch("/jsons/realms.json");
  realms = await response.json();
};

loadRealms();

export const getRealmNameById = (realmId: ID): string => {
  const features = realmsJson.features[realmId - 1];
  if (!features) return "";
  return features.name;
};

export function getRealm(realmId: ID): RealmInterface | undefined {
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

  const position = getPosition(realmId);

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
    position,
  };
}

export const hasEnoughPopulationForBuilding = (realm: any, building: number) => {
  return (realm?.population || 0) + BUILDING_POPULATION[building] <= BASE_POPULATION_CAPACITY + (realm?.capacity || 0);
};
