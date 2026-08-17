import { sqlApi } from "@/services/api";
import type { PlayerActivityBreakdown } from "@bibliothecadao/torii";

export interface PlayerLeaderboardActivityEntry {
  address: string;
  activityBreakdown: PlayerActivityBreakdown;
}

export const fetchLeaderboardActivityBreakdowns = async (limit: number): Promise<PlayerLeaderboardActivityEntry[]> => {
  const safeLimit = Math.max(0, limit);
  if (safeLimit === 0) return [];

  const rows = await sqlApi.fetchPlayerLeaderboard(safeLimit, 0);
  return rows.flatMap((row) => {
    const address = row.playerAddress?.trim();
    return address ? [{ address, activityBreakdown: row.activityBreakdown }] : [];
  });
};
