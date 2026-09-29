interface PlayerActivityStat {
  count: number;
  points: number;
}
export interface PlayerActivityBreakdown {
  exploration: PlayerActivityStat;
  openRelicChest: PlayerActivityStat;
  hyperStructureBanditsDefeat: PlayerActivityStat;
  otherStructureBanditsDefeat: PlayerActivityStat;
  hyperstructureShare: PlayerActivityStat;
}
export interface PlayerLeaderboardActivityEntry {
  address: string;
  activityBreakdown: PlayerActivityBreakdown;
  totalPoints: number;
  rank: number;
}

/** One points award by activity, as a history codec reads it from its chain's points event. */
export interface PointsRegistration {
  address: string;
  activity: keyof PlayerActivityBreakdown;
  points: number;
}

export const createEmptyActivityBreakdown = (): PlayerActivityBreakdown => ({
  exploration: { count: 0, points: 0 },
  openRelicChest: { count: 0, points: 0 },
  hyperStructureBanditsDefeat: { count: 0, points: 0 },
  otherStructureBanditsDefeat: { count: 0, points: 0 },
  hyperstructureShare: { count: 0, points: 0 },
});
