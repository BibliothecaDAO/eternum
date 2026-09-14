import { type ClientComponents, type MarketInterface, ResourcesIds } from "@bibliothecadao/types";
import { type Entity, HasValue, type QueryFragment } from "@dojoengine/recs";

import { gameEntityKey } from "../../managers/game-entity-keys";
import { computeTrades } from "../../utils/trades";

export interface MarketView {
  /** Open trades made by one of the player's realms or villages. */
  userTrades: MarketInterface[];
  /** Open trades whose taker pays Lords. */
  bidOffers: MarketInterface[];
  /** Open trades whose maker pays Lords. */
  askOffers: MarketInterface[];
}

/** Trades nobody has taken yet. */
export const openTradesQuery = (components: ClientComponents): QueryFragment[] => [
  HasValue(components.Trade, { taker_id: 0 }),
];

/** Open trades that have not expired at the given chain time. */
export const readOpenTrades = (
  components: ClientComponents,
  entities: Entity[],
  currentBlockTimestamp: number,
): MarketInterface[] => computeTrades(entities, currentBlockTimestamp, components, false);

/** Splits open trades into the player's own and the Lords bid/ask books; makers are the player's structure entities. */
export const readMarket = (trades: MarketInterface[], playerStructureEntities: Entity[]): MarketView => ({
  userTrades: trades.filter((trade) => playerStructureEntities.includes(gameEntityKey([BigInt(trade.makerId)]))),
  bidOffers: trades.filter(isLordsBid),
  askOffers: trades.filter(isLordsAsk),
});

const isLordsBid = (offer: MarketInterface): boolean =>
  offer.takerGets.length === 1 && offer.takerGets[0]?.resourceId === ResourcesIds.Lords;

const isLordsAsk = (offer: MarketInterface): boolean =>
  offer.takerGets.length === 1 && offer.makerGets[0]?.resourceId === ResourcesIds.Lords;
