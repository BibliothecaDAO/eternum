/**
 * useMarketHistoryQuery - React Query hook for fetching market history chart data via SQL
 *
 * This hook fetches vault denominator and numerator events from the PM Torii SQL endpoint,
 * then transforms them into chart data points.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import type { RegisteredToken } from "@/pm/bindings";
import type { MarketClass } from "@/pm/class";
import { getOutcomeColor } from "@/pm/constants/market-outcome-colors";
import { useControllers } from "@/pm/hooks/controllers/use-controllers";
import { formatUnits, shortAddress } from "@/pm/utils";

import { getPmSqlApi, type VaultDenominatorEventRow, type VaultNumeratorEventRow } from "./pm-sql-api";
import { pmQueryKeys } from "./query-keys";

const toBigInt = (value: string | undefined): bigint => {
  if (value === undefined || value === null) return 0n;
  if (typeof value === "string" && value.startsWith("0x")) return BigInt(value);
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const compactLabel = (value: string): string => {
  const trimmed = value.trim();

  if (trimmed.startsWith("0x")) {
    try {
      return shortAddress(trimmed);
    } catch {
      // fall through to generic truncation
    }
  }

  if (trimmed.length > 16) {
    return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
  }

  return trimmed;
};

interface UseMarketHistoryQueryOptions {
  market: MarketClass;
  enabled?: boolean;
}

// Chart data point compatible with recharts (uses Record for dynamic keys)
type ChartDataPoint = Record<string, number | string>;

interface ChartConfigEntry {
  label: string;
  color: string;
}

/**
 * Binary search helper to find the last numerator with timestamp <= target
 */
function findLastLessThanOrEqual(
  numerators: VaultNumeratorEventRow[],
  targetTimestamp: bigint,
): VaultNumeratorEventRow | undefined {
  if (numerators.length === 0) return undefined;

  let left = 0;
  let right = numerators.length - 1;
  let result: VaultNumeratorEventRow | undefined = undefined;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTimestamp = BigInt(numerators[mid].timestamp);

    if (midTimestamp <= targetTimestamp) {
      result = numerators[mid];
      left = mid + 1; // Look for a later one
    } else {
      right = mid - 1;
    }
  }

  return result;
}

/**
 * Hook to fetch market history chart data using SQL queries
 */
export function useMarketHistoryQuery({ market, enabled = true }: UseMarketHistoryQueryOptions) {
  const { findController, controllers } = useControllers();

  const marketId = market.market_id.toString();
  const collateralToken = market.collateralToken as RegisteredToken;
  const outcomesText = useMemo(() => market.getMarketTextOutcomes(), [market]);

  // Fetch denominator events
  const denominatorsQuery = useQuery({
    queryKey: pmQueryKeys.marketDenominatorEvents(marketId),
    queryFn: async () => {
      const api = getPmSqlApi();
      return api.fetchVaultDenominatorEvents(marketId);
    },
    enabled,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch numerator events
  const numeratorsQuery = useQuery({
    queryKey: pmQueryKeys.marketNumeratorEvents(marketId),
    queryFn: async () => {
      const api = getPmSqlApi();
      return api.fetchVaultNumeratorEvents(marketId);
    },
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Group numerators by index (outcome slot), sorted by timestamp
  const numeratorsByIndex = useMemo(() => {
    const map = new Map<number, VaultNumeratorEventRow[]>();
    if (!numeratorsQuery.data) return map;

    for (const n of numeratorsQuery.data) {
      if (!map.has(n.index)) map.set(n.index, []);
      map.get(n.index)!.push(n);
    }

    // Already sorted by timestamp in SQL, but ensure sorted just in case
    for (const arr of map.values()) {
      arr.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    }

    return map;
  }, [numeratorsQuery.data]);

  // Deduplicate denominators by timestamp (keep last one for each timestamp)
  const denominators = useMemo(() => {
    if (!denominatorsQuery.data) return [];

    // Deduplicate: keep only the last entry for each timestamp
    return denominatorsQuery.data.filter(
      (event, idx, arr) => arr.findLastIndex((item) => item.timestamp === event.timestamp) === idx,
    );
  }, [denominatorsQuery.data]);

  // Build chart config
  const chartConfig = useMemo(() => {
    return Object.fromEntries(
      new Array(market.outcome_slot_count).fill(0).map((_i, idx) => {
        const controller = findController(outcomesText[idx]);

        return [
          `p${idx}`,
          {
            label: controller ? controller.username : compactLabel(outcomesText[idx]),
            color: getOutcomeColor(idx),
          },
        ];
      }),
    ) as Record<`p${number}`, ChartConfigEntry>;
  }, [market.outcome_slot_count, outcomesText, findController, controllers]);

  // Transform to chart data
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!denominators.length) return [];

    return denominators.map((denominator) => {
      const denomRaw = toBigInt(denominator.value);
      const denom = formatUnits(denomRaw, Number(collateralToken.decimals || 0));
      const denomTimestamp = BigInt(denominator.timestamp);

      const entry: ChartDataPoint = {
        date: Number(denominator.timestamp) * 1_000,
        tvl: denom,
      };

      for (let i = 0; i < market.outcome_slot_count; i++) {
        const numerators = numeratorsByIndex.get(i) ?? [];

        // O(log n) binary search instead of O(n) findLast
        const numerator = findLastLessThanOrEqual(numerators, denomTimestamp);

        const numRaw = toBigInt(numerator?.value);
        entry[`p${i}`] = denomRaw === 0n ? 0 : Number((numRaw * 100n) / denomRaw);
      }

      return entry;
    });
  }, [denominators, numeratorsByIndex, market.outcome_slot_count, collateralToken.decimals]);

  return {
    chartData,
    chartConfig,
    isLoading: denominatorsQuery.isLoading || numeratorsQuery.isLoading,
    isError: denominatorsQuery.isError || numeratorsQuery.isError,
    error: denominatorsQuery.error ?? numeratorsQuery.error ?? null,
  };
}
