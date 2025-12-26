/**
 * useMarkets Hook - SQL-optimized implementation with server-side pagination
 *
 * This hook now uses SQL queries via Torii for better performance:
 * - Server-side joins eliminate client-side map building
 * - Server-side filtering for accurate pagination counts
 * - Numerators fetched only for visible markets
 * - React Query provides caching and deduplication
 * - keepPreviousData prevents UI flicker during page transitions
 */

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { CairoCustomEnum } from "starknet";

import type { RegisteredToken } from "@/pm/bindings";
import { MarketClass } from "@/pm/class";
import { useConfig } from "@/pm/providers";
import { replaceAndFormat } from "@/pm/utils";

import {
  getPmSqlApi,
  pmQueryKeys,
  type MarketFiltersParams,
  type MarketWithDetailsRow,
  type VaultNumeratorRow,
} from "../queries";

// Re-export filter types for backwards compatibility
export { MarketStatusFilter, MarketTypeFilter } from "../queries";
export type { MarketFiltersParams } from "../queries";

/**
 * Build proper CairoCustomEnum for the market type field
 * Converts ValueEq/Ranges values to BigInt for proper hex conversion
 */
function buildMarketTypeEnum(row: MarketWithDetailsRow): CairoCustomEnum {
  if (row["typ.Binary"] !== null && row["typ.Binary"] !== undefined) {
    return new CairoCustomEnum({ Binary: {} });
  }

  // Categorical market - need to check for nested type
  if (row["typ.Categorical.ValueEq"]) {
    const rawValueEq = JSON.parse(row["typ.Categorical.ValueEq"]);
    // Convert values to BigInt for proper hex conversion in getMarketTextOutcomes
    const valueEq = rawValueEq.map((v: string | number) => BigInt(v));
    return new CairoCustomEnum({
      Categorical: new CairoCustomEnum({ ValueEq: valueEq }),
    });
  }

  if (row["typ.Categorical.Ranges"]) {
    const rawRanges = JSON.parse(row["typ.Categorical.Ranges"]);
    // Convert values to BigInt for proper formatting
    const ranges = rawRanges.map((v: string | number) => BigInt(v));
    return new CairoCustomEnum({
      Categorical: new CairoCustomEnum({ Ranges: ranges }),
    });
  }

  // Fallback for categorical without nested data
  return new CairoCustomEnum({
    Categorical: new CairoCustomEnum({ ValueEq: [] }),
  });
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

  // Parse oracle_params from JSON string if present
  const oracleParams = row.oracle_params ? JSON.parse(row.oracle_params) : [];

  // Helper to safely get nested row values (column names use dot notation in SQL results)
  const rowAny = row as unknown as Record<string, string | undefined>;
  const getRowValue = (key: string): string | undefined => rowAny[key];

  // Build the MarketModelVault structure with fee curves
  // Column names in Torii SQL follow the pattern: "model.Vault.fee_curve.Range.start"
  const vaultModel = {
    initial_repartition: getRowValue("model.Vault.initial_repartition")
      ? JSON.parse(getRowValue("model.Vault.initial_repartition")!)
      : [],
    funding_amount: BigInt(getRowValue("model.Vault.funding_amount") ?? 0),
    fee_curve: new CairoCustomEnum({
      Range: {
        start: BigInt(getRowValue("model.Vault.fee_curve.Range.start") ?? 0),
        end: BigInt(getRowValue("model.Vault.fee_curve.Range.end") ?? 0),
      },
    }),
    fee_share_curve: new CairoCustomEnum({
      Range: {
        start: BigInt(getRowValue("model.Vault.fee_share_curve.Range.start") ?? 0),
        end: BigInt(getRowValue("model.Vault.fee_share_curve.Range.end") ?? 0),
      },
    }),
  };

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
    model: new CairoCustomEnum({ Vault: vaultModel }),
    typ: buildMarketTypeEnum(row),
    oracle_params: oracleParams,
    oracle_extra_params: [],
    oracle_value_type: row.oracle_value_type,
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

interface UseMarketsOptions {
  marketFilters: MarketFiltersParams;
  limit?: number;
  offset?: number;
}

/**
 * Hook to fetch markets using SQL queries for optimized performance
 *
 * Benefits over the old SDK-based implementation:
 * - Server-side joins (no client-side map building)
 * - Server-side filtering for accurate pagination counts
 * - Fetches numerators only for visible markets
 * - React Query caching (30s staleTime, 5min gcTime)
 * - Automatic request deduplication
 * - keepPreviousData prevents UI flicker during page transitions
 */
export const useMarkets = ({ marketFilters, limit = 25, offset = 0 }: UseMarketsOptions) => {
  const { registeredTokens, getRegisteredToken } = useConfig();
  const queryClient = useQueryClient();

  const now = BigInt(Math.ceil(Date.now() / 1000));

  // Fetch markets with pre-joined details via SQL (with server-side filtering)
  const marketsQuery = useQuery({
    queryKey: pmQueryKeys.marketsListWithPagination(marketFilters, Math.floor(offset / limit), limit),
    queryFn: async () => {
      const api = getPmSqlApi();
      return api.fetchMarketsWithDetails(marketFilters, Number(now), limit, offset);
    },
    enabled: registeredTokens.length > 0,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: keepPreviousData, // Prevents UI flicker during page transitions
  });

  // Fetch total count for pagination (with same filters)
  const countQuery = useQuery({
    queryKey: pmQueryKeys.marketsCount(marketFilters),
    queryFn: async () => {
      const api = getPmSqlApi();
      return api.fetchMarketsCount(marketFilters, Number(now));
    },
    enabled: registeredTokens.length > 0,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Extract market IDs from fetched results
  const marketIds = useMemo(() => {
    if (!marketsQuery.data) return [];
    return marketsQuery.data.map((m) => m.market_id);
  }, [marketsQuery.data]);

  // Fetch vault numerators only for visible markets (not all 10,000+)
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

  // Build numerators lookup map (O(n) once, not per market)
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

  // Transform markets (filtering now done server-side)
  const markets = useMemo(() => {
    if (!marketsQuery.data || !registeredTokens.length) return [];

    return marketsQuery.data
      .map((row) => transformToMarketClass(row, numeratorsByMarketId, getRegisteredToken))
      .filter((m): m is MarketClass => m !== null);
  }, [marketsQuery.data, numeratorsByMarketId, registeredTokens, getRegisteredToken]);

  // Refresh function that invalidates the query cache
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: pmQueryKeys.markets() });
  };

  return {
    markets,
    refresh,
    // Loading and error states
    isLoading: marketsQuery.isLoading || numeratorsQuery.isLoading,
    isError: marketsQuery.isError || numeratorsQuery.isError,
    // Pagination metadata
    isFetching: marketsQuery.isFetching, // True during page transitions (different from isLoading)
    totalCount: countQuery.data ?? 0,
  };
};
