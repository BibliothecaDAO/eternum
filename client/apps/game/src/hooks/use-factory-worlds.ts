import { listFactoryWorlds } from "@/runtime/world";
import type { Chain } from "@contracts";
import { useQueries } from "@tanstack/react-query";

export const useFactoryWorlds = (chains: Chain[], enabled = true) => {
  const uniqueChains = Array.from(new Set(chains)).filter((chain) => chain);
  const queries = useQueries({
    queries: uniqueChains.map((chain) => ({
      queryKey: ["factoryWorlds", chain],
      queryFn: () => listFactoryWorlds(chain),
      enabled: enabled && !!chain,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
    })),
  });

  const worlds = queries.flatMap((query) => query.data ?? []);
  const isLoading = queries.some((query) => query.isFetching);
  const error = (queries.find((query) => query.error)?.error ?? null) as Error | null;

  return {
    worlds,
    isLoading,
    error,
    refetchAll: () => Promise.all(queries.map((query) => query.refetch())),
  };
};
