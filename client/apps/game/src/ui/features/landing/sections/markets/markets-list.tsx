import { getContractByName } from "@dojoengine/core";
import { type MarketFiltersParams, useMarkets } from "@pm/sdk";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, HStack, ScrollArea, VStack } from "@pm/ui";
import { memo, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { useTokens } from "@/pm/hooks/dojo/use-tokens";
import type { TokenBalance } from "@dojoengine/torii-wasm";

import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { MarketImage } from "./market-image";
import { MarketOdds } from "./market-odds";
import { MarketQuickStats } from "./market-quick-stats";
import { MarketStatusBadge } from "./market-status-badge";
import { MarketTimeline } from "./market-timeline";

const PAGE_SIZE = 6;

/**
 * Memoized MarketCard component to prevent unnecessary rerenders
 */
const MarketCard = memo(function MarketCard({
  market,
  allBalances,
}: {
  market: MarketClass;
  allBalances: TokenBalance[];
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

  const titleContent = (
    <HStack className="gap-3">
      <MarketImage market={market} className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-sm" />
      <div>{market.title || "Untitled market"}</div>
    </HStack>
  );

  return (
    <Card className="h-full gap-3 rounded-sm border border-gold/20 bg-dark/20 p-3 transition hover:border-gold/60">
      <CardHeader className="flex items-start justify-between gap-3 px-0">
        <CardTitle className="flex-1">
          {isLinkable ? (
            <Link className="leading-normal hover:underline" to={href}>
              {titleContent}
            </Link>
          ) : (
            titleContent
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-0">
        <VStack className="w-full">
          <VStack className="w-auto items-end" />
          <MarketQuickStats market={market} balances={allBalances} />
        </VStack>

        <ScrollArea className="h-[120px] w-full pr-2">
          <MarketOdds market={market} selectable={false} />
        </ScrollArea>

        <CardDescription>
          <VStack className="gap-3">
            <HStack className="justify-center">
              <MarketStatusBadge market={market} />
            </HStack>
            <MarketTimeline market={market} />
          </VStack>
        </CardDescription>
      </CardContent>
    </Card>
  );
});

export function MarketsList({ marketFilters }: { marketFilters: MarketFiltersParams }) {
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

    return markets
      .filter(Boolean)
      .slice()
      .sort((a, b) => getCreatedAt(b.created_at) - getCreatedAt(a.created_at));
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
      <VStack className="4xl:grid-cols-4 relative grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sortedMarkets.map((market) => (
          <MarketCard key={market.market_id?.toString() ?? Math.random()} market={market} allBalances={allBalances} />
        ))}
      </VStack>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-4">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1 || isFetching}
            aria-label="Previous page"
            className="min-h-[44px] min-w-[44px] rounded bg-white/5 px-3 py-2 text-base text-gold transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
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
            className="min-h-[44px] min-w-[44px] rounded bg-white/5 px-3 py-2 text-base text-gold transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
