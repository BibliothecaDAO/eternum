import { getContractByName } from "@dojoengine/core";
import { type MarketFiltersParams, useMarkets } from "@pm/sdk";
import { memo, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { useTokens } from "@/pm/hooks/dojo/use-tokens";
import type { TokenBalance } from "@dojoengine/torii-wasm";

import Panel from "@/ui/design-system/atoms/panel";
import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { MarketImage } from "./market-image";
import { MarketQuickStats } from "./market-quick-stats";
import { MarketStatusBadge } from "./market-status-badge";
import { MarketTimeline } from "./market-timeline";
import { OddsBarChart } from "./odds-bar-chart";

const PAGE_SIZE = 6;

/**
 * Memoized MarketCard component to prevent unnecessary rerenders
 * Uses Panel design system component with clear visual hierarchy
 */
const MarketCard = memo(function MarketCard({
  market,
  allBalances,
  animationDelay = 0,
  onCardClick,
}: {
  market: MarketClass;
  allBalances: TokenBalance[];
  animationDelay?: number;
  onCardClick?: (market: MarketClass) => void;
}) {
  const href = useMemo(() => {
    try {
      if (market?.market_id == null) return "#";
      return `/markets/0x${BigInt(market.market_id).toString(16)}`;
    } catch {
      return "#";
    }
  }, [market.market_id]);

  const isLinkable = href !== "#";
  const useModal = Boolean(onCardClick);

  const handleClick = (e: React.MouseEvent) => {
    if (onCardClick) {
      e.preventDefault();
      onCardClick(market);
    }
  };

  return (
    <Panel
      tone="wood"
      padding="none"
      radius="lg"
      border="subtle"
      isInteractive
      className="group flex h-full flex-col overflow-hidden animate-fade-in-up"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Header: Image + Title + Status */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <MarketImage market={market} className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md" />
        <div className="min-w-0 flex-1">
          {isLinkable ? (
            useModal ? (
              <button type="button" onClick={handleClick} className="block text-left">
                <h3 className="font-cinzel text-base font-semibold leading-tight text-gold transition-colors group-hover:text-gold/80">
                  {market.title || "Untitled market"}
                </h3>
              </button>
            ) : (
              <Link to={href} className="block">
                <h3 className="font-cinzel text-base font-semibold leading-tight text-gold transition-colors group-hover:text-gold/80">
                  {market.title || "Untitled market"}
                </h3>
              </Link>
            )
          ) : (
            <h3 className="font-cinzel text-base font-semibold leading-tight text-gold">
              {market.title || "Untitled market"}
            </h3>
          )}
          <div className="mt-2">
            <MarketStatusBadge market={market} />
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="border-t border-gold/10 px-4 py-2">
        <MarketQuickStats market={market} balances={allBalances} />
      </div>

      {/* Odds Bar Chart */}
      <div className="flex-1 border-t border-gold/10 px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gold/50">Current Odds</p>
        <OddsBarChart market={market} maxVisible={4} animated />
      </div>

      {/* Timeline Footer */}
      <div className="border-t border-gold/10 px-4 py-3">
        <MarketTimeline market={market} />
      </div>

      {/* Hover Overlay - Quick Action */}
      {isLinkable &&
        (useModal ? (
          <button
            type="button"
            onClick={handleClick}
            className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-gold/20 to-transparent px-4 py-3 text-center text-sm font-semibold text-gold opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
          >
            View Market
          </button>
        ) : (
          <Link
            to={href}
            className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-gold/20 to-transparent px-4 py-3 text-center text-sm font-semibold text-gold opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
          >
            View Market
          </Link>
        ))}
    </Panel>
  );
});

export function MarketsList({
  marketFilters,
  onCardClick,
}: {
  marketFilters: MarketFiltersParams;
  onCardClick?: (market: MarketClass) => void;
}) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const { markets, isFetching, isLoading, totalCount, refresh } = useMarkets({
    marketFilters,
    limit: PAGE_SIZE,
    offset,
  });

  const {
    config: { manifest },
  } = useDojoSdk();

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [marketFilters.status, marketFilters.type, marketFilters.oracle]);

  // Single subscription for all vault position balances - hoisted from MarketQuickStats
  const vaultPositionsAddress = useMemo(() => getContractByName(manifest, "pm", "VaultPositions")?.address, [manifest]);
  const { balances: allBalances } = useTokens(
    {
      accountAddresses: undefined,
      contractAddresses: vaultPositionsAddress ? [vaultPositionsAddress] : [],
    },
    false,
  );

  // Sort markets by created_at (newest first) - SQL already does this, but keeping for safety
  const sortedMarkets = useMemo(() => {
    const getCreatedAt = (value: unknown) => {
      const num = Number(value ?? 0);
      return Number.isFinite(num) ? num : 0;
    };

    return markets.filter(Boolean).toSorted((a, b) => getCreatedAt(b.created_at) - getCreatedAt(a.created_at));
  }, [markets]);

  // Calculate pagination info
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = totalCount > 0 ? offset + 1 : 0;
  const endIndex = Math.min(offset + sortedMarkets.length, totalCount);

  if (sortedMarkets.length === 0 && !isFetching) {
    return <p className="text-sm text-gold/70">No markets are available yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Results summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gold/70">
        <span className="leading-tight">
          {totalCount > 0 ? `Showing ${startIndex}-${endIndex} of ${totalCount} markets` : "No markets found"}
        </span>
        <div className="flex items-center gap-3">
          {isFetching ? <span className="text-gold/50">Loading...</span> : null}
          <RefreshButton
            aria-label="Refresh markets"
            isLoading={isFetching || isLoading}
            onClick={refresh}
            disabled={isFetching || isLoading}
          />
        </div>
      </div>

      {/* Markets grid */}
      <div className="4xl:grid-cols-4 relative grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sortedMarkets.map((market, index) => (
          <MarketCard
            key={market.market_id?.toString() ?? Math.random()}
            market={market}
            allBalances={allBalances}
            animationDelay={index * 50}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-4">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1 || isFetching}
            aria-label="Previous page"
            className="min-h-[44px] min-w-[44px] rounded-2xl border border-gold/20 bg-gold/5 px-3 py-2 text-base text-gold transition-colors hover:bg-gold/10 hover:border-gold/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          >
            ←
          </button>
          <span className="text-sm text-gold">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || isFetching}
            aria-label="Next page"
            className="min-h-[44px] min-w-[44px] rounded-2xl border border-gold/20 bg-gold/5 px-3 py-2 text-base text-gold transition-colors hover:bg-gold/10 hover:border-gold/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
