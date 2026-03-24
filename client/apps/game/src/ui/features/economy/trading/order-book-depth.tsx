import { useMarketStore } from "@/hooks/store/use-market-store";
import { useAggregatedDepth } from "@/hooks/helpers/use-aggregated-depth";
import { ResourcesIds, ID, MarketInterface } from "@bibliothecadao/types";
import { memo } from "react";
import { AggregatedOrderRow } from "./aggregated-order-row";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";

interface OrderBookDepthProps {
  askOffers: MarketInterface[];
  bidOffers: MarketInterface[];
  resourceId: ResourcesIds;
  entityId: ID;
}

export const OrderBookDepth = memo(({ askOffers, bidOffers, resourceId, entityId }: OrderBookDepthProps) => {
  const showDepthView = useMarketStore((state) => state.showDepthView);
  const setShowDepthView = useMarketStore((state) => state.setShowDepthView);

  const aggregatedAsks = useAggregatedDepth(
    askOffers.filter((o) => o.takerGets[0]?.resourceId === resourceId),
    entityId,
  );

  const aggregatedBids = useAggregatedDepth(
    bidOffers.filter((o) => o.makerGets[0]?.resourceId === resourceId),
    entityId,
  );

  const totalOrders =
    aggregatedAsks.reduce((s, l) => s + l.orderCount, 0) +
    aggregatedBids.reduce((s, l) => s + l.orderCount, 0);

  return (
    <div className="border border-gold/10 rounded-lg overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setShowDepthView(!showDepthView)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gold/70 hover:text-gold hover:bg-gold/5 transition-colors"
      >
        <span>
          Order Book Depth
          {totalOrders > 0 && <span className="ml-2 text-gold/40">({totalOrders} orders)</span>}
        </span>
        {showDepthView ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* Depth content */}
      {showDepthView && (
        <div className="px-2 pb-2">
          {/* Column headers */}
          <div className="flex items-center gap-2 px-2 py-1 text-[10px] uppercase text-gold/40">
            <div className="w-2" />
            <div className="w-20">Price</div>
            <div className="w-24">Volume</div>
            <div className="w-12 text-right">Orders</div>
          </div>

          {/* Asks (sellers) - show in reverse so lowest price is at bottom near spread */}
          {aggregatedAsks.length > 0 ? (
            <div className="flex flex-col">
              {[...aggregatedAsks].reverse().map((level) => (
                <AggregatedOrderRow
                  key={`ask-${level.price}`}
                  level={level}
                  isBid={false}
                  resourceId={resourceId}
                />
              ))}
            </div>
          ) : (
            <div className="text-xs text-gold/30 text-center py-2">No sell orders</div>
          )}

          {/* Spread divider */}
          <div className="flex items-center gap-2 px-2 py-1 my-0.5">
            <div className="flex-1 h-px bg-gold/10" />
            <span className="text-[10px] text-gold/30 uppercase">spread</span>
            <div className="flex-1 h-px bg-gold/10" />
          </div>

          {/* Bids (buyers) */}
          {aggregatedBids.length > 0 ? (
            <div className="flex flex-col">
              {aggregatedBids.map((level) => (
                <AggregatedOrderRow
                  key={`bid-${level.price}`}
                  level={level}
                  isBid={true}
                  resourceId={resourceId}
                />
              ))}
            </div>
          ) : (
            <div className="text-xs text-gold/30 text-center py-2">No buy orders</div>
          )}
        </div>
      )}
    </div>
  );
});

OrderBookDepth.displayName = "OrderBookDepth";
