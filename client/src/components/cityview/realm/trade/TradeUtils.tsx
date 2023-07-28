import realmsCoordsJson from "../../../../geodata/coords.json";
import realmsJson from "../../../../geodata/realms.json";
import realmsOrdersJson from "../../../../geodata/realms_raw.json";
import { Utils } from "@dojoengine/core";
import { EntityIndex } from "@latticexyz/recs";
import { Trade } from "../../../../types";
import {
  RealmResourcesInterface,
  ResourceInterface,
} from "../../../../hooks/graphql/useGraphQLQueries";

export const getRealmIdByPosition = (positionRaw: {
  x: number;
  y: number;
}): number | undefined => {
  let offset = 1800000;
  let position = { x: positionRaw.x - offset, y: positionRaw.y - offset };
  // TODO: find a better way to find position
  for (let realm of realmsCoordsJson["features"]) {
    if (
      parseInt(realm["geometry"]["coordinates"][0]) === position.x &&
      parseInt(realm["geometry"]["coordinates"][1]) === position.y
    ) {
      return realm["properties"]["tokenId"];
    }
  }
  return undefined;
};

export const getRealmNameById = (realmId: number): string | undefined => {
  for (let realm of realmsJson["features"]) {
    if (realm["id"] === realmId) {
      return realm["name"];
    }
  }
  return undefined;
};

export const getRealmOrderNameById = (realmId: number): string => {
  const orderName = realmsOrdersJson[realmId - 1].order;
  return orderName.toLowerCase().replace("the ", "");
};

export const getResourceIdsFromFungibleEntities = (
  orderId: number,
  key: number,
  count: number,
): EntityIndex[] => {
  return Array.from({ length: count }, (_, i) => {
    return Utils.getEntityIdFromKeys([BigInt(orderId), BigInt(key), BigInt(i)]);
  });
};

export const getOrderIdsFromTrade = (
  trade: Trade,
  realmEntityId: number,
): { realmOrderId: number; counterpartyOrderId: number } | undefined => {
  return trade.maker_id === realmEntityId
    ? {
        realmOrderId: trade.maker_order_id,
        counterpartyOrderId: trade.taker_order_id,
      }
    : trade.taker_id === realmEntityId
    ? {
        realmOrderId: trade.taker_order_id,
        counterpartyOrderId: trade.maker_order_id,
      }
    : undefined;
};

export const getTotalResourceWeight = (
  resources: (ResourceInterface | undefined)[],
) => {
  return resources.reduce(
    (total, resource) => total + (resource?.amount || 0) * 1,
    0,
  );
};

export const canAcceptOffer = (
  resourcesGive: ResourceInterface[],
  realmResources: RealmResourcesInterface,
): boolean => {
  let canAccept = true;
  Object.values(resourcesGive).forEach((resource) => {
    if (resource.amount > realmResources[resource.resourceId].amount) {
      canAccept = false;
    }
  });
  return canAccept;
};
