import type { Shard } from "@bibliothecadao/eternum/game-client";
import { fetchHeraldGameLeaderboard } from "@bibliothecadao/eternum/game-client";
import type { HeraldLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";

const DEFAULT_LIMIT = 20;

export interface LandingLeaderboardEntry {
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

const toBigInt = (value: unknown): bigint | null => {
  if (!["string", "number", "bigint"].includes(typeof value)) return null;
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    return null;
  }
};

export const normalizeLeaderboardAddress = (value: unknown): string | null => {
  const parsed = toBigInt(value);
  return parsed === null || parsed <= 0n ? null : `0x${parsed.toString(16)}`;
};

export const buildLandingLeaderboard = (
  activityEntries: readonly HeraldLeaderboardEntry[],
): LandingLeaderboardEntry[] =>
  activityEntries.map((entry) => {
    const address = normalizeLeaderboardAddress(entry.address);
    if (!address) throw new Error(`Invalid leaderboard address ${entry.address}`);
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

const fetchLeaderboardSource = async (world: Shard, gameId: number) =>
  buildLandingLeaderboard((await fetchHeraldGameLeaderboard(world, gameId)).entries);
