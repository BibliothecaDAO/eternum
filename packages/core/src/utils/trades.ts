import {
  ClientComponents,
  ContractComponents,
  ID,
  MarketInterface,
  Resource,
  ResourcesIds,
} from "@bibliothecadao/types";
import { Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { ResourceManager, getRealmNameById } from "..";

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
  let detachedResource = getComponentValue(components.ResourceList, getEntityIdFromKeys([BigInt(entityId), index]));
  while (detachedResource) {
    resources.push({
      resourceId: detachedResource.resource_type,
      amount: Number(detachedResource.amount),
    });
    index++;
    detachedResource = getComponentValue(components.ResourceList, getEntityIdFromKeys([BigInt(entityId), index]));
  }
  return resources;
};

export const getTradeResources = (tradeId: ID, components: ContractComponents): TradeResources => {
  let trade = getComponentValue(components.Trade, getEntityIdFromKeys([BigInt(tradeId)]));

  if (!trade) return { takerGets: [], makerGets: [] };

  let takerGets = [
    {
      resourceId: Number(trade.maker_gives_resource_type),
      amount: Number(BigInt(trade.maker_gives_min_resource_amount) * trade.maker_gives_max_count),
    },
  ];
  let makerGets = [
    {
      resourceId: Number(trade.taker_pays_resource_type),
      amount: Number(BigInt(trade.taker_pays_min_resource_amount) * trade.maker_gives_max_count),
    },
  ];

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
      ? [
          {
            resourceId: Number(trade.taker_pays_resource_type),
            amount: Number(trade.taker_pays_min_resource_amount),
          },
        ]
      : [
          {
            resourceId: Number(trade.maker_gives_resource_type),
            amount: Number(trade.maker_gives_min_resource_amount),
          },
        ];

  let resourcesGive =
    trade.maker_id === entityId
      ? [
          {
            resourceId: Number(trade.maker_gives_resource_type),
            amount: Number(trade.maker_gives_min_resource_amount),
          },
        ]
      : [
          {
            resourceId: Number(trade.taker_pays_resource_type),
            amount: Number(trade.taker_pays_min_resource_amount),
          },
        ];

  return { resourcesGet, resourcesGive };
};

export const computeTrades = (entityIds: Entity[], currentBlockTimestamp: number, components: ContractComponents) => {
  const trades = entityIds
    .map((id) => {
      let trade = getComponentValue(components.Trade, id);
      if (trade) {
        const { takerGets, makerGets } = getTradeResources(trade.trade_id, components);

        const makerStructure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(trade.maker_id)]));
        const makerName = getComponentValue(
          components.AddressName,
          getEntityIdFromKeys([BigInt(trade.maker_id)]),
        )?.name;

        if (trade.expires_at > currentBlockTimestamp) {
          return {
            makerName: shortString.decodeShortString(makerName?.toString() || ""),
            originName: getRealmNameById(makerStructure?.metadata.realm_id || 0),
            tradeId: trade.trade_id,
            makerId: trade.maker_id,
            takerId: trade.taker_id,
            makerGivesMinResourceAmount: Number(trade.maker_gives_min_resource_amount),
            takerPaysMinResourceAmount: Number(trade.taker_pays_min_resource_amount),
            makerGivesMaxResourceCount: Number(trade.maker_gives_max_count),
            makerOrder: makerStructure?.metadata.order,
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
    currentTick,
  }: {
    realmEntityId: ID;
    resourcesGive: Resource[];
    currentTick: number;
  },
  components: ClientComponents,
): boolean => {
  let canAccept = true;
  Object.values(resourcesGive).forEach((resource) => {
    const resourceManager = new ResourceManager(components, realmEntityId);
    if (resourceManager.balanceWithProduction(currentTick, resource.resourceId) < resource.amount) {
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
