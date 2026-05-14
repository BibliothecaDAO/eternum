/**
 * Player-scoped world entry lookups, layered on top of the bulk
 * `WorldSummary` payload.
 *
 * The summary endpoint intentionally does not include player-specific data
 * (blitz settlement, eternum realm ownership). This hook fires one SQL query per world — but
 * only when a wallet is connected — so the anonymous boot path produces
 * zero of these requests.
 *
 * Query logic mirrors `fetchPlayerRegistration` / `fetchPlayerHasSettledRealm`
 * in `use-world-availability.ts`.
 */
import type { WorldSummary } from "@bibliothecadao/types";
import { buildPlayerBlitzSettlementStatusQuery } from "@/services/blitz/blitz-settlement-sql";
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

const buildToriiBaseUrl = (worldName: string) => `https://api.cartridge.gg/x/${worldName}/torii`;

const parseMaybeHexToNumber = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    try {
      if (v.startsWith("0x") || v.startsWith("0X")) return Number(BigInt(v));
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Blitz-only: check whether the player already has a settlement entry for this world.
 */
export const fetchPlayerRegistration = async (toriiBaseUrl: string, playerAddress: string): Promise<boolean | null> => {
  try {
    const query = buildPlayerBlitzSettlementStatusQuery(playerAddress);
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
 * Eternum-only: has the player settled at least one realm on this world?
 * Ported from `use-world-availability.ts`.
 */
export const fetchPlayerHasSettledRealm = async (
  toriiBaseUrl: string,
  playerAddress: string,
): Promise<boolean | null> => {
  try {
    const query = `SELECT COUNT(*) AS realm_count FROM "s1_eternum-Structure" WHERE owner = "${playerAddress}" AND category = 1 LIMIT 1;`;
    const url = `${toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>[];
    const [row] = data;
    const realmCount = parseMaybeHexToNumber(row?.realm_count);
    if (realmCount == null) return null;
    return realmCount > 0;
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
 * For a connected player, fetch per-world registration/settlement status for
 * every live world in parallel. Each query is mode-aware and skipped entirely
 * when there is no connected player (so the anonymous boot does zero fetches).
 */
export const usePlayerWorldRegistrations = ({
  worlds,
  playerAddress,
}: UsePlayerWorldRegistrationsInput): PlayerWorldRegistrationResult => {
  const queries = useQueries({
    queries: worlds.map((world) => {
      const worldKey = getWorldSummaryKey(world);
      const mode = world.mode;
      const isBlitz = mode === "blitz";
      const isEternum = mode === "eternum";
      return {
        queryKey: [...PLAYER_WORLD_REGISTRATION_QUERY_KEY, worldKey, playerAddress ?? "anonymous"],
        queryFn: async (): Promise<PlayerWorldRegistration> => {
          if (!playerAddress) {
            return { isPlayerRegistered: null, hasPlayerSettledRealm: null };
          }
          const toriiBaseUrl = buildToriiBaseUrl(world.name);
          if (isBlitz) {
            const isRegistered = await fetchPlayerRegistration(toriiBaseUrl, playerAddress);
            return { isPlayerRegistered: isRegistered, hasPlayerSettledRealm: null };
          }
          if (isEternum) {
            const hasSettled = await fetchPlayerHasSettledRealm(toriiBaseUrl, playerAddress);
            return { isPlayerRegistered: null, hasPlayerSettledRealm: hasSettled };
          }
          return { isPlayerRegistered: null, hasPlayerSettledRealm: null };
        },
        enabled: Boolean(playerAddress) && world.alive && (isBlitz || isEternum),
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
