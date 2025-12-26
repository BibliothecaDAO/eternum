/**
 * PM Query Keys Factory
 * Stable query keys for @tanstack/react-query caching and invalidation
 */

import type { MarketFiltersParams } from "./pm-sql-api";

export const pmQueryKeys = {
  all: ["pm"] as const,

  // Markets
  markets: () => [...pmQueryKeys.all, "markets"] as const,
  marketsList: (filters: MarketFiltersParams) => [...pmQueryKeys.markets(), "list", filters] as const,
  marketsListWithPagination: (filters: MarketFiltersParams, page: number, limit: number) =>
    [...pmQueryKeys.markets(), "list", filters, { page, limit }] as const,
  marketsCount: (filters: MarketFiltersParams) => [...pmQueryKeys.markets(), "count", filters] as const,
  marketDetail: (marketId: string) => [...pmQueryKeys.markets(), "detail", marketId] as const,
  marketByPrizeAddress: (prizeAddress: string) => [...pmQueryKeys.markets(), "byPrize", prizeAddress] as const,
  marketHistory: (marketId: string) => [...pmQueryKeys.markets(), "history", marketId] as const,
  marketNumerators: (marketIds: string[]) => [...pmQueryKeys.markets(), "numerators", marketIds] as const,
  marketDenominatorEvents: (marketId: string) => [...pmQueryKeys.markets(), "denominatorEvents", marketId] as const,
  marketNumeratorEvents: (marketId: string) => [...pmQueryKeys.markets(), "numeratorEvents", marketId] as const,
  marketVaultEvents: (marketId: string) => [...pmQueryKeys.markets(), "vaultEvents", marketId] as const,

  // Positions
  positions: () => [...pmQueryKeys.all, "positions"] as const,
  userPositions: (address: string) => [...pmQueryKeys.positions(), "user", address] as const,
  marketPositions: (address: string, marketId: string) =>
    [...pmQueryKeys.positions(), "market", address, marketId] as const,
  claimable: (address: string) => [...pmQueryKeys.positions(), "claimable", address] as const,

  // Tokens
  tokens: () => [...pmQueryKeys.all, "tokens"] as const,
  userTokens: (address: string, contractAddresses: string[]) =>
    [...pmQueryKeys.tokens(), "user", address, contractAddresses] as const,
};

// Type helper for query key inference
export type PmQueryKeys = typeof pmQueryKeys;
