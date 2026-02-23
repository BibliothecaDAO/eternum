import { useUIStore } from "@/hooks/store/use-ui-store";
import type { MarketClass } from "@/pm/class";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { MarketsProviders } from "@/ui/features/market/markets-providers";
import { MarketsList } from "@/ui/features/market/landing-markets/markets-list";
import { MarketStatusFilter, MarketTypeFilter, useMarkets, type MarketFiltersParams } from "@pm/sdk";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { MarketDetailsModal } from "./market-details-modal";

interface MarketsViewProps {
  className?: string;
}

type MarketStatusKey = "all" | "live" | "awaiting" | "resolved";

const STATUS_OPTIONS: Array<{
  key: MarketStatusKey;
  label: string;
  status: MarketStatusFilter;
}> = [
  { key: "all", label: "All", status: MarketStatusFilter.All },
  { key: "live", label: "Live", status: MarketStatusFilter.Open },
  { key: "awaiting", label: "Awaiting Resolution", status: MarketStatusFilter.Resolvable },
  { key: "resolved", label: "Resolved", status: MarketStatusFilter.Resolved },
];

const getStatusFromParam = (value: string | null): MarketStatusKey => {
  if (value === "live" || value === "awaiting" || value === "resolved") {
    return value;
  }

  return "all";
};

/**
 * Unified prediction markets view with in-page status filters.
 */
const MarketsViewContent = ({ className }: MarketsViewProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toggleModal = useUIStore((state) => state.toggleModal);

  const selectedStatus = getStatusFromParam(searchParams.get("status"));

  const allMarketsFilters: MarketFiltersParams = useMemo(
    () => ({
      status: MarketStatusFilter.All,
      type: MarketTypeFilter.All,
      oracle: "All",
    }),
    [],
  );

  const liveMarketsFilters: MarketFiltersParams = useMemo(
    () => ({
      status: MarketStatusFilter.Open,
      type: MarketTypeFilter.All,
      oracle: "All",
    }),
    [],
  );

  const awaitingMarketsFilters: MarketFiltersParams = useMemo(
    () => ({
      status: MarketStatusFilter.Resolvable,
      type: MarketTypeFilter.All,
      oracle: "All",
    }),
    [],
  );

  const resolvedMarketsFilters: MarketFiltersParams = useMemo(
    () => ({
      status: MarketStatusFilter.Resolved,
      type: MarketTypeFilter.All,
      oracle: "All",
    }),
    [],
  );

  const activeMarketsFilters = useMemo((): MarketFiltersParams => {
    if (selectedStatus === "live") return liveMarketsFilters;
    if (selectedStatus === "awaiting") return awaitingMarketsFilters;
    if (selectedStatus === "resolved") return resolvedMarketsFilters;
    return allMarketsFilters;
  }, [selectedStatus, allMarketsFilters, liveMarketsFilters, awaitingMarketsFilters, resolvedMarketsFilters]);

  const { totalCount: allCount, isLoading: isAllCountLoading, isFetching: isAllCountFetching } = useMarkets({
    marketFilters: allMarketsFilters,
    limit: 1,
    offset: 0,
  });

  const { totalCount: liveCount, isLoading: isLiveCountLoading, isFetching: isLiveCountFetching } = useMarkets({
    marketFilters: liveMarketsFilters,
    limit: 1,
    offset: 0,
  });

  const { totalCount: awaitingCount, isLoading: isAwaitingCountLoading, isFetching: isAwaitingCountFetching } =
    useMarkets({
      marketFilters: awaitingMarketsFilters,
      limit: 1,
      offset: 0,
    });

  const { totalCount: resolvedCount, isLoading: isResolvedCountLoading, isFetching: isResolvedCountFetching } =
    useMarkets({
      marketFilters: resolvedMarketsFilters,
      limit: 1,
      offset: 0,
    });

  const handleCardClick = useCallback(
    (market: MarketClass) => {
      toggleModal(<MarketDetailsModal market={market} onClose={() => toggleModal(null)} />);
    },
    [toggleModal],
  );

  const handleStatusChange = useCallback((nextStatus: MarketStatusKey) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("tab");

      if (nextStatus === "all") {
        next.delete("status");
      } else {
        next.set("status", nextStatus);
      }

      return next;
    });
  }, [setSearchParams]);

  const countByStatus: Record<MarketStatusKey, number> = {
    all: allCount,
    live: liveCount,
    awaiting: awaitingCount,
    resolved: resolvedCount,
  };

  const isCountLoadingByStatus: Record<MarketStatusKey, boolean> = {
    all: isAllCountLoading || isAllCountFetching,
    live: isLiveCountLoading || isLiveCountFetching,
    awaiting: isAwaitingCountLoading || isAwaitingCountFetching,
    resolved: isResolvedCountLoading || isResolvedCountFetching,
  };

  const emptyState = useMemo(() => {
    if (selectedStatus === "live") {
      return {
        title: "No live markets available.",
        description: "Try Awaiting Resolution or Resolved markets.",
        actionLabel: "View All Markets",
        onAction: () => handleStatusChange("all"),
      };
    }

    if (selectedStatus === "awaiting") {
      return {
        title: "No markets are awaiting resolution.",
        description: "Try Live or Resolved markets.",
        actionLabel: "View Live Markets",
        onAction: () => handleStatusChange("live"),
      };
    }

    if (selectedStatus === "resolved") {
      return {
        title: "No resolved markets available.",
        description: "Try Live or Awaiting Resolution markets.",
        actionLabel: "View Live Markets",
        onAction: () => handleStatusChange("live"),
      };
    }

    return {
      title: "No markets available.",
      description: "Check back soon for new prediction markets.",
    };
  }, [selectedStatus, handleStatusChange]);

  return (
    <div className={cn("flex h-full flex-col gap-6", className)}>
      <div className="space-y-3">
        <h2 className="font-cinzel text-xl font-semibold text-gold md:text-2xl">Prediction Markets</h2>
        <p className="text-sm text-gold/70">Track live odds and review markets awaiting resolution or already resolved.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((option) => {
          const isActive = selectedStatus === option.key;
          const isCountLoading = isCountLoadingByStatus[option.key];
          const countLabel = isCountLoading ? "..." : countByStatus[option.key].toString();

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => handleStatusChange(option.key)}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm transition-colors",
                isActive
                  ? "border-gold/60 bg-gold/20 font-semibold text-gold"
                  : "border-gold/20 bg-gold/5 text-gold/80 hover:border-gold/40 hover:bg-gold/10",
              )}
            >
              {option.label} ({countLabel})
            </button>
          );
        })}
      </div>

      <div className="max-h-[calc(100vh-180px)] flex-1 overflow-y-auto rounded-2xl border border-gold/20 bg-black/60 p-4 backdrop-blur-xl md:p-6">
        <MarketsList marketFilters={activeMarketsFilters} onCardClick={handleCardClick} emptyState={emptyState} />
      </div>
    </div>
  );
};

export const MarketsView = ({ className }: MarketsViewProps) => (
  <MarketsProviders>
    <MarketsViewContent className={className} />
  </MarketsProviders>
);
