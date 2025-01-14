import { configManager } from "@/dojo/setup";
import { packResources } from "@/ui/utils/packed-data";
import {
  ClientComponents,
  ContractAddress,
  findResourceIdByTrait,
  getOrderName,
  ID,
  orders,
  RealmInfo,
  RealmInterface,
} from "@bibliothecadao/eternum";
import { Entity, getComponentValue, Has, HasValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import realmIdsByOrder from "../../../../common/data/realmids_by_order.json";
import realmsJson from "../../../../common/data/realms.json";

export const isRealmIdSettled = (realmId: ID, components: ClientComponents) => {
  const entityIds = runQuery([HasValue(components.Realm, { realm_id: realmId })]);
  return entityIds.size > 0;
};

export const getRandomUnsettledRealmId = (components: ClientComponents) => {
  // Query all settled realms and collect their realm_ids
  const entityIds = Array.from(runQuery([Has(components.Realm)]));
  const settledRealmIds = new Set<number>();

  entityIds.forEach((entityId) => {
    const realm = getComponentValue(components.Realm, getEntityIdFromKeys([BigInt(entityId)]));
    if (realm) {
      settledRealmIds.add(Number(realm.realm_id));
    }
  });

  // Define all possible realm_ids from 1 to 8000
  const TOTAL_REALMS = 8000;
  const allRealmIds = Array.from({ length: TOTAL_REALMS }, (_, i) => i + 1);

  // Determine unsettled realm_ids by excluding settled ones
  const unsettledRealmIds = allRealmIds.filter((id) => !settledRealmIds.has(id));

  if (unsettledRealmIds.length === 0) {
    throw new Error("No unsettled realms available.");
  }

  // Select a random unsettled realm ID
  const randomIndex = Math.floor(Math.random() * unsettledRealmIds.length);
  return unsettledRealmIds[randomIndex];
};

export const getNextRealmIdForOrder = (order: number, components: ClientComponents) => {
  const orderName = getOrderName(order);

  const entityIds = Array.from(runQuery([HasValue(components.Realm, { order })]));
  const realmEntityIds = entityIds.map((id) => {
    return getComponentValue(components.Realm, id)!.entity_id;
  });

  let latestRealmIdFromOrder = 0;
  if (realmEntityIds.length > 0) {
    const realmEntityId = realmEntityIds.sort((a, b) => Number(b) - Number(a))[0];
    const latestRealmFromOrder = getComponentValue(components.Realm, getEntityIdFromKeys([BigInt(realmEntityId)]));
    if (latestRealmFromOrder) {
      latestRealmIdFromOrder = Number(latestRealmFromOrder.realm_id);
    }
  }

  const orderRealmIds = (realmIdsByOrder as Record<string, ID[]>)[orderName];
  let nextRealmIdFromOrder = 0;

  const maxIterations = orderRealmIds.length;
  for (let i = 0; i < maxIterations; i++) {
    // sort from biggest to lowest
    const latestIndex = orderRealmIds.indexOf(latestRealmIdFromOrder);

    if (latestIndex === -1 || latestIndex === orderRealmIds.length - 1) {
      nextRealmIdFromOrder = orderRealmIds[0];
    } else {
      nextRealmIdFromOrder = orderRealmIds[latestIndex + 1];
    }

    return nextRealmIdFromOrder;
  }

  throw new Error(`Could not find an unoccupied realm ID for order ${orderName} after ${maxIterations} attempts`);
};

export const getRealmEntityIdFromRealmId = (realmId: ID, components: ClientComponents): ID | undefined => {
  const realmEntityIds = runQuery([HasValue(components.Realm, { realm_id: realmId })]);
  if (realmEntityIds.size > 0) {
    const realm = getComponentValue(components.Realm, realmEntityIds.values().next().value || ("" as Entity));
    return realm!.entity_id;
  }
};

export const getRealmIdFromRealmEntityId = (realmEntityId: ID, components: ClientComponents) => {
  const realm = getComponentValue(components.Realm, getEntityIdFromKeys([BigInt(realmEntityId)]));
  return realm?.realm_id;
};

export const getRealmIdForOrderAfter = (order: number, realmId: ID, components: ClientComponents): ID => {
  const orderName = getOrderName(order);

  const orderRealmIds = (realmIdsByOrder as Record<string, ID[]>)[orderName];
  const latestIndex = orderRealmIds.indexOf(realmId);

  if (latestIndex === -1 || latestIndex === orderRealmIds.length - 1) {
    return orderRealmIds[0];
  } else {
    return orderRealmIds[latestIndex + 1];
  }
};

export const getAddressOrder = (address: ContractAddress, components: ClientComponents) => {
  const ownedRealms = runQuery([Has(components.Realm), HasValue(components.Owner, { address })]);
  if (ownedRealms.size > 0) {
    const realm = getComponentValue(components.Realm, ownedRealms.values().next().value || ("" as Entity));
    return realm?.order;
  }
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

export const getRealmEntityIdsOnPosition = (x: number, y: number, components: ClientComponents) => {
  const entityIds = runQuery([Has(components.Realm), HasValue(components.Position, { x, y })]);
  const realmEntityIds = Array.from(entityIds).map((entityId) => {
    return getComponentValue(components.Realm, entityId)!.entity_id;
  });
  return realmEntityIds.length === 1 ? realmEntityIds[0] : undefined;
};

export const isEntityIdRealm = (entityId: ID, components: ClientComponents) => {
  const realm = getComponentValue(components.Realm, getEntityIdFromKeys([BigInt(entityId)]));
  return !!realm;
};

// todo: pay attention, lots of realms
export function getRealms(components: ClientComponents): RealmInfo[] {
  const realmEntities = runQuery([Has(components.Realm)]);

  return Array.from(realmEntities)
    .map((entity) => {
      const realm = getComponentValue(components.Realm, entity);
      const owner = getComponentValue(components.Owner, entity);
      const position = getComponentValue(components.Position, entity);
      const population = getComponentValue(components.Population, entity);

      if (!realm || !owner || !position) return null;

      const { realm_id, entity_id, produced_resources, order } = realm;

      const name = getRealmNameById(realm_id);

      const { address } = owner;

      const addressName = getComponentValue(components.AddressName, getEntityIdFromKeys([address]));
      const ownerName = shortString.decodeShortString(addressName?.name.toString() ?? "0x0");

      return {
        realmId: realm_id,
        entityId: entity_id,
        name,
        resourceTypesPacked: produced_resources,
        order,
        position,
        ...population,
        hasCapacity:
          !population || population.capacity + configManager.getBasePopulationCapacity() > population.population,
        owner: address,
        ownerName,
        hasWonder: realm.has_wonder,
      };
    })
    .filter((realm): realm is RealmInfo => realm !== null);
}

interface Attribute {
  trait_type: string;
  value: any;
}

let realms: {
  [key: string]: any;
} = {};

const loadRealms = async () => {
  const response = await fetch("/jsons/realms.json");
  realms = await response.json();
};

loadRealms();

export const getRealmNameById = (realmId: ID): string => {
  const features = realmsJson["features"][realmId - 1];
  if (!features) return "";
  return features["name"];
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
