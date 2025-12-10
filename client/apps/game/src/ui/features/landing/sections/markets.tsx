import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import { MarketClass, type MarketOutcome } from "@/pm/class";
import { ControllersProvider } from "@/pm/hooks/controllers/useControllers";
import {
  DojoSdkProviderInitialized,
  MarketStatusFilter,
  MarketTypeFilter,
  useMarkets,
  type MarketFiltersParams,
} from "@pm/sdk";
import { ScrollArea } from "@pm/ui";
import { ArrowLeft } from "lucide-react";

import { UserProvider } from "@/pm/hooks/dojo/user";
import { MarketActivity } from "./markets/details/MarketActivity";
import { MarketCreatedBy } from "./markets/details/MarketCreatedBy";
import { MarketFees } from "./markets/details/MarketFees";
import { MarketHistory } from "./markets/details/MarketHistory";
import { MarketPositions } from "./markets/details/MarketPositions";
import { MarketResolution } from "./markets/details/MarketResolution";
import { MarketResolved } from "./markets/details/MarketResolved";
import { MarketTrade } from "./markets/details/MarketTrade";
import { MarketVaultFees } from "./markets/details/MarketVaultFees";
import { UserMessages } from "./markets/details/UserMessages";
import { MarketFilters } from "./markets/MarketFilters";
import { MarketOdds } from "./markets/MarketOdds";
import { MarketsList } from "./markets/MarketsList";
import { MarketStatusBadge } from "./markets/MarketStatusBadge";
import { MarketTimeline } from "./markets/MarketTimeline";
import { MarketTvl } from "./markets/MarketTvl";

const PREDICTION_MARKET_CONFIG = {
  toriiUrl: "https://localhost:8080",
  // toriiUrl: "https://api.cartridge.gg/x/blitz-slot-pm-1/torii",
  worldAddress: "0x0172e470e28b6ad5f4c397019a3aca0c9b451a5e06f5255fbb8c4eefcd6f2b58",
};

const MARKET_FILTERS_ALL: MarketFiltersParams = {
  status: MarketStatusFilter.All,
  type: MarketTypeFilter.All,
  oracle: "All",
};

const parseMarketId = (raw?: string | null) => {
  if (!raw) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
};

const toHexId = (value?: string | number | bigint) => {
  try {
    return `0x${BigInt(value ?? 0).toString(16)}`;
  } catch {
    return null;
  }
};

const MarketsProviders = ({ children }: { children: ReactNode }) => (
  <DojoSdkProviderInitialized
    toriiUrl={PREDICTION_MARKET_CONFIG.toriiUrl}
    worldAddress={PREDICTION_MARKET_CONFIG.worldAddress}
  >
    <UserProvider>
      <ControllersProvider>{children}</ControllersProvider>
    </UserProvider>
  </DojoSdkProviderInitialized>
);

const MarketsSection = ({ children, description }: { children: ReactNode; description?: string }) => (
  <section
    aria-label="Prediction markets"
    className="relative h-[70vh] w-full max-w-[1400px] space-y-6 overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-black/40 to-black/90 p-8 text-white shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl md:max-h-[80vh]"
  >
    <div className="mx-auto flex w-full max-w-[1250px] flex-col gap-4 rounded-2xl border border-gold/30 bg-black/40 p-6 shadow-lg shadow-black/30">
      {description ? <p className="text-sm text-gold/70">{description}</p> : null}

      {children}
    </div>
  </section>
);

const MarketDetailsContent = ({ market }: { market: MarketClass }) => {
  const marketHex = toHexId(market.market_id) ?? market.market_id;
  const [activeTab, setActiveTab] = useState<
    "terms" | "comments" | "activity" | "positions" | "vault-fees" | "resolution"
  >("terms");
  const [selectedOutcome, setSelectedOutcome] = useState<MarketOutcome | undefined>(undefined);

  const outcomes = market.getMarketOutcomes();

  return (
    <>
      <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-[5fr_2fr]">
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-3xl font-semibold text-white">{market.title || "Untitled market"}</h3>
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
    </>
  );
};

export const LandingMarkets = () => {
  const [marketFilters, setMarketFilters] = useState<MarketFiltersParams>({ ...MARKET_FILTERS_ALL });

  return (
    <MarketsProviders>
      <MarketsSection description="Browse live prediction markets, inspect their odds, and hop into the ones that interest you.">
        <MarketFilters marketFilters={marketFilters} setMarketFilters={setMarketFilters} />
        <MarketsList marketFilters={marketFilters} />
      </MarketsSection>
    </MarketsProviders>
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

      {market ? (
        <>
          <MarketDetailsContent market={market} />
        </>
      ) : null}
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
