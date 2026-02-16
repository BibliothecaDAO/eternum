import { getFactorySqlBaseUrl } from "@/runtime/world";
import type { Chain } from "@contracts";
import { useQueries } from "@tanstack/react-query";
import { decodePaddedFeltAscii, extractContractAddress, extractNameFelt, fetchFactoryRows } from "./factory-sql";

const FACTORY_QUERY = `SELECT name, contract_address FROM [wf-WorldDeployed] LIMIT 1000;`;

interface FactoryWorld {
  name: string;
  chain: Chain;
  worldAddress: string | null;
}

const fetchFactoryWorlds = async (chain: Chain): Promise<FactoryWorld[]> => {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
  if (!factorySqlBaseUrl) return [];

  const rows = await fetchFactoryRows(factorySqlBaseUrl, FACTORY_QUERY);
  const seen = new Set<string>();
  const worlds: FactoryWorld[] = [];

  for (const row of rows) {
    const feltHex = extractNameFelt(row);
    if (!feltHex) continue;
    const decoded = decodePaddedFeltAscii(feltHex);
    if (!decoded || seen.has(decoded)) continue;
    seen.add(decoded);
    worlds.push({
      name: decoded,
      chain,
      worldAddress: extractContractAddress(row),
    });
  }

  return worlds;
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
