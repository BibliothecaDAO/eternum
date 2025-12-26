import { useMemo } from "react";

import { MarketStatusFilter, MarketTypeFilter, useMarkets, type MarketFiltersParams } from "@pm/sdk";
import { dojoConfig } from "../../../../../dojo-config";

const MARKET_FILTERS_ALL: MarketFiltersParams = {
  status: MarketStatusFilter.All,
  type: MarketTypeFilter.All,
  oracle: "All",
};

const normalizeHex = (value: unknown): string | null => {
  if (value == null) return null;
  try {
    const bigVal = typeof value === "string" ? BigInt(value) : BigInt(value as any);
    return `0x${bigVal.toString(16).toLowerCase()}`;
  } catch {
    return null;
  }
};

const getPrizeDistributionAddress = (market: any): string | null => {
  const params: any[] = market?.oracle_params || [];
  if (!Array.isArray(params) || params.length < 2) return null;
  const prize = normalizeHex(params[1]);
  return prize === "0x0" ? null : prize;
};

/**
 * Hook that finds the prediction market associated with the current game.
 * Matches by comparing the prize_distribution_systems contract address in the game manifest
 * with the oracle_params[1] (prize contract address) stored in each market.
 */
export const useCurrentGameMarket = () => {
  const { manifest } = dojoConfig;
  const { markets, refresh, isLoading: isMarketsLoading } = useMarkets({ marketFilters: MARKET_FILTERS_ALL });

  // Get current game's prize distribution contract address from manifest
  const currentPrizeAddress = useMemo(() => {
    const contracts = manifest?.contracts;
    if (!Array.isArray(contracts)) return null;

    const prizeContract = contracts.find((c: any) => c.tag === "s1_eternum-prize_distribution_systems");
    return prizeContract?.address ? normalizeHex(prizeContract.address) : null;
  }, [manifest]);

  // Find market where oracle_params[1] matches current game's prize contract
  const gameMarket = useMemo(() => {
    if (!currentPrizeAddress || !markets.length) return null;

    return markets.find((market) => {
      const marketPrize = getPrizeDistributionAddress(market);
      return marketPrize && marketPrize === currentPrizeAddress;
    });
  }, [markets, currentPrizeAddress]);

  return {
    gameMarket,
    isLoading: isMarketsLoading,
    refresh,
    currentPrizeAddress,
    hasMarket: !!gameMarket,
  };
};
