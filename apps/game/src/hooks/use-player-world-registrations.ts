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
import { fetchHeraldGameDirectory } from "@/runtime/world/herald-http";
import { getDefaultWorld, getWorldById, type WorldDeployment } from "@/runtime/world/world-directory";
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
      queryKey: [...PLAYER_WORLD_REGISTRATION_QUERY_KEY, deployment.id, playerAddress ?? "anonymous"],
      queryFn: () => fetchHeraldGameDirectory(deployment, playerAddress ?? undefined),
      enabled: Boolean(playerAddress) && hasQueryableGame(worlds, deployment),
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: 1,
    })),
  });

  const queryByDeployment = new Map(deployments.map((deployment, index) => [deployment.id, queries[index]]));
  const registrationsByWorldKey = new Map<string, PlayerWorldRegistration>();
  worlds.forEach((world) => {
    const deployment = resolveDeployment(world);
    const queryState = queryByDeployment.get(deployment.id);
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

const resolveDeployment = (world: Pick<WorldSummary, "worldId">): WorldDeployment =>
  getWorldById(world.worldId) ?? getDefaultWorld();

const collectDeployments = (worlds: readonly WorldSummary[]): WorldDeployment[] => {
  const deployments = new Map<string, WorldDeployment>();
  for (const world of worlds) {
    const deployment = resolveDeployment(world);
    deployments.set(deployment.id, deployment);
  }
  return [...deployments.values()];
};

const hasQueryableGame = (worlds: readonly WorldSummary[], deployment: WorldDeployment): boolean =>
  worlds.some(
    (world) =>
      resolveDeployment(world).id === deployment.id &&
      world.alive &&
      world.gameId != null &&
      (world.mode === "blitz" || world.mode === "eternum"),
  );

const registrationFromDirectory = (
  mode: WorldSummary["mode"],
  playerState: { registered: boolean; settled: boolean } | null | undefined,
): PlayerWorldRegistration => {
  if (!playerState) return { isPlayerRegistered: null, hasPlayerSettledRealm: null };
  return {
    isPlayerRegistered: mode === "blitz" ? playerState.registered : null,
    hasPlayerSettledRealm: mode === "eternum" ? playerState.settled : null,
  };
};
