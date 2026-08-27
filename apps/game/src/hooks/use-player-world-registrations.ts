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
import {
  buildPlayerBlitzSettlementStatusQuery,
  buildPlayerOwnedStructureCountQuery,
} from "@/services/blitz/blitz-settlement-sql";
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

/**
 * Eternum: whether the player owns at least one structure in this season —
 * the settled-realm signal for entry surfaces (dev/free settling per S3).
 */
const fetchPlayerSettledRealm = async (
  toriiBaseUrl: string,
  playerAddress: string,
  gameId: number,
): Promise<boolean | null> => {
  try {
    const query = buildPlayerOwnedStructureCountQuery(playerAddress, gameId);
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const [row] = (await response.json()) as Record<string, unknown>[];
    const count = Number(row?.owned_count ?? 0);
    return Number.isFinite(count) ? count > 0 : null;
  } catch {
    return null;
  }
};

// Landing identity is (worldId, gameId): two same-named games in different
// worlds must never collide on React keys or query caches. chain:name remains
// only as a fallback for rows that predate the id fields.
export const getWorldSummaryKey = (world: Pick<WorldSummary, "name" | "chain" | "worldId" | "gameId">): string =>
  world.worldId && world.gameId ? `${world.worldId}:${world.gameId}` : `${world.chain}:${world.name}`;

interface UsePlayerWorldRegistrationsInput {
  worlds: WorldSummary[];
  playerAddress: string | null;
}

/**
 * For a connected player, fetch per-game registration status for every live
 * game in parallel. Skipped entirely when there is no connected player.
 * Blitz games check the settlement row; eternum seasons check owned
 * structures in the season (W5).
 */
export const usePlayerWorldRegistrations = ({
  worlds,
  playerAddress,
}: UsePlayerWorldRegistrationsInput): PlayerWorldRegistrationResult => {
  const queries = useQueries({
    queries: worlds.map((world) => {
      const worldKey = getWorldSummaryKey(world);
      const isBlitz = world.mode === "blitz";
      const isEternum = world.mode === "eternum";
      const gameId = world.gameId ?? 0;
      return {
        queryKey: [...PLAYER_WORLD_REGISTRATION_QUERY_KEY, worldKey, playerAddress ?? "anonymous"],
        queryFn: async (): Promise<PlayerWorldRegistration> => {
          if (!playerAddress || gameId <= 0) {
            return { isPlayerRegistered: null, hasPlayerSettledRealm: null };
          }
          const deployment = getWorldById(world.worldId) ?? getDefaultWorld();
          if (isBlitz) {
            const isRegistered = await fetchPlayerRegistration(deployment.toriiBaseUrl, playerAddress, gameId);
            // A failed check must not clobber the last known registration.
            if (isRegistered === null) throw new Error("registration check unavailable");
            return { isPlayerRegistered: isRegistered, hasPlayerSettledRealm: null };
          }
          const hasSettled = await fetchPlayerSettledRealm(deployment.toriiBaseUrl, playerAddress, gameId);
          if (hasSettled === null) throw new Error("settled-realm check unavailable");
          return { isPlayerRegistered: null, hasPlayerSettledRealm: hasSettled };
        },
        enabled: Boolean(playerAddress) && world.alive && (isBlitz || isEternum) && gameId > 0,
        staleTime: 30_000,
        gcTime: 10 * 60_000,
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
