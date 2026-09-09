import { useQuery } from "@tanstack/react-query";
import { configManager } from "@bibliothecadao/eternum";
import { getActiveWorld } from "@/runtime/world";
import { getDefaultWorld, getWorldById } from "@/runtime/world/world-directory";
import { fetchLeaderboardActivityBreakdowns } from "@/services/leaderboard/player-activity-breakdown-service";

/** Historical points aggregates are warmed on game entry and shared with every leaderboard surface. */
export function useLeaderboardActivity() {
  const profile = getActiveWorld();
  const world = getWorldById(profile?.worldId ?? "blitz") ?? getDefaultWorld();
  const gameId = configManager.getActiveGameId();
  return useQuery({
    queryKey: ["leaderboard-activity", world.heraldBaseUrl, world.chain, world.id, gameId],
    queryFn: () => fetchLeaderboardActivityBreakdowns(world, gameId),
    enabled: gameId > 0,
    staleTime: Infinity,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
