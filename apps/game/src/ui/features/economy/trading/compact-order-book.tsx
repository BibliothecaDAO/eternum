import type { CompactLane } from "@/hooks/helpers/use-compact-hud";
import { HudButton, HudTabs } from "@/ui/design-system/kit/hud-elements";
import type { ID, MarketInterface, ResourcesIds } from "@bibliothecadao/types";

import { useState } from "react";
import { resolveBestPrice } from "./best-prices";
import {
  EmptyBookSide,
  OrderBookSide,
  OrderCreation,
  OrderRow,
  OrderRowHeader,
  useSelectedResourceOffers,
  VirtualizedOrderList,
} from "./market-order-panel";

/** What the player wants to do, which decides both the offers shown and the order the form places. */
type TradeSide = "buy" | "sell";
/** How much of the open book side is on screen: the best few, or the whole list. */
type OffersReveal = "top" | "all";

const TOP_OFFER_COUNT = 3;

const SIDES: { key: TradeSide; label: string }[] = [
  { key: "buy", label: "Buy" },
  { key: "sell", label: "Sell" },
];

/** The phone order book: pick buy or sell, place the order first, and open the offers underneath as needed. */
export const CompactOrderBook = ({
  resourceId,
  entityId,
  resourceAskOffers,
  resourceBidOffers,
  lane,
}: {
  resourceId: ResourcesIds;
  entityId: ID;
  resourceAskOffers: MarketInterface[];
  resourceBidOffers: MarketInterface[];
  lane: CompactLane;
}) => {
  const [side, setSide] = useState<TradeSide>("buy");
  const { asks, bids } = useSelectedResourceOffers(resourceId, resourceAskOffers, resourceBidOffers);
  // Buying fills asks and places a bid; selling fills bids and places an ask.
  const offersAreBids = side === "sell";
  const offers = offersAreBids ? bids : asks;
  const bestPrice = resolveBestPrice(offers, offersAreBids ? "bid" : "ask");

  return (
    <div className="flex flex-col gap-2">
      <HudTabs tabs={SIDES} value={side} onChange={setSide} />
      <OrderCreation
        layout="compact"
        resourceId={resourceId}
        entityId={entityId}
        isBuy={!offersAreBids}
        suggestedPrice={bestPrice}
      />
      <OffersDisclosure resourceId={resourceId} entityId={entityId} offers={offers} isBuy={offersAreBids} lane={lane} />
    </div>
  );
};

/** The side's best-price line as a disclosure: tap for the best few offers, "See all" for the whole side. */
const OffersDisclosure = ({
  resourceId,
  entityId,
  offers,
  isBuy,
  lane,
}: {
  resourceId: ResourcesIds;
  entityId: ID;
  offers: MarketInterface[];
  isBuy: boolean;
  lane: CompactLane;
}) => {
  const [reveal, setReveal] = useState<OffersReveal>("top");
  const [updateBalance, setUpdateBalance] = useState(false);
  const hasMore = offers.length > TOP_OFFER_COUNT;

  return (
    // Landscape has the least height, so its side starts folded to the headline.
    <OrderBookSide
      resourceId={resourceId}
      isBuy={isBuy}
      offers={offers}
      collapsible
      defaultCollapsed={lane === "landscape"}
    >
      <OrderRowHeader resourceId={resourceId} isBuy={isBuy} />
      {offers.length === 0 ? (
        <EmptyBookSide isBuy={isBuy} />
      ) : reveal === "all" ? (
        <div className="flex max-h-hud-list flex-col">
          <VirtualizedOrderList
            offers={offers}
            entityId={entityId}
            isBuy={isBuy}
            updateBalance={updateBalance}
            setUpdateBalance={setUpdateBalance}
          />
        </div>
      ) : (
        offers
          .slice(0, TOP_OFFER_COUNT)
          .map((offer) => (
            <OrderRow
              key={offer.tradeId}
              offer={offer}
              entityId={entityId}
              isBuy={isBuy}
              updateBalance={updateBalance}
              setUpdateBalance={setUpdateBalance}
            />
          ))
      )}
      {hasMore && (
        <HudButton kind="quiet" size="sm" onClick={() => setReveal(reveal === "all" ? "top" : "all")}>
          {reveal === "all" ? "Show less" : `See all ${offers.length}`}
        </HudButton>
      )}
    </OrderBookSide>
  );
};
