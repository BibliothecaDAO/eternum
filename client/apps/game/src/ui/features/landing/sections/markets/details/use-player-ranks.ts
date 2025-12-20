import { SqlApi, buildApiUrl, fetchWithErrorHandling, formatAddressForQuery } from "@bibliothecadao/torii";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addAddressPadding } from "starknet";

const FORMATTED_WORLD_ID = "0x000000000000000000000000ffffffff";
export type PlayerRankEntry = {
  player: string;
  rank: number;
};

const normalizeAddress = (value: unknown): string | null => {
  try {
    const hex = typeof value === "string" ? value : `0x${BigInt(value as any).toString(16)}`;
    return addAddressPadding(hex);
  } catch {
    return null;
  }
};

export const usePlayerRanks = ({
  players,
  toriiBaseUrl,
}: {
  worldId?: bigint | string | null;
  players: string[];
  toriiBaseUrl?: string | null;
}) => {
  const [trialId, setTrialId] = useState<string | null>(null);
  const [ranks, setRanks] = useState<PlayerRankEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const normalizedPlayers = useMemo(
    () => players.map((addr) => normalizeAddress(addr)).filter((addr): addr is string => Boolean(addr)),
    [players],
  );

  const refetch = useCallback(() => setRefreshNonce((prev) => prev + 1), []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const client = new SqlApi(`${toriiBaseUrl}/sql`);
        const sqlBaseUrl = (client as any)?.baseUrl ?? `${toriiBaseUrl}/sql`;

        const finalQuery = `SELECT trial_id, world_id FROM "s1_eternum-PlayersRankFinal" WHERE world_id = '${FORMATTED_WORLD_ID}' LIMIT 1;`;
        const finalUrl = buildApiUrl(sqlBaseUrl, finalQuery);
        const finalRows = await fetchWithErrorHandling<{ trial_id: string; world_id: string }>(
          finalUrl,
          "Failed to fetch PlayersRankFinal",
        );
        const finalTrialId = finalRows[0]?.trial_id != null ? finalRows[0].trial_id : null;

        if (!cancelled) {
          setTrialId(finalTrialId);
        }

        if (!finalTrialId || normalizedPlayers.length === 0) {
          if (!cancelled) setRanks([]);
          return;
        }

        const formattedPlayers = normalizedPlayers.map((addr) => `'${formatAddressForQuery(addr)}'`).join(", ");
        const ranksQuery = `SELECT player, rank FROM "s1_eternum-PlayerRank" WHERE trial_id = '${finalTrialId.toString()}' AND player IN (${formattedPlayers});`;
        const ranksUrl = buildApiUrl(sqlBaseUrl, ranksQuery);
        const rankRows = await fetchWithErrorHandling<{ player: string; rank: string }>(
          ranksUrl,
          "Failed to fetch PlayerRank",
        );

        const parsedRanks = rankRows
          .map((row) => {
            const player = normalizeAddress(row.player);
            if (!player) return null;
            return {
              player,
              rank: Number(row.rank ?? 0),
            };
          })
          .filter((row): row is PlayerRankEntry => Boolean(row))
          .sort((a, b) => a.rank - b.rank);

        if (!cancelled) {
          setRanks(parsedRanks);
        }
      } catch (err) {
        console.error("[usePlayerRanks] Failed to fetch ranks", err);
        if (!cancelled) {
          setError("Failed to load ranking from Torii.");
          setRanks([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [normalizedPlayers, refreshNonce, toriiBaseUrl]);

  return {
    trialId,
    ranks,
    isLoading,
    error,
    refetch,
  };
};
