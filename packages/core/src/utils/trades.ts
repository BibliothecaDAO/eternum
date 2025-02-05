import { Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { ContractComponents, ID, MarketInterface, Resource, ResourcesIds, getRealmNameById } from "..";

export type TradeResourcesFromViewpoint = {
  resourcesGet: Resource[];
  resourcesGive: Resource[];
};

export type TradeResources = {
  takerGets: Resource[];
  makerGets: Resource[];
};

export const getDetachedResources = (entityId: ID, components: ContractComponents): Resource[] => {
  let resources = [];
  let index = 0n;
  let detachedResource = getComponentValue(components.DetachedResource, getEntityIdFromKeys([BigInt(entityId), index]));
  while (detachedResource) {
    resources.push({
      resourceId: detachedResource.resource_type,
      amount: Number(detachedResource.resource_amount),
    });
    index++;
    detachedResource = getComponentValue(components.DetachedResource, getEntityIdFromKeys([BigInt(entityId), index]));
  }
  return resources;
};

export const getTradeResources = (tradeId: ID, components: ContractComponents): TradeResources => {
  let trade = getComponentValue(components.Trade, getEntityIdFromKeys([BigInt(tradeId)]));

  if (!trade) return { takerGets: [], makerGets: [] };

  let takerGets = getDetachedResources(trade.maker_gives_resources_id, components);
  let makerGets = getDetachedResources(trade.taker_gives_resources_id, components);

  return { takerGets, makerGets };
};

export const getTradeResourcesFromEntityViewpoint = (
  entityId: ID,
  tradeId: ID,
  components: ContractComponents,
): TradeResourcesFromViewpoint => {
  let trade = getComponentValue(components.Trade, getEntityIdFromKeys([BigInt(tradeId)]));

  if (!trade) return { resourcesGet: [], resourcesGive: [] };

  let resourcesGet =
    trade.maker_id === entityId
      ? getDetachedResources(trade.taker_gives_resources_id, components)
      : getDetachedResources(trade.maker_gives_resources_id, components);

  let resourcesGive =
    trade.maker_id === entityId
      ? getDetachedResources(trade.maker_gives_resources_id, components)
      : getDetachedResources(trade.taker_gives_resources_id, components);

  return { resourcesGet, resourcesGive };
};

export const computeTrades = (entityIds: Entity[], currentBlockTimestamp: number, components: ContractComponents) => {
  const trades = entityIds
    .map((id) => {
      let trade = getComponentValue(components.Trade, id);
      if (trade) {
        const { takerGets, makerGets } = getTradeResources(trade.trade_id, components);

        const makerRealm = getComponentValue(components.Realm, getEntityIdFromKeys([BigInt(trade.maker_id)]));
        const makerName = getComponentValue(components.EntityName, getEntityIdFromKeys([BigInt(trade.maker_id)]))?.name;

        const realm = getComponentValue(components.Realm, getEntityIdFromKeys([BigInt(trade.maker_id)]));

        if (trade.expires_at > currentBlockTimestamp) {
          return {
            makerName: shortString.decodeShortString(makerName?.toString() || ""),
            originName: getRealmNameById(realm?.realm_id || 0),
            tradeId: trade.trade_id,
            makerId: trade.maker_id,
            takerId: trade.taker_id,
            makerOrder: makerRealm?.order,
            expiresAt: Number(trade.expires_at),
            takerGets,
            makerGets,
            ratio: calculateRatio(makerGets, takerGets),
            perLords:
              takerGets[0]?.resourceId == ResourcesIds.Lords
                ? calculateRatio(makerGets, takerGets)
                : calculateRatio(takerGets, makerGets),
          } as MarketInterface;
        }
      }
    })
    .filter(Boolean) as MarketInterface[];
  return trades;
};

export const canAcceptOffer = (
  {
    realmEntityId,
    resourcesGive,
  }: {
    realmEntityId: ID;
    resourcesGive: Resource[];
  },
  components: ContractComponents,
): boolean => {
  let canAccept = true;
  Object.values(resourcesGive).forEach((resource) => {
    const realmResource = getComponentValue(
      components.Resource,
      getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resource.resourceId)]),
    );
    if (realmResource === undefined || realmResource.balance < resource.amount) {
      canAccept = false;
    }
  });
  return canAccept;
};

export const calculateRatio = (resourcesGive: Resource[], resourcesGet: Resource[]) => {
  let quantityGive = 0;
  for (let i = 0; i < resourcesGive.length; i++) {
    quantityGive += resourcesGive[i].amount;
  }
  let quantityGet = 0;
  for (let i = 0; i < resourcesGet.length; i++) {
    quantityGet += resourcesGet[i].amount;
  }
  return quantityGet / quantityGive;
};
