import { useQuery } from "@tanstack/react-query";
import { configManager } from "@bibliothecadao/eternum";
import { requireShard } from "@bibliothecadao/eternum/game-client";
import { getActiveGame } from "@/runtime/world";
import { fetchLeaderboardActivityBreakdowns } from "@/services/leaderboard/player-activity-breakdown-service";

/** Historical points aggregates are warmed on game entry and shared with every leaderboard surface. */
export function useLeaderboardActivity() {
  const shard = requireShard(getActiveGame()?.chainId);
  const gameId = configManager.getActiveGameId();
  return useQuery({
    queryKey: ["leaderboard-activity", shard.url, gameId],
    queryFn: () => fetchLeaderboardActivityBreakdowns(shard, gameId),
    enabled: gameId > 0,
    staleTime: Infinity,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
