import { getFactorySqlBaseUrl } from "@/runtime/world";
import type { Chain } from "@contracts";
import { useQueries } from "@tanstack/react-query";
import { shortString } from "starknet";

const FACTORY_QUERY = `SELECT name FROM [wf-WorldDeployed] LIMIT 1000;`;

export interface FactoryWorld {
  name: string;
  chain: Chain;
}

const decodePaddedFeltAscii = (hex: string): string => {
  try {
    if (!hex) return "";
    const h = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
    if (h === "0") return "";
    try {
      const asDec = BigInt("0x" + h).toString();
      const decoded = shortString.decodeShortString(asDec);
      if (decoded && decoded.trim().length > 0) return decoded;
    } catch {
      // ignore and fallback to manual decode
    }
    let i = 0;
    while (i + 1 < h.length && h.slice(i, i + 2) === "00") i += 2;
    let out = "";
    for (; i + 1 < h.length; i += 2) {
      const byte = parseInt(h.slice(i, i + 2), 16);
      if (byte === 0) continue;
      out += String.fromCharCode(byte);
    }
    return out;
  } catch {
    return "";
  }
};

const extractNameFelt = (row: Record<string, unknown>): string | null => {
  const direct = row.name ?? row["data.name"];
  if (typeof direct === "string") return direct;

  const data = row.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const nested = (data as Record<string, unknown>).name;
    if (typeof nested === "string") return nested;
  }

  return null;
};

const fetchFactoryWorlds = async (chain: Chain): Promise<FactoryWorld[]> => {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
  if (!factorySqlBaseUrl) return [];

  const url = `${factorySqlBaseUrl}?query=${encodeURIComponent(FACTORY_QUERY)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Factory query failed for ${chain}: ${res.status} ${res.statusText}`);

  const rows = (await res.json()) as Record<string, unknown>[];
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
