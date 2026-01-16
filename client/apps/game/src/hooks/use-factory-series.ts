import { useQuery } from "@tanstack/react-query";
import type { Chain } from "@contracts";
import { getFactorySqlBaseUrl } from "@/runtime/world";
import { normalizeHex } from "@/runtime/world/normalize";
import {
  decodePaddedFeltAscii,
  extractGameNumberFromRow,
  extractNameFelt,
  fetchFactoryRows,
} from "./factory-sql";

const SERIES_BY_OWNER_QUERY = (ownerHex: string) =>
  `SELECT name FROM [wf-Series] WHERE owner = "${ownerHex}" LIMIT 50;`;
const SERIES_GAME_QUERY = (paddedName: string) =>
  `SELECT game_number FROM [wf-SeriesGame] WHERE name = "${paddedName}" ORDER BY game_number DESC LIMIT 1;`;

export interface FactorySeries {
  name: string;
  paddedName: string;
  lastGameNumber: bigint | null;
}

const fetchSeriesOwned = async (factorySqlBaseUrl: string, ownerHex: string): Promise<FactorySeries[]> => {
  const rows = await fetchFactoryRows(factorySqlBaseUrl, SERIES_BY_OWNER_QUERY(ownerHex));

  const seen = new Map<string, string>();
  for (const row of rows) {
    const nameFelt = extractNameFelt(row);
    if (!nameFelt) continue;
    const decoded = decodePaddedFeltAscii(nameFelt);
    if (!decoded || seen.has(nameFelt)) continue;
    seen.set(nameFelt, decoded);
  }

  const ordered = Array.from(seen.entries()).map(([paddedName, name]) => ({ paddedName, name }));

  const enriched = await Promise.all(
    ordered.map(async ({ paddedName, name }) => {
      let lastGameNumber: bigint | null = null;
      try {
        const history = await fetchFactoryRows(factorySqlBaseUrl, SERIES_GAME_QUERY(paddedName));
        if (history.length > 0) {
          lastGameNumber = extractGameNumberFromRow(history[0]);
        }
      } catch {
        // Failures fetching the latest game number should not block the series list.
      }
      return { name, paddedName, lastGameNumber };
    }),
  );

  return enriched;
};

export const useFactorySeries = (chain: Chain, ownerAddress: string | undefined | null) => {
  const normalizedOwner = ownerAddress ? normalizeHex(ownerAddress) : null;
  const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);

  return useQuery<FactorySeries[], Error>({
    queryKey: ["factorySeries", chain, normalizedOwner],
    queryFn: () => {
      if (!normalizedOwner || !factorySqlBaseUrl) return [];
      return fetchSeriesOwned(factorySqlBaseUrl, normalizedOwner);
    },
    enabled: !!normalizedOwner && !!factorySqlBaseUrl,
    staleTime: 60_000,
    retry: 1,
  });
};
