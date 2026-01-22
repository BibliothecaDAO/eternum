import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, History, RefreshCw, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { MarketClass, MarketOutcome } from "@/pm/class";
import { useMarket } from "@pm/sdk";
import { ScrollArea } from "@pm/ui";

import Button from "@/ui/design-system/atoms/button";
import Panel from "@/ui/design-system/atoms/panel";

import { MarketActivity } from "@/ui/features/landing/sections/markets/details/market-activity";
import { MarketHistory } from "@/ui/features/landing/sections/markets/details/market-history";
import { MarketPositions } from "@/ui/features/landing/sections/markets/details/market-positions";
import { MarketResolution } from "@/ui/features/landing/sections/markets/details/market-resolution";
import { MarketResolved } from "@/ui/features/landing/sections/markets/details/market-resolved";
import { MarketTrade } from "@/ui/features/landing/sections/markets/details/market-trade";
import { MarketOdds } from "@/ui/features/landing/sections/markets/market-odds";
import { MarketStatusBadge } from "@/ui/features/landing/sections/markets/market-status-badge";
import { MarketTvl } from "@/ui/features/landing/sections/markets/market-tvl";

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

type TabKey = "odds" | "activity" | "positions" | "resolution";

const TABS: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: "odds", label: "Odds", icon: BarChart3 },
  { key: "activity", label: "Activity", icon: History },
  { key: "positions", label: "Holders", icon: Users },
];

interface MarketDetailsSectionProps {
  initialMarket: MarketClass;
  onRefreshMarkets: () => void;
}

/**
 * Market details UI shown when a market exists.
 * Displays market info, odds, activity, positions, and trade panel.
 */
export const MarketDetailsSection = ({ initialMarket, onRefreshMarkets }: MarketDetailsSectionProps) => {
  const [activeTab, setActiveTab] = useState<TabKey>("odds");
  const [selectedOutcome, setSelectedOutcome] = useState<MarketOutcome | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  // Get live market updates
  const marketId = initialMarket.market_id ? BigInt(initialMarket.market_id) : 0n;
  const { market: liveMarket, refresh: refreshLiveMarket, isLoading: isLiveMarketLoading } = useMarket(marketId);

  // Use live market data if available, fallback to initial
  const market = liveMarket ?? initialMarket;

  // Get current outcomes from market
  const outcomes = useMemo(() => market.getMarketOutcomes() ?? [], [market]);

  // Default to highest odds outcome when market loads
  const defaultHighestOutcome = useMemo(() => {
    if (outcomes.length === 0) return undefined;

    return outcomes.reduce<MarketOutcome | undefined>((best, current) => {
      const currentOdds = Number((current as any)?.odds ?? 0);
      const bestOdds = best ? Number((best as any)?.odds ?? 0) : -Infinity;

      if (!Number.isFinite(currentOdds)) return best;
      if (!best || currentOdds > bestOdds) return current;

      return best;
    }, undefined);
  }, [outcomes]);

  // Set initial selection OR sync selected outcome with updated market data
  useEffect(() => {
    if (!selectedOutcome && defaultHighestOutcome) {
      // Initial selection
      setSelectedOutcome(defaultHighestOutcome);
    } else if (selectedOutcome) {
      // Sync with updated market data - find outcome with same index
      const updatedOutcome = outcomes.find((o) => o.index === selectedOutcome.index);
      if (updatedOutcome && updatedOutcome !== selectedOutcome) {
        setSelectedOutcome(updatedOutcome);
      }
    }
  }, [outcomes, defaultHighestOutcome, selectedOutcome]);

  const handleRefresh = useCallback(async () => {
    onRefreshMarkets();
    await refreshLiveMarket();
    setRefreshKey((prev) => prev + 1);
  }, [onRefreshMarkets, refreshLiveMarket]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gold/20 bg-brown/50 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <MarketStatusBadge market={market} />
            <h3 className="truncate font-cinzel text-sm font-semibold text-gold">
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
              <RefreshCw className={cx("h-3 w-3", isLiveMarketLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gold/10 bg-brown/30 px-3 py-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className={cx(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                isActive ? "bg-gold/20 text-gold" : "bg-brown/50 text-gold/50 hover:bg-gold/10 hover:text-gold/70",
              )}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon className="h-3 w-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content - Special layout for odds tab with sticky trade panel */}
      {activeTab === "odds" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Scrollable odds section */}
          <ScrollArea className="min-h-[180px] flex-1">
            <div className="space-y-3 p-3">
              <Panel tone="neutral" padding="sm" radius="md" border="subtle">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gold/50">
                  Select an outcome to trade
                </p>
                <MarketOdds
                  market={market}
                  selectable={!market.isEnded() && !market.isResolved()}
                  selectedOutcomeIndex={selectedOutcome?.index}
                  onSelect={(outcome) => setSelectedOutcome(outcome)}
                />
              </Panel>
            </div>
          </ScrollArea>

          {/* Sticky trade panel */}
          <div className="max-h-[45vh] flex-shrink-0 overflow-y-auto border-t border-gold/20 bg-brown/80 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
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
                <MarketActivity market={market} refreshKey={refreshKey} />
              </div>
            )}

            {activeTab === "positions" && (
              <div className="space-y-4">
                <MarketPositions market={market} />
              </div>
            )}

            {activeTab === "resolution" && (
              <Panel tone="neutral" padding="md" radius="lg" border="subtle">
                {market.isResolved() ? <MarketResolved market={market} /> : <MarketResolution market={market} />}
              </Panel>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
