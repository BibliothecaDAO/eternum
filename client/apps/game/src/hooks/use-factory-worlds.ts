import { getFactorySqlBaseUrl } from "@/runtime/world";
import type { Chain } from "@contracts";
import { useQueries } from "@tanstack/react-query";
import { decodePaddedFeltAscii, extractNameFelt, fetchFactoryRows } from "./factory-sql";

const FACTORY_QUERY = `SELECT name FROM [wf-WorldDeployed] LIMIT 1000;`;

export interface FactoryWorld {
  name: string;
  chain: Chain;
}

const fetchFactoryWorlds = async (chain: Chain): Promise<FactoryWorld[]> => {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
  if (!factorySqlBaseUrl) return [];

  const rows = await fetchFactoryRows(factorySqlBaseUrl, FACTORY_QUERY);
  const names: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const feltHex = extractNameFelt(row);
    if (!feltHex) continue;
    const decoded = decodePaddedFeltAscii(feltHex);
    if (!decoded || seen.has(decoded)) continue;
    seen.add(decoded);
    names.push(decoded);
  }

  return names.map((name) => ({ name, chain }));
};

export const useFactoryWorlds = (chains: Chain[], enabled = true) => {
  const uniqueChains = Array.from(new Set(chains)).filter((chain) => chain);
  const queries = useQueries({
    queries: uniqueChains.map((chain) => ({
      queryKey: ["factoryWorlds", chain],
      queryFn: () => fetchFactoryWorlds(chain),
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
