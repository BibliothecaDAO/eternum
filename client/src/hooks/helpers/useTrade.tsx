import { getRealmNameById } from "@/ui/utils/realms";
import { MarketInterface, Resource, ResourcesIds } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Entity, HasValue, getComponentValue } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";
import { shortString } from "starknet";
import { SortInterface } from "../../ui/elements/SortButton";
import { getEntityIdFromKeys } from "../../ui/utils/utils";
import { useDojo } from "../context/DojoContext";
import useBlockchainStore from "../store/useBlockchainStore";
import useMarketStore from "../store/useMarketStore";
import useRealmStore from "../store/useRealmStore";
import { useEntities } from "./useEntities";

type TradeResourcesFromViewpoint = {
  resourcesGet: Resource[];
  resourcesGive: Resource[];
};

type TradeResources = {
  takerGets: Resource[];
  makerGets: Resource[];
};

function useTrade() {
  const {
    setup: {
      components: { Resource, Trade, Realm, DetachedResource, EntityName },
    },
  } = useDojo();

  const getDetachedResources = (entityId: bigint): Resource[] => {
    let resources = [];
    let index = 0n;
    let detachedResource = getComponentValue(DetachedResource, getEntityIdFromKeys([entityId, index]));
    while (detachedResource) {
      resources.push({ resourceId: detachedResource.resource_type, amount: Number(detachedResource.resource_amount) });
      index++;
      detachedResource = getComponentValue(DetachedResource, getEntityIdFromKeys([entityId, index]));
    }
    return resources;
  };

  const getTradeResources = (tradeId: bigint): TradeResources => {
    let trade = getComponentValue(Trade, getEntityIdFromKeys([BigInt(tradeId)]));

    if (!trade) return { takerGets: [], makerGets: [] };

    let takerGets = getDetachedResources(trade.maker_gives_resources_id);

    let makerGets = getDetachedResources(trade.taker_gives_resources_id);

    return { takerGets, makerGets };
  };

  const getTradeResourcesFromEntityViewpoint = (entityId: bigint, tradeId: bigint): TradeResourcesFromViewpoint => {
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
          const makerRealm = getComponentValue(Realm, getEntityIdFromKeys([trade.maker_id]));

          const makerName = getComponentValue(EntityName, getEntityIdFromKeys([trade.maker_id]))?.name;

          const realm = getComponentValue(Realm, getEntityIdFromKeys([trade.maker_id]));
          if (trade.expires_at > nextBlockTimestamp) {
            return {
              makerName: shortString.decodeShortString(makerName?.toString() || ""),
              originName: getRealmNameById(BigInt(realm?.realm_id || 0n)),
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
    realmEntityId: bigint;
    resourcesGive: Resource[];
  }): boolean => {
    let canAccept = true;
    Object.values(resourcesGive).forEach((resource) => {
      const realmResource = getComponentValue(
        Resource,
        getEntityIdFromKeys([realmEntityId, BigInt(resource.resourceId)]),
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

export function useGetMyOffers(): MarketInterface[] {
  const {
    setup: {
      components: { Status, Trade },
    },
  } = useDojo();

  const { computeTrades } = useTrade();

  const { realmEntityId } = useRealmStore();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const [myOffers, setMyOffers] = useState<MarketInterface[]>([]);

  const entityIds = useEntityQuery([HasValue(Status, { value: 0n }), HasValue(Trade, { maker_id: realmEntityId })]);

  useMemo((): any => {
    if (!nextBlockTimestamp) return;
    const trades = computeTrades(entityIds, nextBlockTimestamp);
    setMyOffers(trades);
    // only recompute when different number of orders
  }, [entityIds, nextBlockTimestamp]);

  return myOffers;
}

export function useSetMarket() {
  const {
    setup: {
      components: { Status, Trade },
    },
  } = useDojo();

  const { playerRealms } = useEntities();
  const realmEntityIds = playerRealms().map((realm: any) => realm.entity_id);
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const { computeTrades } = useTrade();

  const allMarket = useEntityQuery([HasValue(Status, { value: 0n }), HasValue(Trade, { taker_id: 0n })]);

  const allTrades = useMemo(() => {
    return computeTrades(allMarket, nextBlockTimestamp!);
  }, [allMarket]);

  const userTrades = useMemo(() => {
    return allTrades.filter((trade) => realmEntityIds.includes(trade.makerId));
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
