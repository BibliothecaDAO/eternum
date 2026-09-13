import type { MarketInterface } from "@bibliothecadao/types";

/** Per-resource best prices in Lords: what the cheapest ask charges and what the highest bid pays. */
interface BestPrices {
  highestBid: Map<number, number>;
  lowestAsk: Map<number, number>;
}

/** Index the best price per resource once per offer set, so headers and rows read from one source. */
export const resolveBestPrices = (bidOffers: MarketInterface[], askOffers: MarketInterface[]): BestPrices => {
  const highestBid = new Map<number, number>();
  const lowestAsk = new Map<number, number>();
  for (const offer of bidOffers) {
    const resourceId = offer.makerGets[0]?.resourceId;
    if (resourceId !== undefined && offer.perLords > (highestBid.get(resourceId) ?? -Infinity)) {
      highestBid.set(resourceId, offer.perLords);
    }
  }
  for (const offer of askOffers) {
    const resourceId = offer.takerGets[0]?.resourceId;
    if (resourceId !== undefined && offer.perLords < (lowestAsk.get(resourceId) ?? Infinity)) {
      lowestAsk.set(resourceId, offer.perLords);
    }
  }
  return { highestBid, lowestAsk };
};

/** The best price in one resource's book side: the cheapest ask, or the highest bid. Zero when the side is empty. */
export const resolveBestPrice = (offers: MarketInterface[], side: "ask" | "bid"): number => {
  if (offers.length === 0) return 0;
  const prices = offers.map((offer) => offer.perLords);
  return side === "bid" ? Math.max(...prices) : Math.min(...prices);
};
