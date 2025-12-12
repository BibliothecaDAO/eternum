import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { MarketClass, type MarketOutcome } from "@/pm/class";
import { useMarkets } from "@pm/sdk";
import { ScrollArea } from "@pm/ui";
import { ArrowLeft, Play } from "lucide-react";

import Button from "@/ui/design-system/atoms/button";

import { MARKET_FILTERS_ALL, MarketsProviders, MarketsSection } from "./markets";
import { MarketActivity } from "./markets/details/MarketActivity";
import { MarketCreatedBy } from "./markets/details/MarketCreatedBy";
import { MarketFees } from "./markets/details/MarketFees";
import { MarketHistory } from "./markets/details/MarketHistory";
import { MarketPositions } from "./markets/details/MarketPositions";
import { MarketResolution } from "./markets/details/MarketResolution";
import { MarketResolved } from "./markets/details/MarketResolved";
import { MarketTrade } from "./markets/details/MarketTrade";
import { UserMessages } from "./markets/details/UserMessages";
import { MarketOdds } from "./markets/MarketOdds";
import { MarketStatusBadge } from "./markets/MarketStatusBadge";
import { MarketTimeline } from "./markets/MarketTimeline";
import { MarketTvl } from "./markets/MarketTvl";
import { useMarketWatch } from "./markets/use-market-watch";

const parseMarketId = (raw?: string | null) => {
  if (!raw) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
};

const MarketDetailsContent = ({ market }: { market: MarketClass }) => {
  const { watchMarket, watchingMarketId, getWatchState } = useMarketWatch();
  const [activeTab, setActiveTab] = useState<
    "terms" | "comments" | "activity" | "positions" | "vault-fees" | "resolution"
  >("terms");
  const [selectedOutcome, setSelectedOutcome] = useState<MarketOutcome | undefined>(undefined);
  const watchState = getWatchState(market);
  const isWatching = watchingMarketId === String(market.market_id);
  const watchDisabled = watchState.status === "offline";
  const watchLoading = watchState.status === "checking" || isWatching;

  return (
    <>
      <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-[5fr_2fr]">
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-3xl font-semibold text-white">{market.title || "Untitled market"}</h3>
              <Button
                size="xs"
                variant="outline"
                forceUppercase={false}
                className="gap-2"
                onClick={() => void watchMarket(market)}
                isLoading={watchLoading}
                disabled={watchDisabled}
                title={watchDisabled ? "Game is offline" : undefined}
              >
                <Play className="h-4 w-4" />
                <span>Watch</span>
              </Button>
            </div>
            <MarketCreatedBy creator={market.creator} />
          </div>

          <div className="space-y-3">
            <MarketTimeline market={market} />
            <MarketHistory market={market} />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-gold/80">
            <MarketStatusBadge market={market} />
            <MarketTvl market={market} />
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <ScrollArea className="max-h-[260px] pr-2">
              <MarketOdds
                market={market}
                selectable
                selectedOutcomeIndex={selectedOutcome?.index}
                onSelect={(outcome) => setSelectedOutcome(outcome)}
              />
            </ScrollArea>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <MarketTrade market={market} selectedOutcome={selectedOutcome} />
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <MarketFees market={market} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap gap-2 pb-3">
          {[
            { key: "terms", label: "Terms" },
            { key: "comments", label: "Comments" },
            { key: "activity", label: "Activity" },
            { key: "positions", label: "My Positions" },
            { key: "vault-fees", label: "Vault Fees" },
            { key: "resolution", label: "Resolution" },
          ].map((tab) => (
            <button
              key={tab.key}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                activeTab === tab.key
                  ? "bg-gold/20 text-white"
                  : "bg-white/5 text-gold/70 hover:bg-white/10 hover:text-white"
              }`}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="rounded-md border border-white/10 bg-black/40 p-4">
          {activeTab === "terms" && market.terms ? (
            <div className="text-sm leading-relaxed text-white/80" dangerouslySetInnerHTML={{ __html: market.terms }} />
          ) : null}
          {activeTab === "terms" && !market.terms ? <p className="text-sm text-gold/70">No terms provided.</p> : null}

          {activeTab === "comments" ? <UserMessages marketId={market.market_id} /> : null}
          {activeTab === "activity" ? <MarketActivity market={market} /> : null}
          {activeTab === "positions" ? <MarketPositions market={market} /> : null}
          {/* {activeTab === "vault-fees" ? <MarketVaultFees market={market} /> : null} */}
          {activeTab === "resolution" ? (
            market.isResolved() ? (
              <MarketResolved market={market} />
            ) : (
              <MarketResolution market={market} />
            )
          ) : null}
        </div>
      </div>
    </>
  );
};

const LandingMarketDetailsContent = ({ marketId }: { marketId?: string }) => {
  const targetId = useMemo(() => parseMarketId(marketId), [marketId]);
  const { markets } = useMarkets({ marketFilters: MARKET_FILTERS_ALL });

  const market = useMemo(() => {
    if (targetId == null) return undefined;

    return markets.find((candidate) => {
      try {
        return BigInt(candidate.market_id) === targetId;
      } catch {
        return false;
      }
    });
  }, [markets, targetId]);

  const isLoading = !market && markets.length === 0;

  return (
    <MarketsSection description="Inspect a market's odds, schedule, and oracle details.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="flex items-center gap-2 text-sm font-semibold text-gold hover:text-white" to="/markets">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to markets</span>
        </Link>
      </div>

      {isLoading ? <p className="text-sm text-gold/70">Loading market data...</p> : null}

      {!isLoading && !market ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-gold/80">
          {marketId ? (
            <span>
              No market found for <span className="text-white">{marketId}</span>.
            </span>
          ) : (
            <span>Choose a market from the list to view its details.</span>
          )}
        </div>
      ) : null}

      {market ? <MarketDetailsContent market={market} /> : null}
    </MarketsSection>
  );
};

export const LandingMarketDetails = () => {
  const { marketId } = useParams<{ marketId?: string }>();

  return (
    <MarketsProviders>
      <LandingMarketDetailsContent marketId={marketId} />
    </MarketsProviders>
  );
};

export default LandingMarketDetails;
