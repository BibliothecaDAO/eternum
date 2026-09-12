import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { getActiveWorld } from "@/runtime/world";
import { fetchHeraldGameHistory } from "@bibliothecadao/eternum/game-client";
import { getDefaultWorld, getWorldById } from "@/runtime/world/world-directory";
import { HUD_BODY_MUTED, HUD_CUE } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_PILL_BUTTON } from "@/ui/design-system/atoms/overlay-surface";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { SelectResource } from "@/ui/design-system/molecules/select-resource";
import { TradeHistoryEvent, TradeHistoryRowHeader, type TradeEvent } from "./trade-history-event";
import { useDojo } from "@bibliothecadao/react";
import { configManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";
import { memo, useEffect, useMemo, useState } from "react";

const TRADES_PER_PAGE = 25;

export const MarketTradingHistory = memo(() => {
  const {
    account: {
      account: { address },
    },
    setup: { components },
  } = useDojo();

  const [tradeEvents, setTradeEvents] = useState<TradeEvent[]>([]);
  const [showOnlyYourSwaps, setShowOnlyYourSwaps] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const playerStructures = useUIStore((state) => state.playerStructures);
  // Owner lookup comes from the bridge's structures slice, one array per ingest slice instead of one per row.
  const structures = useWorldSlicesStore((state) => state.structures);
  const profile = getActiveWorld();
  const world = getWorldById(profile?.worldId ?? "blitz") ?? getDefaultWorld();
  const gameId = configManager.getActiveGameId();

  useEffect(() => {
    setIsLoading(true);
    const ownerByEntity = new Map(
      structures.map((structure) => [String(structure.entity_id), String(structure.owner)] as const),
    );
    const playerEntityIds = new Set(playerStructures.map((structure) => String(structure.entityId)));
    void fetchHeraldGameHistory(world, gameId, { limit: 500, model: "SwapEvent" })
      .then((page) =>
        page.items.map(({ value }): TradeEvent => {
          const entityId = Number(BigInt(String(value.entity_id)));
          const isBuy = value.buy === true || value.buy === "0x1" || value.buy === 1n;
          const lordsAmount = BigInt(String(value.lords_amount));
          const resourceAmount = BigInt(String(value.resource_amount));
          const resourceType = Number(BigInt(String(value.resource_type)));
          return {
            type: "AMM Swap",
            event: {
              takerId: entityId,
              makerId: 0,
              makerAddress: "0x0",
              takerAddress: ownerByEntity.get(String(value.entity_id)) ?? "0x0",
              isYours: playerEntityIds.has(String(value.entity_id)),
              resourceGiven: {
                resourceId: isBuy ? ResourcesIds.Lords : resourceType,
                amount: Number(isBuy ? lordsAmount : resourceAmount),
              },
              resourceTaken: {
                resourceId: isBuy ? resourceType : ResourcesIds.Lords,
                amount: Number(isBuy ? resourceAmount : lordsAmount),
              },
              eventTime: new Date(Number(BigInt(String(value.timestamp))) * 1_000),
            },
          };
        }),
      )
      .then(setTradeEvents)
      .catch(() => setTradeEvents([]))
      .finally(() => setIsLoading(false));
  }, [address, gameId, playerStructures, structures, world]);

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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-pressed={showOnlyYourSwaps}
            onClick={() => setShowOnlyYourSwaps((prev) => !prev)}
            className={cn(HUD_PILL_BUTTON, showOnlyYourSwaps ? "border-gold/60 bg-gold/15" : "text-gold/65")}
          >
            Only mine
          </button>
          <span className={HUD_CUE}>{filteredAndSortedEvents.length} swaps</span>
        </div>
        <SelectResource onSelect={(resourceId) => setSelectedResourceId(resourceId)} className="w-48" />
      </div>
      <p className={cn(HUD_BODY_MUTED, "px-3 pb-2")}>AMM swaps only. Order book fills return later.</p>
      <TradeHistoryRowHeader />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingAnimation />
          </div>
        ) : paginatedEvents.length === 0 ? (
          <p className={cn(HUD_BODY_MUTED, "px-3 py-6 text-center")}>No swaps yet</p>
        ) : (
          paginatedEvents.map((trade, index) => (
            <TradeHistoryEvent
              key={`${trade.event.eventTime.getTime()}-${trade.event.takerAddress}-${index}`}
              trade={trade}
            />
          ))
        )}
      </div>
      {showPagination && (
        <div className="flex items-center justify-center gap-3 border-t border-gold/15 px-3 py-2">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={HUD_PILL_BUTTON}
          >
            Prev
          </button>
          <span className={HUD_CUE}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className={HUD_PILL_BUTTON}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
});

MarketTradingHistory.displayName = "MarketTradingHistory";
