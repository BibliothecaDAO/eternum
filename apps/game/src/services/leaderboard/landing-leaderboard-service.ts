import { normalizeStarknetAddress } from "@realms-world/identity";
import type { HeraldLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";

interface LandingLeaderboardEntry {
  rank: number;
  address: string;
  points: number;
  exploredTiles?: number;
  exploredTilePoints?: number;
  riftsTaken?: number;
  riftPoints?: number;
  hyperstructuresConquered?: number;
  hyperstructurePoints?: number;
  relicCratesOpened?: number;
  relicCratePoints?: number;
  campsTaken?: number;
  campPoints?: number;
  hyperstructuresHeld?: number | null;
  hyperstructuresHeldPoints?: number;
}

export const buildLandingLeaderboard = (
  activityEntries: readonly HeraldLeaderboardEntry[],
): LandingLeaderboardEntry[] =>
  activityEntries.map((entry) => {
    const address = normalizeStarknetAddress(entry.address);
    const activity = entry.activityBreakdown;
    return {
      rank: entry.rank,
      address,
      points: entry.totalPoints,
      exploredTiles: activity.exploration.count,
      exploredTilePoints: activity.exploration.points,
      riftsTaken: activity.otherStructureBanditsDefeat.count,
      riftPoints: activity.otherStructureBanditsDefeat.points,
      hyperstructuresConquered: activity.hyperStructureBanditsDefeat.count,
      hyperstructurePoints: activity.hyperStructureBanditsDefeat.points,
      relicCratesOpened: activity.openRelicChest.count,
      relicCratePoints: activity.openRelicChest.points,
      campsTaken: activity.otherStructureBanditsDefeat.count,
      campPoints: activity.otherStructureBanditsDefeat.points,
      hyperstructuresHeld: null,
      hyperstructuresHeldPoints: activity.hyperstructureShare.points,
    };
  });
