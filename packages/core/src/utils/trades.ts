import { type ID, type MarketInterface, type Resource, ResourcesIds } from "@bibliothecadao/types";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeFactStore } from "../client/native-fact-store";
import { configManager } from "../managers/config-manager";
import { getStructureName, type PlayerNameResolver } from "./entities";
type TradeResources = { takerGets: Resource[]; makerGets: Resource[] };

const getTradeResources = (tradeId: ID, store: NativeFactStore): TradeResources => {
  const order = store.require("TradeOrder", { game_id: configManager.getActiveGameId(), trade_id: tradeId });
  return {
    takerGets: [{ resourceId: order.offered_resource, amount: Number(order.offered_per_lot * order.remaining_lots) }],
    makerGets: [
      { resourceId: order.requested_resource, amount: Number(order.requested_per_lot * order.remaining_lots) },
    ],
  };
};

export const computeTrades = (
  orders: Iterable<NativeRows["TradeOrder"]>,
  currentBlockTimestamp: number,
  store: NativeFactStore,
  isBlitz: boolean,
  playerName: PlayerNameResolver,
): MarketInterface[] =>
  [...orders]
    .filter((order) => order.remaining_lots > 0n && order.expires_at > currentBlockTimestamp)
    .map((order) => {
      const { takerGets, makerGets } = getTradeResources(order.trade_id, store);
      const maker = store.require("Structure", { game_id: order.game_id, entity_id: order.maker_id });
      return {
        makerName: maker.owner === 0n ? "" : (playerName(maker.owner) ?? ""),
        originName: getStructureName(maker, isBlitz).name,
        tradeId: order.trade_id,
        makerId: order.maker_id,
        takerId: order.taker_id,
        makerGivesMinResourceAmount: Number(order.offered_per_lot),
        takerPaysMinResourceAmount: Number(order.requested_per_lot),
        makerGivesMaxResourceCount: Number(order.remaining_lots),
        makerOrder: maker.metadata.order,
        expiresAt: order.expires_at,
        takerGets,
        makerGets,
        ratio: calculateRatio(makerGets, takerGets),
        perLords:
          takerGets[0].resourceId === ResourcesIds.Lords
            ? calculateRatio(makerGets, takerGets)
            : calculateRatio(takerGets, makerGets),
      };
    });

const calculateRatio = (resourcesGive: Resource[], resourcesGet: Resource[]) =>
  resourcesGet.reduce((sum, row) => sum + row.amount, 0) / resourcesGive.reduce((sum, row) => sum + row.amount, 0);
