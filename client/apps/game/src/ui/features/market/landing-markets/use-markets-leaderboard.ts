import { useMemo, useState } from "react";

import { MarketStatusFilter, MarketTypeFilter, useMarkets, type MarketFiltersParams } from "@pm/sdk";

import { useConfig } from "@/pm/providers";

import {
  buildLeaderboard,
  useMarketEventsSnapshot,
  type LeaderboardEntry,
  type MarketLeaderboardRange,
} from "./use-market-stats";

const MARKET_FILTERS_ALL: MarketFiltersParams = {
  status: MarketStatusFilter.All,
  type: MarketTypeFilter.All,
  oracle: "All",
};

export const useMarketsLeaderboard = (
  initialRange: MarketLeaderboardRange = "all",
): {
  entries: LeaderboardEntry[];
  range: MarketLeaderboardRange;
  setRange: (value: MarketLeaderboardRange) => void;
  isLoading: boolean;
  refresh: () => void;
} => {
  const [range, setRange] = useState<MarketLeaderboardRange>(initialRange);
  const { getRegisteredToken } = useConfig();
  const { markets } = useMarkets({ marketFilters: MARKET_FILTERS_ALL });
  const { buys, payouts, isLoading, refresh } = useMarketEventsSnapshot();

  const entries = useMemo(
    () =>
      buildLeaderboard({
        markets,
        buys,
        payouts,
        range,
        getRegisteredToken,
      }),
    [buys, getRegisteredToken, markets, payouts, range],
  );

  return {
    entries,
    range,
    setRange,
    isLoading,
    refresh,
  };
};
