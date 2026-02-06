import type { MarketClass, MarketOutcome } from "@/pm/class";
import Button from "@/ui/design-system/atoms/button";
import { MarketsProviders } from "@/ui/features/market/markets-providers";
import { MarketOdds } from "@/ui/features/market/landing-markets/market-odds";
import { MarketStatusBadge } from "@/ui/features/market/landing-markets/market-status-badge";
import { MarketTimeline } from "@/ui/features/market/landing-markets/market-timeline";
import { MarketTvl } from "@/ui/features/market/landing-markets/market-tvl";
import { MarketActivity } from "@/ui/features/market/landing-markets/details/market-activity";
import { MarketCreatedBy } from "@/ui/features/market/landing-markets/details/market-created-by";
import { MarketFees } from "@/ui/features/market/landing-markets/details/market-fees";
import { MarketHistory } from "@/ui/features/market/landing-markets/details/market-history";
import { MarketPositions } from "@/ui/features/market/landing-markets/details/market-positions";
import { MarketResolution } from "@/ui/features/market/landing-markets/details/market-resolution";
import { MarketResolved } from "@/ui/features/market/landing-markets/details/market-resolved";
import { MarketTrade } from "@/ui/features/market/landing-markets/details/market-trade";
import { MarketVaultFees } from "@/ui/features/market/landing-markets/details/market-vault-fees";
import { UserMessages } from "@/ui/features/market/landing-markets/details/user-messages";
import { useMarketWatch } from "@/ui/features/market/landing-markets/use-market-watch";
import { useMarket } from "@pm/sdk";
import { ScrollArea } from "@pm/ui";
import { Play, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface MarketDetailsModalProps {
  market: MarketClass;
  onClose: () => void;
}

type MarketDetailsTabKey = "terms" | "comments" | "activity" | "positions" | "vault-fees" | "resolution";

const MARKET_DETAIL_TABS: Array<{ key: MarketDetailsTabKey; label: string }> = [
  { key: "terms", label: "Terms" },
  { key: "comments", label: "Comments" },
  { key: "activity", label: "Activity" },
  { key: "positions", label: "My Positions" },
  { key: "vault-fees", label: "Vault Fees" },
  { key: "resolution", label: "Resolution" },
];

const MarketDetailsTabs = ({ market, refreshKey = 0 }: { market: MarketClass; refreshKey?: number }) => {
  const [activeTab, setActiveTab] = useState<MarketDetailsTabKey>("terms");

  return (
    <div className="rounded-lg border border-gold/20 bg-black/40 p-4">
      <div className="flex flex-wrap gap-2 pb-3">
        {MARKET_DETAIL_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              activeTab === tab.key
                ? "bg-gold/20 text-gold"
                : "bg-black/40 text-gold/70 hover:bg-gold/10 hover:text-gold"
            }`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-md border border-gold/10 bg-black/60 p-4">
        {activeTab === "terms" && market.terms ? (
          <div className="text-sm leading-relaxed text-gold/80" dangerouslySetInnerHTML={{ __html: market.terms }} />
        ) : null}
        {activeTab === "terms" && !market.terms ? <p className="text-sm text-gold/70">No terms provided.</p> : null}

        {activeTab === "comments" ? <UserMessages marketId={market.market_id} /> : null}
        {activeTab === "activity" ? <MarketActivity market={market} refreshKey={refreshKey} /> : null}
        {activeTab === "positions" ? <MarketPositions market={market} /> : null}
        {activeTab === "vault-fees" ? <MarketVaultFees market={market} /> : null}
        {activeTab === "resolution" ? (
          market.isResolved() ? (
            <MarketResolved market={market} />
          ) : (
            <MarketResolution market={market} />
          )
        ) : null}
      </div>
    </div>
  );
};

/**
 * Inner modal content that uses hooks requiring MarketsProviders context
 */
const MarketDetailsModalContent = ({ initialMarket, onClose }: { initialMarket: MarketClass; onClose: () => void }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const { watchMarket, watchingMarketId, getWatchState } = useMarketWatch();

  // Fetch fresh market data
  const marketId = useMemo(() => {
    try {
      return initialMarket.market_id ? BigInt(initialMarket.market_id) : 0n;
    } catch {
      return 0n;
    }
  }, [initialMarket.market_id]);
  const { market: fetchedMarket, refresh: refreshMarket, isLoading } = useMarket(marketId);
  const market = fetchedMarket ?? initialMarket;

  const watchState = getWatchState(market);
  const isWatching = watchingMarketId === String(market.market_id);
  const watchDisabled = watchState.status === "offline";
  const watchLoading = watchState.status === "checking" || isWatching;

  const [selectedOutcome, setSelectedOutcome] = useState<MarketOutcome | undefined>(undefined);

  // Get current outcomes from market
  const outcomes = useMemo(() => market.getMarketOutcomes() ?? [], [market]);

  const defaultHighestOutcome = useMemo(() => {
    if (outcomes.length === 0) return undefined;

    return outcomes.reduce<MarketOutcome | undefined>((best, current) => {
      const currentOdds = Number(current.odds);
      const bestOdds = best ? Number(best.odds) : -Infinity;

      if (!Number.isFinite(currentOdds)) return best;
      if (!best || currentOdds > bestOdds) return current;

      return best;
    }, undefined);
  }, [outcomes]);

  // Set initial selection OR sync selected outcome with updated market data
  useEffect(() => {
    if (!selectedOutcome && defaultHighestOutcome) {
      setSelectedOutcome(defaultHighestOutcome);
    } else if (selectedOutcome) {
      const updatedOutcome = outcomes.find((o) => o.index === selectedOutcome.index);
      if (updatedOutcome && updatedOutcome !== selectedOutcome) {
        setSelectedOutcome(updatedOutcome);
      }
    }
  }, [outcomes, defaultHighestOutcome, selectedOutcome]);

  const handleRefresh = useCallback(async () => {
    await refreshMarket();
    setRefreshKey((prev) => prev + 1);
  }, [refreshMarket]);

  return (
    <div className="relative mx-auto flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gold/30 bg-black/95 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-gold/20 p-4 md:p-6">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-xl font-semibold text-gold md:text-2xl">
            {market.title || "Untitled market"}
          </h2>
          <MarketCreatedBy creator={market.creator} market={market} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            forceUppercase={false}
            className="gap-2"
            onClick={() => void handleRefresh()}
            disabled={isLoading}
            title="Refresh market data"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="xs"
            variant="outline"
            forceUppercase={false}
            className="gap-2"
            onClick={() => void watchMarket(market)}
            isLoading={watchLoading}
            disabled={watchDisabled}
            title={watchDisabled ? "Game is offline" : "Watch game"}
          >
            <Play className="h-4 w-4" />
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gold/60 transition-colors hover:bg-gold/10 hover:text-gold"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="space-y-6">
          {/* Status & Timeline */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gold/20 bg-black/40 p-4">
            <MarketStatusBadge market={market} />
            <MarketTvl market={market} />
          </div>

          <div className="space-y-3">
            <MarketTimeline market={market} />
            <MarketHistory market={market} refreshKey={refreshKey} />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
            {/* Odds Section */}
            <div className="rounded-lg border border-gold/20 bg-black/40 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gold/70">Current Odds</h3>
              <ScrollArea className="max-h-[260px] pr-2">
                <MarketOdds
                  market={market}
                  selectable
                  selectedOutcomeIndex={selectedOutcome?.index}
                  onSelect={(outcome) => setSelectedOutcome(outcome)}
                />
              </ScrollArea>
            </div>

            {/* Trade & Fees Section */}
            <div className="flex flex-col gap-4">
              <MarketTrade market={market} selectedOutcome={selectedOutcome} />
              <MarketFees market={market} />
            </div>
          </div>

          {/* Tabs Section */}
          <MarketDetailsTabs market={market} refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
};

/**
 * Modal wrapper that provides the necessary context providers
 */
export const MarketDetailsModal = ({ market, onClose }: MarketDetailsModalProps) => {
  return (
    <MarketsProviders>
      <MarketDetailsModalContent initialMarket={market} onClose={onClose} />
    </MarketsProviders>
  );
};
