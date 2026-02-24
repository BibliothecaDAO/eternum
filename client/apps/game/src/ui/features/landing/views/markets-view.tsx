import { useUIStore } from "@/hooks/store/use-ui-store";
import type { MarketClass } from "@/pm/class";
import { getPredictionMarketChain } from "@/pm/prediction-market-config";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { MarketsProviders } from "@/ui/features/market/markets-providers";
import { MarketImage } from "@/ui/features/market/landing-markets/market-image";
import { MarketStatusBadge } from "@/ui/features/market/landing-markets/market-status-badge";
import {
  marketChainLabels,
  useMultiChainMarketCounts,
  useMultiChainMarkets,
  type EnrichedMarket,
  type MarketChainFilter,
  type MarketStatusKey,
} from "@/ui/features/market/landing-markets/use-multi-chain-markets";
import { MaybeController } from "@/ui/features/market/landing-markets/maybe-controller";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MarketDetailsModal } from "./market-details-modal";

interface MarketsViewProps {
  className?: string;
}

type MarketDataChain = "slot" | "mainnet";

const STATUS_OPTIONS: Array<{
  key: MarketStatusKey;
  label: string;
}> = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "awaiting", label: "Awaiting" },
  { key: "resolved", label: "Resolved" },
];

const CHAIN_OPTIONS: Array<{ key: MarketChainFilter; label: string }> = [
  { key: "all", label: "All Chains" },
  { key: "slot", label: "Slot" },
  { key: "mainnet", label: "Mainnet" },
];

const getStatusFromParam = (value: string | null): MarketStatusKey => {
  if (value === "live" || value === "awaiting" || value === "resolved") {
    return value;
  }

  return "all";
};

const getChainFromParam = (value: string | null): MarketChainFilter => {
  if (value === "slot" || value === "mainnet") return value;
  return "all";
};

const PAGE_SIZE = 9;

const formatOddsPercentage = (raw: string | number) => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return "--";
  if (value < 1) return `${value.toFixed(2)}%`;
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
};

const formatTimeLeft = (targetSeconds: number | null) => {
  if (targetSeconds == null || targetSeconds <= 0) return "TBD";
  const nowSec = Math.floor(Date.now() / 1_000);
  const diff = targetSeconds - nowSec;
  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / 86_400);
  const hours = Math.floor((diff % 86_400) / 3_600);
  const minutes = Math.floor((diff % 3_600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const shortMarketId = (id: string) => {
  try {
    const hex = `0x${BigInt(id).toString(16)}`;
    if (hex.length <= 12) return hex;
    return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
  } catch {
    return id;
  }
};

const MarketTerminalCard = ({
  item,
  onOpen,
  canTrade,
}: {
  item: EnrichedMarket;
  onOpen: (market: MarketClass, chain: MarketDataChain) => void;
  canTrade: boolean;
}) => {
  const outcomes = useMemo(() => {
    const rows = item.market.getMarketOutcomes() ?? [];
    return rows
      .map((outcome) => ({ ...outcome, oddsNumeric: Number(outcome.odds) }))
      .toSorted((a, b) => {
        if (!Number.isFinite(a.oddsNumeric) && !Number.isFinite(b.oddsNumeric)) return a.index - b.index;
        if (!Number.isFinite(a.oddsNumeric)) return 1;
        if (!Number.isFinite(b.oddsNumeric)) return -1;
        if (a.oddsNumeric === b.oddsNumeric) return a.index - b.index;
        return b.oddsNumeric - a.oddsNumeric;
      });
  }, [item.market]);

  const visibleOutcomes = outcomes.slice(0, 3);
  const hiddenCount = Math.max(0, outcomes.length - visibleOutcomes.length);
  const chainLabel = marketChainLabels[item.chain];
  const endLabel = formatTimeLeft(item.market.end_at ?? null);

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-white/10 bg-[#080b10]/90 p-4 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.9)] transition-all duration-200 hover:border-orange/50 hover:bg-[#0b1017]">
      <div className="flex items-start gap-3">
        <MarketImage market={item.market} className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-white/10" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                item.chain === "mainnet"
                  ? "border-blue-400/40 bg-blue-500/10 text-blue-300"
                  : "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
              )}
            >
              {chainLabel}
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">{shortMarketId(item.market.market_id)}</span>
          </div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white">{item.market.title || "Untitled market"}</h3>
        </div>
        <MarketStatusBadge market={item.market} />
      </div>

      <div className="mt-4 flex-1 rounded-lg border border-white/10 bg-black/35 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Top Outcomes</p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">Percent</p>
        </div>
        <div className="space-y-2">
          {visibleOutcomes.map((outcome) => (
            <div key={`${item.key}-${outcome.index}`} className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs text-white/80">
                <MaybeController address={outcome.name} />
              </p>
              <p className="rounded border border-white/15 bg-white/5 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                {formatOddsPercentage(outcome.odds)}
              </p>
            </div>
          ))}
        </div>
        {hiddenCount > 0 ? (
          <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/35">+{hiddenCount} more outcomes</p>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-orange/40 bg-orange/10 p-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-orange/80">All-time Volume</p>
          <p className="mt-1 text-base font-semibold text-orange">{item.volumeDisplay}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Trading Ends</p>
          <p className="mt-1 text-sm font-semibold text-white/80">{endLabel}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpen(item.market, item.chain)}
        disabled={!canTrade}
        className={cn(
          "mt-3 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
          canTrade
            ? "border-orange/50 bg-orange/15 text-orange hover:border-orange hover:bg-orange/25"
            : "cursor-not-allowed border-white/10 bg-white/5 text-white/35",
        )}
      >
        {canTrade ? "Open Market" : `View Only (${chainLabel})`}
      </button>
    </article>
  );
};

/**
 * Unified prediction markets view with in-page status filters.
 */
const MarketsViewContent = ({ className }: MarketsViewProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toggleModal = useUIStore((state) => state.toggleModal);
  const runtimeChain = getPredictionMarketChain();

  const selectedStatus = getStatusFromParam(searchParams.get("status"));
  const selectedChain = getChainFromParam(searchParams.get("chain"));
  const filterKey = `${selectedStatus}|${selectedChain}`;

  const [pagesByFilter, setPagesByFilter] = useState<Record<string, number>>({});
  const currentPage = pagesByFilter[filterKey] ?? 1;
  const offset = (currentPage - 1) * PAGE_SIZE;

  const { counts, isLoading: isCountsLoading, isFetching: isCountsFetching } = useMultiChainMarketCounts(selectedChain);

  const { markets, totalCount, isLoading, isFetching, isError, sourceStatus, refresh } = useMultiChainMarkets({
    status: selectedStatus,
    chainFilter: selectedChain,
    limit: PAGE_SIZE,
    offset,
  });

  const handleCardClick = useCallback(
    (market: MarketClass, chain: MarketDataChain) => {
      if (chain !== runtimeChain) return;
      toggleModal(<MarketDetailsModal market={market} onClose={() => toggleModal(null)} />);
    },
    [runtimeChain, toggleModal],
  );

  const handleStatusChange = useCallback(
    (nextStatus: MarketStatusKey) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (nextStatus === "all") next.delete("status");
        else next.set("status", nextStatus);
        return next;
      });
      setPagesByFilter((previous) => ({ ...previous, [`${nextStatus}|${selectedChain}`]: 1 }));
    },
    [selectedChain, setSearchParams],
  );

  const handleChainChange = useCallback(
    (nextChain: MarketChainFilter) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (nextChain === "all") next.delete("chain");
        else next.set("chain", nextChain);
        return next;
      });
      setPagesByFilter((previous) => ({ ...previous, [`${selectedStatus}|${nextChain}`]: 1 }));
    },
    [selectedStatus, setSearchParams],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = totalCount > 0 ? offset + 1 : 0;
  const endIndex = Math.min(offset + markets.length, totalCount);

  const sourceWarnings = useMemo(() => {
    const selected = selectedChain === "all" ? (["slot", "mainnet"] as MarketDataChain[]) : [selectedChain];
    return selected
      .filter((chain) => !sourceStatus[chain]?.ok)
      .map((chain) => {
        const message = sourceStatus[chain]?.error ?? "Unavailable";
        return `${marketChainLabels[chain]} source unavailable (${message})`;
      });
  }, [selectedChain, sourceStatus]);

  const emptyState = useMemo(() => {
    if (selectedStatus === "live") {
      return {
        title: "No live markets available.",
        description: "Try Awaiting or Resolved markets.",
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
    <div className={cn("font-jetbrains flex h-full flex-col gap-5", className)}>
      <div className="space-y-3">
        <h2 className="font-cinzel text-xl font-semibold text-gold md:text-2xl">Prediction Markets</h2>
        <p className="text-sm text-white/65">Track live odds and all-time volume across Slot and Mainnet markets.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#070a10]/85 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_OPTIONS.map((option) => {
            const isActive = selectedStatus === option.key;
            const isCountLoading = isCountsLoading || isCountsFetching;
            const countLabel = isCountLoading ? "..." : counts[option.key].toString();

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => handleStatusChange(option.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
                  isActive
                    ? "border-orange/80 bg-orange/20 text-orange"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10",
                )}
              >
                {option.label} ({countLabel})
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CHAIN_OPTIONS.map((option) => {
            const isActive = selectedChain === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => handleChainChange(option.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
                  isActive
                    ? "border-orange/80 bg-orange/20 text-orange"
                    : "border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#070a10]/85 px-4 py-3 text-xs uppercase tracking-[0.12em] text-white/65">
        <span>{totalCount > 0 ? `Showing ${startIndex}-${endIndex} of ${totalCount}` : "No markets found"}</span>
        <div className="flex items-center gap-3">
          <span>Sort: Volume (All-time)</span>
          {isFetching ? <span className="text-white/40">Refreshing…</span> : null}
          <RefreshButton aria-label="Refresh markets" isLoading={isFetching || isLoading} onClick={refresh} />
        </div>
      </div>

      {sourceWarnings.length > 0 ? (
        <div className="rounded-xl border border-orange/40 bg-orange/10 px-3 py-2 text-xs text-orange/90">
          {sourceWarnings.join(" • ")}
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          Failed to load market sources. Try refreshing.
        </div>
      ) : null}

      <div className="max-h-[calc(100vh-260px)] flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-[#05070d]/90 p-4 md:p-5">
        {markets.length === 0 && !isFetching ? (
          <div className="rounded-2xl border border-white/10 bg-black/35 p-6 text-center">
            <p className="font-cinzel text-lg text-gold">{emptyState.title}</p>
            {emptyState.description ? <p className="mt-2 text-sm text-white/65">{emptyState.description}</p> : null}
            {emptyState.actionLabel && emptyState.onAction ? (
              <button
                type="button"
                onClick={emptyState.onAction}
                className="mt-4 rounded-lg border border-orange/70 bg-orange/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-orange transition-colors hover:bg-orange/25"
              >
                {emptyState.actionLabel}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {markets.map((item) => (
              <MarketTerminalCard
                key={item.key}
                item={item}
                onOpen={handleCardClick}
                canTrade={item.chain === runtimeChain}
              />
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 py-1">
          <button
            type="button"
            onClick={() =>
              setPagesByFilter((prev) => ({
                ...prev,
                [filterKey]: Math.max(1, (prev[filterKey] ?? 1) - 1),
              }))
            }
            disabled={currentPage === 1 || isFetching}
            className="min-h-[40px] min-w-[40px] rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white/80 transition-colors hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Previous page"
          >
            ←
          </button>
          <span className="text-xs uppercase tracking-[0.12em] text-white/60">
            Page {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setPagesByFilter((prev) => ({
                ...prev,
                [filterKey]: Math.min(totalPages, (prev[filterKey] ?? 1) + 1),
              }))
            }
            disabled={currentPage === totalPages || isFetching}
            className="min-h-[40px] min-w-[40px] rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white/80 transition-colors hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Next page"
          >
            →
          </button>
        </div>
      ) : null}
    </div>
  );
};

export const MarketsView = ({ className }: MarketsViewProps) => (
  <MarketsProviders>
    <MarketsViewContent className={className} />
  </MarketsProviders>
);
