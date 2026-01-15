import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";

import { ControllersProvider } from "@/pm/hooks/controllers/use-controllers";
import { UserProvider } from "@/pm/hooks/dojo/user";
import { getPredictionMarketConfig } from "@/pm/prediction-market-config";
import { useConfig } from "@/pm/providers";
import {
  DojoSdkProviderInitialized,
  MarketStatusFilter,
  MarketTypeFilter,
  useMarkets,
  type MarketFiltersParams,
} from "@pm/sdk";
import { useAccount } from "@starknet-react/core";
import { MarketFilters } from "./markets/market-filters";
import { MARKET_TABS, TabButton, type MarketTab } from "./markets/market-tabs";
import { MarketsLeaderboardView } from "./markets/markets-leaderboard-view";
import { MarketsList } from "./markets/markets-list";
import { PlayerMarketsView } from "./markets/player-markets-view";
import { buildPlayerSummary, useMarketEventsSnapshot } from "./markets/use-market-stats";

// QueryClient instance for PM - created outside component to avoid recreation
const pmQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
});

export const MARKET_FILTERS_ALL: MarketFiltersParams = {
  status: MarketStatusFilter.All,
  type: MarketTypeFilter.All,
  oracle: "All",
};

export const MarketsProviders = ({ children }: { children: ReactNode }) => {
  const config = getPredictionMarketConfig();
  return (
    <QueryClientProvider client={pmQueryClient}>
      <DojoSdkProviderInitialized toriiUrl={config.toriiUrl} worldAddress={config.worldAddress}>
        <UserProvider>
          <ControllersProvider>{children}</ControllersProvider>
        </UserProvider>
      </DojoSdkProviderInitialized>
    </QueryClientProvider>
  );
};

export const MarketsSection = ({ children, description }: { children: ReactNode; description?: string }) => (
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

export const LandingMarkets = () => {
  const [marketFilters, setMarketFilters] = useState<MarketFiltersParams>({ ...MARKET_FILTERS_ALL });
  const [activeTab, setActiveTab] = useState<MarketTab>("markets");

  const { getRegisteredToken } = useConfig();
  const { address } = useAccount();

  const { markets: allMarkets } = useMarkets({ marketFilters: MARKET_FILTERS_ALL });
  const { buys, payouts, isLoading: isStatsLoading, refresh } = useMarketEventsSnapshot();

  const playerSummary = useMemo(
    () =>
      buildPlayerSummary({
        address,
        markets: allMarkets,
        buys,
        payouts,
        getRegisteredToken,
      }),
    [address, allMarkets, buys, getRegisteredToken, payouts],
  );

  return (
    <MarketsSection description="Browse live prediction markets, inspect their odds, and hop into the ones that interest you.">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {MARKET_TABS.map((tab) => (
            <TabButton
              key={tab.id}
              isActive={tab.id === activeTab}
              label={tab.label}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>
      </div>

      {activeTab === "markets" ? (
        <>
          <MarketFilters marketFilters={marketFilters} setMarketFilters={setMarketFilters} />
          <MarketsList marketFilters={marketFilters} />
        </>
      ) : null}

      {activeTab === "leaderboard" ? <MarketsLeaderboardView /> : null}

      {activeTab === "player" ? (
        <PlayerMarketsView
          isLoading={isStatsLoading}
          onRefresh={refresh}
          hasWallet={Boolean(address)}
          summary={playerSummary}
        />
      ) : null}
    </MarketsSection>
  );
};
