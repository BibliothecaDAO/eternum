/**
 * Player-scoped game entry lookups, layered on top of the bulk
 * `WorldSummary` payload.
 *
 * The summary intentionally does not include player-specific data (blitz
 * settlement, eternum realm ownership). This hook fires one SQL query per
 * game — but only when a wallet is connected — so the anonymous boot path
 * produces zero of these requests. Queries target the summary row's
 * `(worldId, gameId)` pair explicitly.
 */
import type { WorldSummary } from "@bibliothecadao/types";
import { buildPlayerBlitzSettlementStatusQuery } from "@/services/blitz/blitz-settlement-sql";
import { getDefaultWorld, getWorldById } from "@/runtime/world/world-directory";
import { PLAYER_WORLD_REGISTRATION_QUERY_KEY } from "@/hooks/world-list-queries";
import { useQueries } from "@tanstack/react-query";

interface PlayerWorldRegistration {
  isPlayerRegistered: boolean | null;
  hasPlayerSettledRealm: boolean | null;
}

interface PlayerWorldRegistrationResult {
  registrationsByWorldKey: Map<string, PlayerWorldRegistration>;
  isAnyLoading: boolean;
}

/**
 * Blitz-only: check whether the player already has a settlement row for this game.
 */
export const fetchPlayerRegistration = async (
  toriiBaseUrl: string,
  playerAddress: string,
  gameId: number,
): Promise<boolean | null> => {
  try {
    const query = buildPlayerBlitzSettlementStatusQuery(playerAddress, gameId);
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>[];
    return data.length > 0;
  } catch {
    return null;
  }
};

export const getWorldSummaryKey = (world: Pick<WorldSummary, "name" | "chain">): string =>
  `${world.chain}:${world.name}`;

interface UsePlayerWorldRegistrationsInput {
  worlds: WorldSummary[];
  playerAddress: string | null;
}

/**
 * For a connected player, fetch per-game registration status for every live
 * game in parallel. Skipped entirely when there is no connected player.
 * Eternum seasons get their settled-realm check when the eternum world lands
 * (W5) — until then that field stays null.
 */
export const usePlayerWorldRegistrations = ({
  worlds,
  playerAddress,
}: UsePlayerWorldRegistrationsInput): PlayerWorldRegistrationResult => {
  const queries = useQueries({
    queries: worlds.map((world) => {
      const worldKey = getWorldSummaryKey(world);
      const isBlitz = world.mode === "blitz";
      const gameId = world.gameId ?? 0;
      return {
        queryKey: [...PLAYER_WORLD_REGISTRATION_QUERY_KEY, worldKey, playerAddress ?? "anonymous"],
        queryFn: async (): Promise<PlayerWorldRegistration> => {
          if (!playerAddress || !isBlitz || gameId <= 0) {
            return { isPlayerRegistered: null, hasPlayerSettledRealm: null };
          }
          const deployment = getWorldById(world.worldId) ?? getDefaultWorld();
          const isRegistered = await fetchPlayerRegistration(deployment.toriiBaseUrl, playerAddress, gameId);
          return { isPlayerRegistered: isRegistered, hasPlayerSettledRealm: null };
        },
        enabled: Boolean(playerAddress) && world.alive && isBlitz && gameId > 0,
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchInterval: 30_000,
        refetchIntervalInBackground: false,
        retry: 1,
      };
    }),
  });

  const registrationsByWorldKey = new Map<string, PlayerWorldRegistration>();
  worlds.forEach((world, index) => {
    const queryState = queries[index];
    const worldKey = getWorldSummaryKey(world);
    registrationsByWorldKey.set(
      worldKey,
      queryState?.data ?? { isPlayerRegistered: null, hasPlayerSettledRealm: null },
    );
  });

  const isAnyLoading = queries.some((q) => q.isLoading || (q.data === undefined && q.error == null && q.isFetching));

  return {
    registrationsByWorldKey,
    isAnyLoading,
  };
};
