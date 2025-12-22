/**
 * useMarketsQuery - React Query hook for fetching markets via SQL
 *
 * This hook fetches markets with pre-joined data from the PM Torii SQL endpoint,
 * eliminating the need for client-side map building and lookups.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type { RegisteredToken } from "@/pm/bindings";
import { MarketClass } from "@/pm/class";
import { useConfig } from "@/pm/providers";
import { replaceAndFormat } from "@/pm/utils";

import { pmQueryKeys } from "./query-keys";
import { getPmSqlApi, type MarketWithDetailsRow, type VaultNumeratorRow } from "./pm-sql-api";
import type { MarketFiltersParams } from "../markets/use-markets";
import { MarketStatusFilter, MarketTypeFilter } from "../markets/use-markets";

// Re-export filter types for convenience
export { MarketStatusFilter, MarketTypeFilter };

interface UseMarketsQueryOptions {
  marketFilters: MarketFiltersParams;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

interface UseMarketsQueryResult {
  markets: MarketClass[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Filter markets based on status
 */
function filterByStatus(market: MarketWithDetailsRow, status: MarketStatusFilter, now: bigint): boolean {
  const startAt = BigInt(market.start_at);
  const resolveAt = BigInt(market.resolve_at);
  const resolvedAt = BigInt(market.resolved_at);

  switch (status) {
    case MarketStatusFilter.All:
      return startAt < now;
    case MarketStatusFilter.Open:
      return startAt < now && resolveAt > now;
    case MarketStatusFilter.Resolvable:
      return resolveAt < now && resolvedAt === 0n;
    case MarketStatusFilter.Resolved:
      return resolvedAt > 0n;
    default:
      return false;
  }
}

/**
 * Filter markets based on type (Binary/Categorical)
 */
function filterByType(market: MarketWithDetailsRow, typeFilter: MarketTypeFilter): boolean {
  switch (typeFilter) {
    case MarketTypeFilter.All:
      return true;
    case MarketTypeFilter.Binary:
      return market.typ === "Binary" || market["typ.Binary"] !== null;
    case MarketTypeFilter.Categorical:
      return market.typ === "Categorical" || market["typ.Categorical"] !== null;
    default:
      return false;
  }
}

/**
 * Transform SQL row data into MarketClass instances
 */
function transformToMarketClass(
  row: MarketWithDetailsRow,
  numeratorsByMarketId: Map<string, VaultNumeratorRow[]>,
  getRegisteredToken: (address: string | undefined) => RegisteredToken,
): MarketClass | null {
  if (!row.title) return null;

  const collateralToken = getRegisteredToken(row.collateral_token);

  const numerators = numeratorsByMarketId.get(row.market_id) ?? [];

  // Build the market object matching the expected structure
  const market = {
    market_id: BigInt(row.market_id),
    creator: row.creator,
    created_at: BigInt(row.created_at),
    question_id: BigInt(row.question_id),
    condition_id: BigInt(row.condition_id),
    oracle: row.oracle,
    outcome_slot_count: row.outcome_slot_count,
    collateral_token: row.collateral_token,
    model: { variant: { Vault: {} } },
    typ: row["typ.Binary"] ? { variant: { Binary: {} } } : { variant: { Categorical: {} } },
    start_at: BigInt(row.start_at),
    end_at: BigInt(row.end_at),
    resolve_at: BigInt(row.resolve_at),
    resolved_at: BigInt(row.resolved_at),
    oracle_fee: row.oracle_fee,
    creator_fee: row.creator_fee,
  };

  const marketCreated = {
    market_id: BigInt(row.market_id),
    title: replaceAndFormat(row.title),
    terms: replaceAndFormat(row.terms ?? ""),
    position_ids: row.position_ids ? JSON.parse(row.position_ids) : [],
  };

  const vaultDenominator = row.denominator
    ? { market_id: BigInt(row.market_id), value: BigInt(row.denominator) }
    : undefined;

  const vaultNumerators = numerators.map((n) => ({
    market_id: BigInt(n.market_id),
    index: n.index,
    value: BigInt(n.value),
  }));

  return new MarketClass({
    market: market as never,
    marketCreated: marketCreated as never,
    collateralToken,
    vaultDenominator: vaultDenominator as never,
    vaultNumerators: vaultNumerators as never[],
  });
}

/**
 * Hook to fetch markets using SQL queries
 */
export function useMarketsQuery({
  marketFilters,
  limit = 100,
  offset = 0,
  enabled = true,
}: UseMarketsQueryOptions): UseMarketsQueryResult {
  const { registeredTokens, getRegisteredToken } = useConfig();
  const queryClient = useQueryClient();

  const now = BigInt(Math.ceil(Date.now() / 1000));

  // Fetch markets with details
  const marketsQuery = useQuery({
    queryKey: pmQueryKeys.marketsListWithPagination(marketFilters, offset / limit, limit),
    queryFn: async () => {
      const api = getPmSqlApi();
      return api.fetchMarketsWithDetails(Number(now), limit, offset);
    },
    enabled: enabled && registeredTokens.length > 0,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Extract market IDs from the results
  const marketIds = useMemo(() => {
    if (!marketsQuery.data) return [];
    return marketsQuery.data.map((m) => m.market_id);
  }, [marketsQuery.data]);

  // Fetch vault numerators for the fetched markets
  const numeratorsQuery = useQuery({
    queryKey: pmQueryKeys.marketNumerators(marketIds),
    queryFn: async () => {
      const api = getPmSqlApi();
      return api.fetchVaultNumeratorsByMarkets(marketIds);
    },
    enabled: marketIds.length > 0,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Build numerators lookup map
  const numeratorsByMarketId = useMemo(() => {
    const map = new Map<string, VaultNumeratorRow[]>();
    if (!numeratorsQuery.data) return map;

    for (const n of numeratorsQuery.data) {
      if (!map.has(n.market_id)) map.set(n.market_id, []);
      map.get(n.market_id)!.push(n);
    }
    // Sort each group by index
    for (const arr of map.values()) {
      arr.sort((a, b) => a.index - b.index);
    }
    return map;
  }, [numeratorsQuery.data]);

  // Transform and filter markets
  const markets = useMemo(() => {
    if (!marketsQuery.data || !registeredTokens.length) return [];

    return marketsQuery.data
      .filter((row) => {
        // Apply status filter
        if (!filterByStatus(row, marketFilters.status, now)) return false;
        // Apply type filter
        if (!filterByType(row, marketFilters.type)) return false;
        // Apply oracle filter
        if (marketFilters.oracle !== "All" && row.oracle !== marketFilters.oracle) return false;
        return true;
      })
      .map((row) => transformToMarketClass(row, numeratorsByMarketId, getRegisteredToken))
      .filter((m): m is MarketClass => m !== null);
  }, [marketsQuery.data, numeratorsByMarketId, marketFilters, now, registeredTokens, getRegisteredToken]);

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: pmQueryKeys.markets() });
  };

  return {
    markets,
    isLoading: marketsQuery.isLoading || numeratorsQuery.isLoading,
    isError: marketsQuery.isError || numeratorsQuery.isError,
    error: marketsQuery.error ?? numeratorsQuery.error ?? null,
    refetch,
  };
}
