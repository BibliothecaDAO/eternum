import { type ID, type MarketInterface, ResourcesIds } from "@bibliothecadao/types";
import type { NativeFactStore } from "../native-fact-store";
import { configManager } from "../../managers/config-manager";
import { computeTrades } from "../../utils/trades";

export interface MarketView {
  /** Open trades made by one of the player's realms or villages. */
  userTrades: MarketInterface[];
  /** Open trades whose taker pays Lords. */
  bidOffers: MarketInterface[];
  /** Open trades whose maker pays Lords. */
  askOffers: MarketInterface[];
}

export const readOpenTrades = (store: NativeFactStore, currentBlockTimestamp: number): MarketInterface[] =>
  computeTrades(
    store.inGame("TradeOrder", configManager.getActiveGameId()),
    currentBlockTimestamp,
    store,
    configManager.getBlitzConfig().blitz_mode_on,
  );

export const readMarket = (trades: MarketInterface[], playerStructureIds: ID[]): MarketView => ({
  userTrades: trades.filter((trade) => playerStructureIds.includes(trade.makerId)),
  bidOffers: trades.filter((trade) => trade.takerGets[0]?.resourceId === ResourcesIds.Lords),
  askOffers: trades.filter((trade) => trade.makerGets[0]?.resourceId === ResourcesIds.Lords),
});
