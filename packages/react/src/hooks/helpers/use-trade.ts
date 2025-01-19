import {
  ContractAddress,
  ID,
  MarketInterface,
  Resource,
  ResourcesIds,
  getRealmNameById,
} from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Entity, HasValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { shortString } from "starknet";
import { useDojo, useNextBlockTimestamp, usePlayerRealms } from "../";

type TradeResourcesFromViewpoint = {
  resourcesGet: Resource[];
  resourcesGive: Resource[];
};

type TradeResources = {
  takerGets: Resource[];
  makerGets: Resource[];
};

export function useTrade() {
  const {
    setup: {
      components: { Resource, Trade, Realm, DetachedResource, EntityName },
    },
  } = useDojo();

  const getDetachedResources = (entityId: ID): Resource[] => {
    let resources = [];
    let index = 0n;
    let detachedResource = getComponentValue(DetachedResource, getEntityIdFromKeys([BigInt(entityId), index]));
    while (detachedResource) {
      resources.push({ resourceId: detachedResource.resource_type, amount: Number(detachedResource.resource_amount) });
      index++;
      detachedResource = getComponentValue(DetachedResource, getEntityIdFromKeys([BigInt(entityId), index]));
    }
    return resources;
  };

  const getTradeResources = (tradeId: ID): TradeResources => {
    let trade = getComponentValue(Trade, getEntityIdFromKeys([BigInt(tradeId)]));

    if (!trade) return { takerGets: [], makerGets: [] };

    let takerGets = getDetachedResources(trade.maker_gives_resources_id);

    let makerGets = getDetachedResources(trade.taker_gives_resources_id);

    return { takerGets, makerGets };
  };

  const getTradeResourcesFromEntityViewpoint = (entityId: ID, tradeId: ID): TradeResourcesFromViewpoint => {
    let trade = getComponentValue(Trade, getEntityIdFromKeys([BigInt(tradeId)]));

    if (!trade) return { resourcesGet: [], resourcesGive: [] };

    let resourcesGet =
      trade.maker_id === entityId
        ? getDetachedResources(trade.taker_gives_resources_id)
        : getDetachedResources(trade.maker_gives_resources_id);

    let resourcesGive =
      trade.maker_id === entityId
        ? getDetachedResources(trade.maker_gives_resources_id)
        : getDetachedResources(trade.taker_gives_resources_id);

    return { resourcesGet, resourcesGive };
  };

  function computeTrades(entityIds: Entity[], nextBlockTimestamp: number) {
    const trades = entityIds
      .map((id) => {
        let trade = getComponentValue(Trade, id);
        if (trade) {
          const { takerGets, makerGets } = getTradeResources(trade.trade_id);

          const makerRealm = getComponentValue(Realm, getEntityIdFromKeys([BigInt(trade.maker_id)]));
          const makerName = getComponentValue(EntityName, getEntityIdFromKeys([BigInt(trade.maker_id)]))?.name;

          const realm = getComponentValue(Realm, getEntityIdFromKeys([BigInt(trade.maker_id)]));
          if (trade.expires_at > nextBlockTimestamp) {
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
  }

  const canAcceptOffer = ({
    realmEntityId,
    resourcesGive,
  }: {
    realmEntityId: ID;
    resourcesGive: Resource[];
  }): boolean => {
    let canAccept = true;
    Object.values(resourcesGive).forEach((resource) => {
      const realmResource = getComponentValue(
        Resource,
        getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resource.resourceId)]),
      );
      if (realmResource === undefined || realmResource.balance < resource.amount) {
        canAccept = false;
      }
    });
    return canAccept;
  };

  return {
    getTradeResources,
    getTradeResourcesFromEntityViewpoint,
    canAcceptOffer,
    computeTrades,
  };
}

export function useSetMarket() {
  const {
    account: { account },
    setup: {
      components: { Status, Trade },
    },
  } = useDojo();

  const playerRealms = usePlayerRealms(ContractAddress(account.address));

  const { nextBlockTimestamp } = useNextBlockTimestamp();

  const { computeTrades } = useTrade();

  const allMarket = useEntityQuery([HasValue(Status, { value: 0n }), HasValue(Trade, { taker_id: 0 })]);
  const allTrades = useMemo(() => {
    return computeTrades(allMarket, nextBlockTimestamp!);
  }, [allMarket]);

  const userTrades = useMemo(() => {
    return allTrades.filter((trade) => playerRealms.map((realm) => realm.entity_id).includes(trade.makerId));
  }, [allTrades]);

  const bidOffers = useMemo(() => {
    if (!allTrades) return [];

    return [...allTrades].filter(
      (offer) => offer.takerGets.length === 1 && offer.takerGets[0]?.resourceId === ResourcesIds.Lords,
    );
  }, [allTrades]);

  const askOffers = useMemo(() => {
    if (!allTrades) return [];

    return [...allTrades].filter(
      (offer) => offer.takerGets.length === 1 && offer.makerGets[0]?.resourceId === ResourcesIds.Lords,
    );
  }, [allTrades]);

  return {
    userTrades,
    bidOffers,
    askOffers,
  };
}

const calculateRatio = (resourcesGive: Resource[], resourcesGet: Resource[]) => {
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
