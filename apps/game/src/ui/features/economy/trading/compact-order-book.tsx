import type { CompactLane } from "@/hooks/helpers/use-compact-hud";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { ID, MarketInterface, ResourcesIds } from "@bibliothecadao/types";
import { ChevronDown } from "@/ui/design-system/atoms/game-icons";
import { useState } from "react";
import { resolveBestPrice } from "./best-prices";
import {
  EmptyBookSide,
  OrderBookSideHeader,
  OrderCreation,
  OrderRow,
  OrderRowHeader,
  useSelectedResourceOffers,
  VirtualizedOrderList,
} from "./market-order-panel";

/** What the player wants to do, which decides both the offers shown and the order the form places. */
type TradeSide = "buy" | "sell";
/** How much of the book side is on screen: nothing, the best few, or the whole list. */
type OffersReveal = "collapsed" | "top" | "all";

const TOP_OFFER_COUNT = 3;

const SIDES: { key: TradeSide; label: string; selectedClass: string }[] = [
  { key: "buy", label: "Buy", selectedClass: "border-green/50 bg-green/15 text-green" },
  { key: "sell", label: "Sell", selectedClass: "border-red/50 bg-red/15 text-red" },
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
    <div className="order-book-selector flex flex-col gap-2 p-3">
      <SideToggle side={side} onSelect={setSide} />
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

const SideToggle = ({ side, onSelect }: { side: TradeSide; onSelect: (side: TradeSide) => void }) => (
  <div role="tablist" aria-label="Trade side" className="grid grid-cols-2 gap-1">
    {SIDES.map((option) => {
      const isSelected = option.key === side;
      return (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={isSelected}
          onClick={() => onSelect(option.key)}
          className={cn(
            "min-h-11 rounded-md border font-sans text-sm font-semibold uppercase tracking-[0.16em] transition-colors",
            isSelected ? option.selectedClass : "border-gold/20 text-gold/65",
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

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
  // Landscape has the least height, so it starts with the header only.
  const [reveal, setReveal] = useState<OffersReveal>(lane === "landscape" ? "collapsed" : "top");
  const [updateBalance, setUpdateBalance] = useState(false);
  const isOpen = reveal !== "collapsed";
  const hasMore = offers.length > TOP_OFFER_COUNT;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setReveal(isOpen ? "collapsed" : "top")}
        className="w-full text-left"
      >
        <OrderBookSideHeader
          resourceId={resourceId}
          isBuy={isBuy}
          offers={offers}
          className="min-h-9"
          trailing={<ChevronDown className={cn("h-4 w-4 text-gold/70 transition-transform", isOpen && "rotate-180")} />}
        />
      </button>
      {isOpen && (
        <div
          className={cn(
            "flex flex-col rounded-md border border-gold/15 bg-black/25",
            isBuy ? "order-buy-selector" : "order-sell-selector",
          )}
        >
          <OrderRowHeader resourceId={resourceId} isBuy={isBuy} />
          {offers.length === 0 ? (
            <EmptyBookSide isBuy={isBuy} />
          ) : reveal === "all" ? (
            <div className="flex max-h-[50dvh] flex-col landscape:max-h-[40dvh]">
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
            <button
              type="button"
              onClick={() => setReveal(reveal === "all" ? "top" : "all")}
              className="min-h-11 w-full border-t border-gold/15 font-sans text-xs text-gold transition-colors hover:bg-gold/10"
            >
              {reveal === "all" ? "Show less" : `See all ${offers.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
