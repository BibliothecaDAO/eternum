import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { configManager } from "@bibliothecadao/eternum";
import { requireShard } from "@bibliothecadao/eternum/game-client";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { getActiveGame } from "@/runtime/world";
import { fetchLeaderboardActivityBreakdowns } from "@/services/leaderboard/player-activity-breakdown-service";

/**
 * The points breakdown by activity, read from Herald's history for the panel that shows it: fetched when that panel
 * opens, and again at the first confirmed head after a player's points change while it stays open. Standings
 * themselves come from the native store (useInGameLeaderboard); this is history, never a second copy of them.
 */
export function useLeaderboardActivity() {
  const shard = requireShard(getActiveGame()?.chainId);
  const gameId = configManager.getActiveGameId();
  const query = useQuery({
    queryKey: ["leaderboard-activity", shard.url, gameId],
    queryFn: () => fetchLeaderboardActivityBreakdowns(shard, gameId),
    enabled: gameId > 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useRefetchAfterPointsChange(query.refetch, query.isError);
  return query;
}

// Herald commits a head's history before it publishes the head, so a points change is read at the next confirmed one.
function useRefetchAfterPointsChange(refetch: () => Promise<unknown>, isError: boolean) {
  const pointsRevision = useNativeRevision(["PlayerPoints"]);
  const confirmedBlock = useConnectionStore((state) => state.lastConfirmedBlock);
  const fetchedAtRevision = useRef(pointsRevision);
  const lastConfirmedBlock = useRef(confirmedBlock);
  useEffect(() => {
    if (confirmedBlock === lastConfirmedBlock.current) return;
    lastConfirmedBlock.current = confirmedBlock;
    if (isError || pointsRevision === fetchedAtRevision.current) return; // after a failure, the panel owns retry
    fetchedAtRevision.current = pointsRevision;
    void refetch();
  }, [confirmedBlock, pointsRevision, isError, refetch]);
}
