import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { configManager } from "@bibliothecadao/eternum";
import { requireShard } from "@bibliothecadao/eternum/game-client";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useLatest } from "@/hooks/use-latest";
import { getActiveGame } from "@/runtime/world";
import { fetchLeaderboardActivityBreakdowns } from "@/services/leaderboard/player-activity-breakdown-service";

/**
 * The points breakdown by activity, read from Herald's history for the panel that shows it: fetched when that panel
 * opens, and again at the first confirmed head after a player's points change while it stays open, a failed read too. Standings
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
  useRefetchAfterPointsChange(query.refetch);
  return query;
}

// Herald commits a head's history before it publishes the head, so a points change is read at the next confirmed one.
// The head is followed in the store, not rendered: it comes about once a second, and the panel shows nothing of it.
function useRefetchAfterPointsChange(refetch: () => Promise<unknown>) {
  const pointsRevision = useNativeRevision(["PlayerPoints"]);
  const latest = useLatest({ pointsRevision, refetch });
  const fetchedAtRevision = useRef(pointsRevision);
  useEffect(
    () =>
      useConnectionStore.subscribe((state, previous) => {
        if (state.lastConfirmedBlock === previous.lastConfirmedBlock) return;
        const { pointsRevision, refetch } = latest.current;
        if (pointsRevision === fetchedAtRevision.current) return;
        fetchedAtRevision.current = pointsRevision;
        void refetch();
      }),
    [latest],
  );
}
