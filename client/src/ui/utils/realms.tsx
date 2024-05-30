import realmsJson from "../../data/geodata/realms.json";
import realmsOrdersJson from "../../data/geodata/realms_raw.json";
import realmsHexPositions from "../../data/geodata/hex/realmHexPositions.json";
import { BASE_POPULATION_CAPACITY, BUILDING_POPULATION, findResourceIdByTrait, orders } from "@bibliothecadao/eternum";
import { packResources } from "./packedData";
import { RealmInterface } from "@bibliothecadao/eternum";
import { getPosition } from "./utils";

interface Attribute {
  trait_type: string;
  value: any;
}

let realms: {
  [key: string]: any;
} = {};

export const loadRealms = async () => {
  const response = await fetch("/jsons/realms.json");
  realms = await response.json();
};

loadRealms();

export const getRealmIdByPosition = (position: { x: number; y: number }): bigint | undefined => {
  let realmPositions = realmsHexPositions as { [key: number]: { col: number; row: number }[] };
  for (let realmId of Object.keys(realmPositions)) {
    if (
      realmPositions[Number(realmId)][0].col === position.x &&
      realmPositions[Number(realmId)][0].row === position.y
    ) {
      return BigInt(realmId);
    }
  }
  return undefined;
};

export const getRealmNameById = (realmId: bigint): string => {
  const features = realmsJson["features"][Number(realmId) - 1];
  if (!features) return "";
  return features["name"];
};

export const getRealmOrderNameById = (realmId: bigint): string => {
  const orderName = realmsOrdersJson[Number(realmId) - 1];
  if (!orderName) return "";
  return orderName.order.toLowerCase().replace("the ", "");
};

export function getRealm(realmId: bigint): RealmInterface | undefined {
  const realmsData = realms;
  const realm = realmsData[realmId.toString()];
  if (!realm) return;
  const resourceIds = realm.attributes
    .filter(({ trait_type }: Attribute) => trait_type === "Resource")
    .map(({ value }: Attribute) => findResourceIdByTrait(value));
  const resourceTypesPacked = BigInt(packResources(resourceIds));
  let cities: number = 0;
  realm.attributes.forEach(({ trait_type, value }: Attribute) => {
    if (trait_type === "Cities") {
      cities = value;
    }
  });
  let harbors: number = 0;
  realm.attributes.forEach(({ trait_type, value }: Attribute) => {
    if (trait_type === "Harbors") {
      harbors = value;
    }
  });
  let rivers: number = 0;
  realm.attributes.forEach(({ trait_type, value }: Attribute) => {
    if (trait_type === "Rivers") {
      rivers = value;
    }
  });
  let regions: number = 0;
  realm.attributes.forEach(({ trait_type, value }: Attribute) => {
    if (trait_type === "Regions") {
      regions = value;
    }
  });

  const wonder: number = 1;

  let order: number = 0;
  realm.attributes.forEach(({ trait_type, value }: Attribute) => {
    if (trait_type === "Order") {
      const name: string = value.split(" ").pop() || "";
      orders.forEach(({ orderId, orderName }) => {
        if (name === orderName) {
          order = orderId;
        }
      });
    }
  });

  let position = getPosition(realmId);

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
