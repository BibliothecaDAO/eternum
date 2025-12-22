/**
 * useMarketHistory Hook - SQL-optimized implementation
 *
 * This hook now uses SQL queries via Torii for better performance:
 * - Server-side filtering by market ID eliminates fetching all events
 * - React Query provides caching and deduplication
 * - Binary search for timestamp lookups remains client-side (most efficient approach)
 */

import type { MarketClass } from "@/pm/class";
import { useMarketHistoryQuery } from "@/pm/hooks/queries";

/**
 * Hook to fetch market history chart data
 *
 * @param market - The market to fetch history for
 * @param refreshKey - Optional key to trigger refetch (deprecated, use refetch() instead)
 */
export const useMarketHistory = (market: MarketClass, _refreshKey = 0) => {
  const { chartData, chartConfig, isLoading, isError } = useMarketHistoryQuery({
    market,
    enabled: true,
  });

  return {
    chartData,
    chartConfig,
    isLoading,
    isError,
  };
};
