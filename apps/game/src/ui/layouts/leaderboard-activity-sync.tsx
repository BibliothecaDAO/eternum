import { useEffect } from "react";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useLatestPointsEventId } from "@/hooks/store/use-story-events-store";
import { useLeaderboardActivity } from "@/hooks/use-leaderboard-activity";

export function LeaderboardActivitySync() {
  const { refetch } = useLeaderboardActivity();
  const pointsEventId = useLatestPointsEventId();
  const handshake = useConnectionStore((state) => state.lastGlobalHandshake);
  useEffect(() => {
    void refetch();
  }, [pointsEventId, handshake, refetch]);
  return null;
}
