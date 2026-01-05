import { useQueries } from "@tanstack/react-query";
import type { Chain, FactoryWorld } from "../types";
import { fetchFactoryWorlds } from "../utils/factory-query";

export interface UseFactoryWorldsOptions {
  enabled?: boolean;
  cartridgeApiBase?: string;
}

/**
 * Hook to fetch all available worlds from factory contracts across multiple chains.
 * Uses React Query for caching and deduplication.
 */
export function useFactoryWorlds(chains: Chain[], options: UseFactoryWorldsOptions = {}) {
  const { enabled = true, cartridgeApiBase } = options;
  const uniqueChains = Array.from(new Set(chains)).filter((chain) => chain);

  const queries = useQueries({
    queries: uniqueChains.map((chain) => ({
      queryKey: ["factoryWorlds", chain, cartridgeApiBase],
      queryFn: () => fetchFactoryWorlds(chain, cartridgeApiBase),
      enabled: enabled && !!chain,
      staleTime: 60_000, // 1 minute
      gcTime: 5 * 60_000, // 5 minutes
      retry: 1,
    })),
  });

  const worlds: FactoryWorld[] = queries.flatMap((query) => query.data ?? []);
  const isLoading = queries.some((query) => query.isFetching);
  const error = (queries.find((query) => query.error)?.error ?? null) as Error | null;

  return {
    worlds,
    isLoading,
    error,
    refetchAll: () => Promise.all(queries.map((query) => query.refetch())),
  };
}
