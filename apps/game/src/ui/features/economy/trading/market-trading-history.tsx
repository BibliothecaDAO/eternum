import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { HudButton, HudEmpty, HudLoading, HudSelect } from "@/ui/design-system/kit/hud-elements";
import { TradeHistoryEvent, TradeHistoryRowHeader, type TradeEvent } from "./trade-history-event";
import { useGame } from "@/hooks/context/game-context";
import { ResourcesIds, resourceName } from "@bibliothecadao/types";
import { memo, useEffect, useMemo, useState } from "react";
import { storyPayloadId } from "@/utils/native-id";

const TRADES_PER_PAGE = 25;

export const MarketTradingHistory = memo(() => {
  const {
    account: {
      account: { address },
    },
  } = useGame();

  const [showOnlyYourSwaps, setShowOnlyYourSwaps] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { data: swaps, isLoading } = useStoryEvents(500, "BankSwap");
  const tradeEvents = useMemo<TradeEvent[]>(
    () =>
      swaps.map((swap) => {
        const value = swap.storyPayload;
        const buy = value.buy === true;
        const lords = Number(BigInt(String(value.lords_amount)));
        const amount = Number(BigInt(String(value.resource_amount)));
        const resource = Number(value.resource_type);
        if (!swap.owner) throw new Error("Bank swap history has no actor");
        return {
          id: swap.event_id,
          type: "AMM Swap",
          event: {
            takerId: storyPayloadId(value.structure_id),
            makerId: storyPayloadId(value.bank_id),
            makerAddress: "0x0",
            takerAddress: swap.owner,
            isYours: BigInt(swap.owner) === BigInt(address),
            resourceGiven: { resourceId: buy ? ResourcesIds.Lords : resource, amount: buy ? lords : amount },
            resourceTaken: { resourceId: buy ? resource : ResourcesIds.Lords, amount: buy ? amount : lords },
            eventTime: new Date(swap.timestampMs),
          },
        };
      }),
    [swaps, address],
  );

  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(null);
  const resourceOptions = useResourceFilterOptions();

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
      .toSorted((a, b) => b.event.eventTime.getTime() - a.event.eventTime.getTime());
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

  const showPagination = totalPages > 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-3 max-lg:flex-wrap">
        <div className="flex items-center gap-3">
          <HudButton
            kind="secondary"
            size="sm"
            aria-pressed={showOnlyYourSwaps}
            onClick={() => setShowOnlyYourSwaps((prev) => !prev)}
          >
            Only mine
          </HudButton>
          <span className="text-hud-label text-hud-muted">{filteredAndSortedEvents.length} swaps</span>
        </div>
        <span className="w-48">
          <HudSelect
            label="Resource"
            value={selectedResourceId ?? ALL_RESOURCES}
            options={resourceOptions}
            onChange={(resourceId) => setSelectedResourceId(resourceId === ALL_RESOURCES ? null : resourceId)}
          />
        </span>
      </div>
      <p className="text-hud-muted">AMM swaps only. Order book fills return later.</p>
      <TradeHistoryRowHeader />
      <div role="table" aria-label="Swaps" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <HudLoading line="Loading swaps…" />
        ) : paginatedEvents.length === 0 ? (
          <HudEmpty icon="trade" line="No swaps yet" />
        ) : (
          paginatedEvents.map((trade) => <TradeHistoryEvent key={trade.id} trade={trade} />)
        )}
      </div>
      {showPagination && (
        <div className="flex items-center justify-center gap-3 border-t border-hud-divider pt-2">
          <HudButton
            kind="secondary"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Prev
          </HudButton>
          <span className="text-hud-label text-hud-muted">
            Page {currentPage} of {totalPages}
          </span>
          <HudButton
            kind="secondary"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </HudButton>
        </div>
      )}
    </div>
  );
});

/** No resource chosen: every swap shows. */
const ALL_RESOURCES = 0;

/** The swaps' resource filter: every resource but Lords, in the mode's tier order, after "All resources". */
const useResourceFilterOptions = () => {
  const mode = useGameModeConfig();
  return useMemo(
    () => [
      { value: ALL_RESOURCES, label: "All resources" },
      ...Object.values(mode.resources.getTiers())
        .flat()
        .filter((resourceId) => resourceId !== ResourcesIds.Lords)
        .map((resourceId) => ({ value: resourceId as number, label: resourceName(resourceId) })),
    ],
    [mode],
  );
};

MarketTradingHistory.displayName = "MarketTradingHistory";
