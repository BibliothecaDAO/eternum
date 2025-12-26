/**
 * PM Query Keys Factory
 * Stable query keys for @tanstack/react-query caching and invalidation
 */

import type { MarketFiltersParams } from "./pm-sql-api";

export const pmQueryKeys = {
  all: ["pm"] as const,

  // Markets
  markets: () => [...pmQueryKeys.all, "markets"] as const,
  marketsListWithPagination: (filters: MarketFiltersParams, page: number, limit: number) =>
    [...pmQueryKeys.markets(), "list", filters, { page, limit }] as const,
  marketsCount: (filters: MarketFiltersParams) => [...pmQueryKeys.markets(), "count", filters] as const,
  marketByPrizeAddress: (prizeAddress: string) => [...pmQueryKeys.markets(), "byPrize", prizeAddress] as const,
  marketNumerators: (marketIds: string[]) => [...pmQueryKeys.markets(), "numerators", marketIds] as const,
};

// Type helper for query key inference
export type PmQueryKeys = typeof pmQueryKeys;
