import { sqlApi } from "@/services/api";
import type { PlayerActivityBreakdown } from "@bibliothecadao/torii";

export interface PlayerLeaderboardActivityEntry {
  address: string;
  activityBreakdown: PlayerActivityBreakdown;
  // The breakdown's own total (registered + live shareholder points) and the
  // server-side rank over it. The POINTS/RANK columns display these so one
  // source feeds the whole leaderboard row (owner ruling: points are the sum
  // of the breakdown columns).
  totalPoints: number;
  rank: number | null;
}

export const fetchLeaderboardActivityBreakdowns = async (limit: number): Promise<PlayerLeaderboardActivityEntry[]> => {
  const safeLimit = Math.max(0, limit);
  if (safeLimit === 0) return [];

  const rows = await sqlApi.fetchPlayerLeaderboard(safeLimit, 0);
  return rows.flatMap((row) => {
    const address = row.playerAddress?.trim();
    return address
      ? [{ address, activityBreakdown: row.activityBreakdown, totalPoints: row.totalPoints, rank: row.rank ?? null }]
      : [];
  });
};
