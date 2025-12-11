import { ControllersProvider } from "@/pm/hooks/controllers/useControllers";
import { DojoSdkProviderInitialized, MarketStatusFilter, MarketTypeFilter, type MarketFiltersParams } from "@pm/sdk";
import { useState, type ReactNode } from "react";

import { UserProvider } from "@/pm/hooks/dojo/user";
import { MarketFilters } from "./markets/MarketFilters";
import { MarketsList } from "./markets/MarketsList";

export const PREDICTION_MARKET_CONFIG = {
  // toriiUrl: "https://localhost:8080",
  toriiUrl: "https://api.cartridge.gg/x/blitz-slot-pm-1/torii",
  worldAddress: "0x0172e470e28b6ad5f4c397019a3aca0c9b451a5e06f5255fbb8c4eefcd6f2b58",
};

export const MARKET_FILTERS_ALL: MarketFiltersParams = {
  status: MarketStatusFilter.All,
  type: MarketTypeFilter.All,
  oracle: "All",
};

export const MarketsProviders = ({ children }: { children: ReactNode }) => (
  <DojoSdkProviderInitialized
    toriiUrl={PREDICTION_MARKET_CONFIG.toriiUrl}
    worldAddress={PREDICTION_MARKET_CONFIG.worldAddress}
  >
    <UserProvider>
      <ControllersProvider>{children}</ControllersProvider>
    </UserProvider>
  </DojoSdkProviderInitialized>
);

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

  return (
    <MarketsProviders>
      <MarketsSection description="Browse live prediction markets, inspect their odds, and hop into the ones that interest you.">
        <MarketFilters marketFilters={marketFilters} setMarketFilters={setMarketFilters} />
        <MarketsList marketFilters={marketFilters} />
      </MarketsSection>
    </MarketsProviders>
  );
};
