import { useQuery } from "@tanstack/react-query";
import type { GameChain as Chain } from "@realms-world/chain";
import { getDefaultWorld } from "@/runtime/world/world-directory";
import { decodePaddedFeltAscii, fetchFactoryRows } from "@/runtime/world/factory-sql";
import { normalizeHex } from "@/runtime/world/normalize";

const S2_SERIES_BY_OWNER_QUERY = (ownerHex: string) =>
  `SELECT series_id, game_count FROM [s2-Series] WHERE owner = "${ownerHex}" LIMIT 50;`;

export interface FactorySeries {
  name: string;
  paddedName: string;
  lastGameNumber: bigint | null;
}

const fetchSeriesOwned = async (worldSqlBaseUrl: string, ownerHex: string): Promise<FactorySeries[]> => {
  const rows = await fetchFactoryRows(worldSqlBaseUrl, S2_SERIES_BY_OWNER_QUERY(ownerHex));

  const series: FactorySeries[] = [];
  for (const row of rows) {
    const paddedName = typeof row.series_id === "string" ? row.series_id : null;
    if (!paddedName) continue;
    const name = decodePaddedFeltAscii(paddedName);
    if (!name) continue;

    const rawCount = row.game_count;
    const gameCount =
      typeof rawCount === "number" && Number.isFinite(rawCount)
        ? BigInt(rawCount)
        : typeof rawCount === "string" && rawCount.trim()
          ? BigInt(rawCount)
          : null;

    series.push({ name, paddedName, lastGameNumber: gameCount && gameCount > 0n ? gameCount : null });
  }

  return series;
};

export const useFactorySeries = (chain: Chain, ownerAddress: string | undefined | null) => {
  const normalizedOwner = ownerAddress ? normalizeHex(ownerAddress) : null;
  const world = getDefaultWorld();
  const worldSqlBaseUrl = world.chain === chain ? `${world.toriiBaseUrl}/sql` : null;

  return useQuery<FactorySeries[], Error>({
    queryKey: ["factorySeries", chain, normalizedOwner],
    queryFn: () => {
      if (!normalizedOwner || !worldSqlBaseUrl) return [];
      return fetchSeriesOwned(worldSqlBaseUrl, normalizedOwner);
    },
    enabled: !!normalizedOwner && !!worldSqlBaseUrl,
    staleTime: 60_000,
    retry: 1,
  });
};
