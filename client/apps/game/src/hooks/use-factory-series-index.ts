import { getFactorySqlBaseUrl } from "@/runtime/world";
import { decodePaddedFeltAscii, extractGameNumberFromRow, fetchFactoryRows } from "@/runtime/world/factory-sql";
import type { Chain } from "@contracts";
import { useQueries } from "@tanstack/react-query";

const FACTORY_SERIES_INDEX_QUERY = `
SELECT
  sg.name AS series_name,
  sg.game_number AS game_number,
  wc.name AS world_name
FROM [wf-SeriesGame] sg
JOIN [wf-WorldContract] wc
  ON wc.contract_address = sg.contract_address
ORDER BY sg.name, sg.game_number ASC
LIMIT 50000;
`;

interface FactorySeriesGame {
  worldName: string;
  gameNumber: bigint | null;
}

export interface FactorySeriesIndex {
  chain: Chain;
  name: string;
  paddedName: string;
  games: FactorySeriesGame[];
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const readStringField = (row: Record<string, unknown>, key: string): string | null => {
  const direct = row[key];
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct;
  }

  const data = asRecord(row.data);
  const nested = data?.[key];
  if (typeof nested === "string" && nested.trim().length > 0) {
    return nested;
  }

  return null;
};

const fetchSeriesIndex = async (chain: Chain): Promise<FactorySeriesIndex[]> => {
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
  if (!factorySqlBaseUrl) return [];

  const rows = await fetchFactoryRows(factorySqlBaseUrl, FACTORY_SERIES_INDEX_QUERY);
  const bySeries = new Map<string, FactorySeriesIndex>();

  for (const row of rows) {
    const seriesFelt = readStringField(row, "series_name");
    const worldFelt = readStringField(row, "world_name");
    if (!seriesFelt || !worldFelt) continue;

    const seriesName = decodePaddedFeltAscii(seriesFelt).trim();
    const worldName = decodePaddedFeltAscii(worldFelt).trim();
    if (!seriesName || !worldName) continue;

    const gameNumber = extractGameNumberFromRow(row);
    const existing =
      bySeries.get(seriesFelt) ??
      ({
        chain,
        name: seriesName,
        paddedName: seriesFelt,
        games: [],
      } satisfies FactorySeriesIndex);

    const hasGame = existing.games.some((game) => game.worldName === worldName);
    if (!hasGame) {
      existing.games.push({
        worldName,
        gameNumber,
      });
    }

    bySeries.set(seriesFelt, existing);
  }

  return Array.from(bySeries.values())
    .map((series) => ({
      ...series,
      games: series.games.toSorted((a, b) => {
        if (a.gameNumber === null && b.gameNumber === null) return a.worldName.localeCompare(b.worldName);
        if (a.gameNumber === null) return 1;
        if (b.gameNumber === null) return -1;
        if (a.gameNumber === b.gameNumber) return a.worldName.localeCompare(b.worldName);
        return a.gameNumber < b.gameNumber ? -1 : 1;
      }),
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
};

export const useFactorySeriesIndex = (chains: Chain[], enabled = true) => {
  const uniqueChains = Array.from(new Set(chains)).filter((chain) => chain);

  const queries = useQueries({
    queries: uniqueChains.map((chain) => ({
      queryKey: ["factorySeriesIndex", chain],
      queryFn: () => fetchSeriesIndex(chain),
      enabled: enabled && !!chain,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
    })),
  });

  const series = queries.flatMap((query) => query.data ?? []);
  const isLoading = queries.some((query) => query.isFetching);
  const error = (queries.find((query) => query.error)?.error ?? null) as Error | null;

  return {
    series,
    isLoading,
    error,
    refetchAll: () => Promise.all(queries.map((query) => query.refetch())),
  };
};
