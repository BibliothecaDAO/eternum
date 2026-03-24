import { MarketInterface, ResourcesIds } from "@bibliothecadao/types";

export type Venue = "orderbook" | "amm";

export interface BestPriceResult {
  obPrice: number | null;
  ammPrice: number | null;
  bestVenue: Venue | null;
  obAvailable: number;
  ammSlippage: number;
}

/**
 * Compare prices across Order Book and AMM for a given resource and direction.
 *
 * For "buy" direction: user wants to BUY a resource (pay Lords, receive resource)
 *   - OB: look at ask offers (people selling the resource), lowest perLords is best
 *   - AMM: use getMarketPrice()
 *   - Best = lowest price (user pays less Lords per resource)
 *
 * For "sell" direction: user wants to SELL a resource (pay resource, receive Lords)
 *   - OB: look at bid offers (people buying the resource), highest perLords is best
 *   - AMM: use getMarketPrice()
 *   - Best = highest price (user receives more Lords per resource)
 */
export const comparePrices = ({
  direction,
  askOffers,
  bidOffers,
  resourceId,
  ammSpotPrice,
  ammSlippage,
}: {
  direction: "buy" | "sell";
  askOffers: MarketInterface[];
  bidOffers: MarketInterface[];
  resourceId: ResourcesIds;
  ammSpotPrice: number | null;
  ammSlippage: number;
}): BestPriceResult => {
  let obPrice: number | null = null;
  let obAvailable = 0;

  if (direction === "buy") {
    // User buys resource: look at asks (sellers). Filter for this resource.
    const relevantAsks = askOffers
      .filter((o) => o.takerGets[0]?.resourceId === resourceId)
      .sort((a, b) => a.perLords - b.perLords); // lowest price first = best for buyer

    if (relevantAsks.length > 0) {
      obPrice = relevantAsks[0].perLords;
      // Sum volume at best price level
      obAvailable = relevantAsks
        .filter((o) => o.perLords === obPrice)
        .reduce((sum, o) => sum + (o.takerGets[0]?.amount || 0), 0);
    }
  } else {
    // User sells resource: look at bids (buyers). Filter for this resource.
    const relevantBids = bidOffers
      .filter((o) => o.makerGets[0]?.resourceId === resourceId)
      .sort((a, b) => b.perLords - a.perLords); // highest price first = best for seller

    if (relevantBids.length > 0) {
      obPrice = relevantBids[0].perLords;
      obAvailable = relevantBids
        .filter((o) => o.perLords === obPrice)
        .reduce((sum, o) => sum + (o.makerGets[0]?.amount || 0), 0);
    }
  }

  const ammPrice = ammSpotPrice && ammSpotPrice > 0 ? ammSpotPrice : null;

  // Determine best venue
  let bestVenue: Venue | null = null;
  if (obPrice !== null && ammPrice !== null) {
    if (direction === "buy") {
      // Lower price is better for buyer
      bestVenue = obPrice <= ammPrice ? "orderbook" : "amm";
    } else {
      // Higher price is better for seller
      bestVenue = obPrice >= ammPrice ? "orderbook" : "amm";
    }
    // Tie-break: prefer AMM (instant execution, no waiting)
    if (obPrice === ammPrice) {
      bestVenue = "amm";
    }
  } else if (obPrice !== null) {
    bestVenue = "orderbook";
  } else if (ammPrice !== null) {
    bestVenue = "amm";
  }

  return {
    obPrice,
    ammPrice,
    bestVenue,
    obAvailable,
    ammSlippage,
  };
};
