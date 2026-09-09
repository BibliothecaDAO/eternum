import { useEffect } from "react";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useLeaderboardActivity } from "@/hooks/use-leaderboard-activity";

export function LeaderboardActivitySync() {
  const { refetch, isError } = useLeaderboardActivity();
  const confirmedBlock = useConnectionStore((state) => state.lastConfirmedBlock);
  const handshake = useConnectionStore((state) => state.lastGlobalHandshake);
  useEffect(() => {
    if (isError) return; // The panel owns retry after a failed request.
    // Stories may arrive provisionally. Herald commits history before publishing this head.
    void refetch({ cancelRefetch: false });
  }, [confirmedBlock, handshake, refetch, isError]);
  return null;
}
