import { useEffect, useMemo, useState } from "react";

import type { MarketOutcome } from "@/pm/class";
import { useMarket } from "@pm/sdk";
import { ScrollArea } from "@pm/ui";
import { RefreshCw } from "lucide-react";

import Button from "@/ui/design-system/atoms/button";

import { useCurrentGameMarket } from "./hooks/use-current-game-market";
import { useMarketPlayerNavigation } from "./hooks/use-market-player-navigation";
import { MarketsProviders } from "./index";

import { MarketActivity } from "@/ui/features/landing/sections/markets/details/market-activity";
import { MarketHistory } from "@/ui/features/landing/sections/markets/details/market-history";
import { MarketPositions } from "@/ui/features/landing/sections/markets/details/market-positions";
import { MarketResolution } from "@/ui/features/landing/sections/markets/details/market-resolution";
import { MarketResolved } from "@/ui/features/landing/sections/markets/details/market-resolved";
import { MarketTrade } from "@/ui/features/landing/sections/markets/details/market-trade";
import { MarketOdds } from "@/ui/features/landing/sections/markets/market-odds";
import { MarketStatusBadge } from "@/ui/features/landing/sections/markets/market-status-badge";
import { MarketTvl } from "@/ui/features/landing/sections/markets/market-tvl";

type TabKey = "odds" | "activity" | "positions" | "resolution";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "odds", label: "Odds" },
  { key: "activity", label: "Activity" },
  { key: "positions", label: "Positions" },
];

const InGameMarketContent = () => {
  const { gameMarket, isLoading, refresh: refreshMarkets, currentPrizeAddress } = useCurrentGameMarket();
  const { navigateToPlayer } = useMarketPlayerNavigation();
  const [activeTab, setActiveTab] = useState<TabKey>("odds");
  const [selectedOutcome, setSelectedOutcome] = useState<MarketOutcome | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  // Get live market updates
  const marketId = gameMarket?.market_id ? BigInt(gameMarket.market_id) : 0n;
  const { market: liveMarket, refresh: refreshLiveMarket, isLoading: isLiveMarketLoading } = useMarket(marketId);

  // Use live market data if available, fallback to initial
  const market = liveMarket ?? gameMarket;

  // Default to highest odds outcome when market loads
  const defaultHighestOutcome = useMemo(() => {
    if (!market) return undefined;
    const outcomes = market.getMarketOutcomes();
    if (!outcomes || outcomes.length === 0) return undefined;

    return outcomes.reduce<MarketOutcome | undefined>((best, current) => {
      const currentOdds = Number((current as any)?.odds ?? 0);
      const bestOdds = best ? Number((best as any)?.odds ?? 0) : -Infinity;

      if (!Number.isFinite(currentOdds)) return best;
      if (!best || currentOdds > bestOdds) return current;

      return best;
    }, undefined);
  }, [market]);

  useEffect(() => {
    if (defaultHighestOutcome && !selectedOutcome) {
      setSelectedOutcome(defaultHighestOutcome);
    }
  }, [defaultHighestOutcome, selectedOutcome]);

  const handleRefresh = async () => {
    refreshMarkets();
    await refreshLiveMarket();
    setRefreshKey((prev) => prev + 1);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-center text-sm text-gold/70">
          <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Loading prediction market...
        </div>
      </div>
    );
  }

  // No market found
  if (!market) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
        <div className="text-center text-sm text-gold/70">
          <p className="mb-2">No prediction market found for this game.</p>
          <p className="text-xs text-gold/50">
            {currentPrizeAddress ? "The market may not be created yet." : "Could not determine game configuration."}
          </p>
          <Button size="xs" variant="outline" className="mt-4" onClick={() => refreshMarkets()}>
            <RefreshCw className="mr-2 h-3 w-3" />
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gold/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <MarketStatusBadge market={market} />
            <h3 className="truncate text-sm font-semibold text-white">
              {market.title?.replace(/<br\s*\/?>/gi, " ") || "Prediction Market"}
            </h3>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <MarketTvl market={market} />
            <Button
              size="xs"
              variant="outline"
              forceUppercase={false}
              onClick={() => void handleRefresh()}
              disabled={isLiveMarketLoading}
              title="Refresh market data"
            >
              <RefreshCw className={`h-3 w-3 ${isLiveMarketLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gold/20 px-3 py-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              activeTab === tab.key
                ? "bg-gold/20 text-white"
                : "bg-white/5 text-gold/70 hover:bg-white/10 hover:text-white"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content - Special layout for odds tab with sticky trade panel */}
      {activeTab === "odds" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Scrollable odds section - guaranteed minimum height */}
          <ScrollArea className="min-h-[180px] flex-1">
            <div className="space-y-3 p-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <MarketOdds
                  market={market}
                  selectable={!market.isEnded() && !market.isResolved()}
                  selectedOutcomeIndex={selectedOutcome?.index}
                  onSelect={(outcome) => setSelectedOutcome(outcome)}
                />
              </div>
            </div>
          </ScrollArea>

          {/* Sticky trade panel - constrained max height, compact mode */}
          <div className="max-h-[45vh] flex-shrink-0 overflow-y-auto border-t border-gold/20 bg-black/90 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
            <MarketTrade
              market={market}
              selectedOutcome={selectedOutcome}
              setSelectedOutcome={setSelectedOutcome}
              compact
            />
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-3">
            {activeTab === "activity" && (
              <div className="space-y-4">
                <MarketHistory market={market} refreshKey={refreshKey} />
                <MarketActivity market={market} />
              </div>
            )}

            {activeTab === "positions" && (
              <div className="space-y-4">
                <MarketPositions market={market} />
              </div>
            )}

            {activeTab === "resolution" && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                {market.isResolved() ? <MarketResolved market={market} /> : <MarketResolution market={market} />}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

/**
 * In-game prediction market panel.
 * Shows the market associated with the current game session.
 */
export const InGameMarket = () => {
  return (
    <MarketsProviders>
      <InGameMarketContent />
    </MarketsProviders>
  );
};
