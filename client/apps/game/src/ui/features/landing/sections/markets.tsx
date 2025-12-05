import { useMemo } from "react";

import { DojoSdkProviderInitialized, MarketStatusFilter, MarketTypeFilter, type MarketFiltersParams } from "@pm/sdk";

import { MarketsList } from "./markets/MarketsList";

export const LandingMarkets = () => {
  const marketFilters = useMemo<MarketFiltersParams>(
    () => ({
      status: MarketStatusFilter.All,
      type: MarketTypeFilter.All,
      oracle: "All",
    }),
    [],
  );

  return (
    <DojoSdkProviderInitialized
      toriiUrl="https://127.0.0.1:8080"
      worldAddress="0x0172e470e28b6ad5f4c397019a3aca0c9b451a5e06f5255fbb8c4eefcd6f2b58"
    >
      <section
        aria-label="Prediction markets"
        className="relative h-[70vh] w-full max-w-5xl space-y-6 overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-black/40 to-black/90 p-8 text-white shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl md:max-h-[80vh]"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 rounded-2xl border border-gold/30 bg-black/40 p-6 shadow-lg shadow-black/30">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold text-gold">Prediction Markets</h2>
            <p className="text-sm text-gold/70">
              Browse live prediction markets, inspect their odds, and hop into the ones that interest you.
            </p>
          </div>

          {/* <MarketFilters marketFilters={marketFilters} setMarketFilters={setMarketFilters} /> */}

          <MarketsList marketFilters={marketFilters} />
        </div>
      </section>
    </DojoSdkProviderInitialized>
  );
};
