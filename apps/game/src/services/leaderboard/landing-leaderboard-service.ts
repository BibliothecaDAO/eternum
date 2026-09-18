import type { WorldDeployment } from "@/runtime/world/world-directory";
import { fetchHeraldGameLeaderboard, fetchHeraldGameSnapshot } from "@bibliothecadao/eternum/game-client";
import { type HeraldGameSnapshot, type PlayerLeaderboardActivityEntry } from "@bibliothecadao/eternum/game-sync";

const DEFAULT_LIMIT = 20;

export interface LandingLeaderboardEntry {
  rank: number;
  address: string;
  displayName: string | null;
  points: number;
  mmr?: number;
  mmrTier?: string;
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

const rows = (snapshot: HeraldGameSnapshot, model: string): Record<string, unknown>[] =>
  snapshot.models.find((entry) => entry.model === model)?.rows.map((row) => row.value) ?? [];

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

const decodePlayerName = (value: unknown): string | null => {
  if (typeof value === "string" && !value.startsWith("0x")) return value.trim() || null;
  const parsed = toBigInt(value);
  if (parsed === null || parsed === 0n) return null;
  const raw = parsed.toString(16);
  const hex = raw.length % 2 === 0 ? raw : `0${raw}`;
  const decoded = String.fromCharCode(...(hex.match(/.{2}/g) ?? []).map((byte) => Number.parseInt(byte, 16)));
  return decoded.trim() || null;
};

export const buildLandingLeaderboard = (
  snapshot: HeraldGameSnapshot,
  activityEntries: readonly PlayerLeaderboardActivityEntry[],
): LandingLeaderboardEntry[] => {
  const names = new Map(
    rows(snapshot, "AddressName").flatMap((row) => {
      const address = normalizeLeaderboardAddress(row.address);
      return address ? [[address, decodePlayerName(row.name)] as const] : [];
    }),
  );
  return activityEntries.map((entry) => {
    const address = normalizeLeaderboardAddress(entry.address);
    if (!address) throw new Error(`Invalid leaderboard address ${entry.address}`);
    const activity = entry.activityBreakdown;
    return {
      rank: entry.rank,
      address,
      displayName: names.get(address) ?? null,
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
};

const fetchLeaderboardSource = async (world: WorldDeployment, gameId: number) => {
  const [snapshot, leaderboard] = await Promise.all([
    fetchHeraldGameSnapshot(world, gameId, ["AddressName"]),
    fetchHeraldGameLeaderboard(world, gameId),
  ]);
  return buildLandingLeaderboard(snapshot, leaderboard.entries);
};

export const fetchLandingLeaderboard = async (
  world: WorldDeployment,
  gameId: number,
  limit: number = DEFAULT_LIMIT,
  offset = 0,
): Promise<LandingLeaderboardEntry[]> => {
  if (limit <= 0) return [];
  return (await fetchLeaderboardSource(world, gameId)).slice(Math.max(0, offset), Math.max(0, offset) + limit);
};

export const fetchLandingLeaderboardEntryByAddress = async (
  world: WorldDeployment,
  gameId: number,
  playerAddress: string,
): Promise<LandingLeaderboardEntry | null> => {
  const address = normalizeLeaderboardAddress(playerAddress);
  if (!address) return null;
  return (await fetchLeaderboardSource(world, gameId)).find((entry) => entry.address === address) ?? null;
};
