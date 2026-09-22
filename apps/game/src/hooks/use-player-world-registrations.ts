/**
 * Player-scoped game entry lookups, layered on top of the bulk
 * `WorldSummary` payload.
 *
 * The summary intentionally does not include player-specific data (blitz
 * settlement, eternum realm ownership). Herald joins those two facts into one
 * player-scoped directory response per deployed world, so the browser never
 * fans out one request per game.
 */
import type { WorldSummary } from "@bibliothecadao/types";
import { fetchHeraldGameDirectory, requireShard, type Shard } from "@bibliothecadao/eternum/game-client";
import { gameKey } from "@/runtime/world/store";
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

// Landing identity is (chainId, gameId): game ids repeat across shards, so neither alone keys a card or a cache.
export const getWorldSummaryKey = (world: Pick<WorldSummary, "chainId" | "gameId">): string => gameKey(world);

interface UsePlayerWorldRegistrationsInput {
  worlds: WorldSummary[];
  playerAddress: string | null;
}

/**
 * For a connected player, fetch one annotated directory per deployment.
 * Skipped entirely when there is no connected player.
 */
export const usePlayerWorldRegistrations = ({
  worlds,
  playerAddress,
}: UsePlayerWorldRegistrationsInput): PlayerWorldRegistrationResult => {
  const deployments = collectDeployments(worlds);
  const queries = useQueries({
    queries: deployments.map((deployment) => ({
      queryKey: [...PLAYER_WORLD_REGISTRATION_QUERY_KEY, deployment.chainId, playerAddress ?? "anonymous"],
      queryFn: () => fetchHeraldGameDirectory(deployment, playerAddress ?? undefined),
      enabled: Boolean(playerAddress) && hasQueryableGame(worlds, deployment),
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: 1,
    })),
  });

  const queryByDeployment = new Map(deployments.map((deployment, index) => [deployment.chainId, queries[index]]));
  const registrationsByWorldKey = new Map<string, PlayerWorldRegistration>();
  worlds.forEach((world) => {
    const queryState = queryByDeployment.get(world.chainId);
    const game = queryState?.data?.games.find((candidate) => candidate.game_id === world.gameId);
    const worldKey = getWorldSummaryKey(world);
    registrationsByWorldKey.set(worldKey, registrationFromDirectory(world.mode, game?.player_state));
  });

  const isAnyLoading = queries.some((q) => q.isLoading || (q.data === undefined && q.error == null && q.isFetching));

  return {
    registrationsByWorldKey,
    isAnyLoading,
  };
};

const collectDeployments = (worlds: readonly WorldSummary[]): Shard[] => [
  ...new Map(worlds.map((world) => [world.chainId, requireShard(world.chainId)])).values(),
];

const hasQueryableGame = (worlds: readonly WorldSummary[], deployment: Shard): boolean =>
  worlds.some(
    (world) =>
      world.chainId === deployment.chainId &&
      world.alive &&
      world.gameId != null &&
      (world.mode === "blitz" || world.mode === "eternum" || world.mode === "frontier"),
  );

const registrationFromDirectory = (
  mode: WorldSummary["mode"],
  playerState: { registered: boolean; settled: boolean } | null | undefined,
): PlayerWorldRegistration => {
  if (!playerState) return { isPlayerRegistered: null, hasPlayerSettledRealm: null };
  return {
    isPlayerRegistered: mode === "blitz" ? playerState.registered : null,
    hasPlayerSettledRealm: mode === "eternum" || mode === "frontier" ? playerState.settled : null,
  };
};
