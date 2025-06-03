import { useUIStore } from "@/hooks/store/use-ui-store";
import { sqlApi } from "@/services/api";
import { EventType, TradeHistoryEvent, TradeHistoryRowHeader } from "@/ui/components/trading/trade-history-event";
import { Checkbox } from "@/ui/elements/checkbox";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { SelectResource } from "@/ui/elements/select-resource";
import { useDojo } from "@bibliothecadao/react";
import { ID, Resource } from "@bibliothecadao/types";
import { memo, useEffect, useMemo, useState } from "react";

const TRADES_PER_PAGE = 25;

export type TradeEvent = {
  type: EventType;
  event: {
    takerId: ID;
    takerAddress: string;
    makerId: ID;
    makerAddress: string;
    isYours: boolean;
    resourceGiven: Resource;
    resourceTaken: Resource;
    eventTime: Date;
  };
};

export const MarketTradingHistory = () => {
  return <MarketTradingHistoryContent />;
};

export const MarketTradingHistoryContent = memo(() => {
  const {
    account: {
      account: { address },
    },
  } = useDojo();

  const [tradeEvents, setTradeEvents] = useState<TradeEvent[]>([]);
  const [showOnlyYourSwaps, setShowOnlyYourSwaps] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const playerStructures = useUIStore((state) => state.playerStructures);

  useEffect(() => {
    setIsLoading(true);
    sqlApi.fetchSwapEvents(playerStructures.map((structure) => structure.entityId)).then((events) => {
      setTradeEvents(events);
      setIsLoading(false);
    });
  }, [address]);

  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(null);

  // First filter and sort all events
  const filteredAndSortedEvents = useMemo(() => {
    return tradeEvents
      .filter((trade) => {
        // Filter by user's swaps if needed
        const userFilter = showOnlyYourSwaps ? trade.event.isYours : true;
        // Filter by resource if selected
        const resourceFilter = selectedResourceId
          ? trade.event.resourceGiven?.resourceId === selectedResourceId ||
            trade.event.resourceTaken?.resourceId === selectedResourceId
          : true;
        return userFilter && resourceFilter;
      })
      .sort((a, b) => b.event.eventTime.getTime() - a.event.eventTime.getTime());
  }, [tradeEvents, showOnlyYourSwaps, selectedResourceId]);

  // Calculate pagination based on filtered events
  const totalPages = Math.ceil(filteredAndSortedEvents.length / TRADES_PER_PAGE);
  const startIndex = (currentPage - 1) * TRADES_PER_PAGE;
  const endIndex = startIndex + TRADES_PER_PAGE;

  // Get paginated events
  const paginatedEvents = useMemo(() => {
    return filteredAndSortedEvents.slice(startIndex, endIndex);
  }, [filteredAndSortedEvents, startIndex, endIndex]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [showOnlyYourSwaps, selectedResourceId]);

  return (
    <div className="flex flex-col px-8 mt-8">
      <div className="text-gold/70 text-sm mb-6">
        ⚠️ Currently showing AMM Swaps events only. Orderbook events coming back soon.
      </div>
      <div className="flex flex-row items-center justify-between mb-6">
        <div onClick={() => setShowOnlyYourSwaps((prev) => !prev)} className="flex items-center space-x-2">
          <Checkbox enabled={showOnlyYourSwaps} />
          <div className="text-sm text-gray-300 hover:text-white transition-colors duration-200">
            Show only your swaps
          </div>
        </div>
        <div className="text-sm text-gray-300">Total Swaps: {filteredAndSortedEvents.length}</div>
        <div className="w-1/3">
          <SelectResource onSelect={(resourceId) => setSelectedResourceId(resourceId)} className="w-full" />
        </div>
      </div>
      <TradeHistoryRowHeader />
      {isLoading ? (
        <div className="flex justify-center items-center">
          <LoadingAnimation />
        </div>
      ) : (
        paginatedEvents.map((trade, index) => {
          return <TradeHistoryEvent key={index} trade={trade} />;
        })
      )}

      {/* Pagination Controls */}
      <div className="flex justify-center items-center space-x-4 mt-4 mb-4">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 rounded bg-gray text-gold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
        >
          ←
        </button>
        <span className="text-gold text-sm">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 rounded bg-gray text-gold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
        >
          →
        </button>
      </div>
    </div>
  );
});
