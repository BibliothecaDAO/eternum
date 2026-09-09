import { useEffect } from "react";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useLeaderboardActivity } from "@/hooks/use-leaderboard-activity";

export function LeaderboardActivitySync() {
  const { refetch } = useLeaderboardActivity();
  const confirmedBlock = useConnectionStore((state) => state.lastConfirmedBlock);
  const handshake = useConnectionStore((state) => state.lastGlobalHandshake);
  useEffect(() => {
    // Stories may arrive provisionally. Herald commits history before publishing this head.
    void refetch();
  }, [confirmedBlock, handshake, refetch]);
  return null;
}
