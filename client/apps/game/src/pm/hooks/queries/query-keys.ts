/**
 * PM Query Keys Factory
 * Stable query keys for @tanstack/react-query caching and invalidation
 */

import type { MarketFiltersParams } from "./pm-sql-api";
import type { PredictionMarketChain } from "../../manifest-loader";

export const pmQueryKeys = {
  all: ["pm"] as const,

  // Markets
  markets: () => [...pmQueryKeys.all, "markets"] as const,
  marketsListWithPagination: (filters: MarketFiltersParams, page: number, limit: number) =>
    [...pmQueryKeys.markets(), "list", filters, { page, limit }] as const,
  marketsCount: (filters: MarketFiltersParams) => [...pmQueryKeys.markets(), "count", filters] as const,
  marketByPrizeAddress: (prizeAddress: string, chain?: PredictionMarketChain) =>
    [...pmQueryKeys.markets(), "byPrize", chain ?? "slot", prizeAddress] as const,
  marketNumerators: (marketIds: string[], chain?: PredictionMarketChain) =>
    [...pmQueryKeys.markets(), "numerators", chain ?? "slot", marketIds] as const,
};
