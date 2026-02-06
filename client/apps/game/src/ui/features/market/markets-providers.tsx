import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";

import { ControllersProvider } from "@/pm/hooks/controllers/use-controllers";
import { UserProvider } from "@/pm/hooks/dojo/user";
import { getPredictionMarketConfig } from "@/pm/prediction-market-config";
import { useConfig } from "@/pm/providers";
import Panel from "@/ui/design-system/atoms/panel";
import {
  DojoSdkProviderInitialized,
  MarketStatusFilter,
  MarketTypeFilter,
  useMarkets,
  type MarketFiltersParams,
} from "@pm/sdk";
import { useAccount } from "@starknet-react/core";
import { MarketFilters } from "./landing-markets/market-filters";
import { MARKET_TABS, TabButton, type MarketTab } from "./landing-markets/market-tabs";
import { MarketsLeaderboardView } from "./landing-markets/markets-leaderboard-view";
import { MarketsList } from "./landing-markets/markets-list";
import { PlayerMarketsView } from "./landing-markets/player-markets-view";
import { buildPlayerSummary, useMarketEventsSnapshot } from "./landing-markets/use-market-stats";

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

const MARKET_FILTERS_ALL: MarketFiltersParams = {
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
    className="relative h-[85vh] w-full max-w-[1400px] overflow-y-auto text-gold sm:p-4 md:h-[70vh] md:max-h-[80vh] md:p-6"
  >
    <Panel
      tone="wood"
      padding="lg"
      radius="2xl"
      border="subtle"
      blur
      className="mx-auto w-full max-w-[1250px] shadow-2xl"
    >
      {/* Header */}
      <div className="mb-6 border-b border-gold/10 pb-4">
        <h2 className="font-cinzel text-xl font-semibold text-gold md:text-2xl">Prediction Markets</h2>
        {description ? <p className="mt-1 text-sm text-gold/60">{description}</p> : null}
      </div>

      {children}
    </Panel>
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
      {/* Tab Navigation */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
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

      {/* Tab Content */}
      <div className="animate-fade-in-up">
        {activeTab === "markets" && (
          <div className="space-y-6">
            <MarketFilters marketFilters={marketFilters} setMarketFilters={setMarketFilters} />
            <MarketsList marketFilters={marketFilters} />
          </div>
        )}

        {activeTab === "leaderboard" && <MarketsLeaderboardView />}

        {activeTab === "player" && (
          <PlayerMarketsView
            isLoading={isStatsLoading}
            onRefresh={refresh}
            hasWallet={Boolean(address)}
            summary={playerSummary}
          />
        )}
      </div>
    </MarketsSection>
  );
};
