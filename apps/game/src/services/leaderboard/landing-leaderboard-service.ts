import type { WorldDeployment } from "@/runtime/world/world-directory";
import { fetchHeraldGameLeaderboard, fetchHeraldGameSnapshot } from "@bibliothecadao/eternum/game-client";
import {
  calculateUnregisteredShareholderPoints,
  type HeraldGameSnapshot,
  createEmptyActivityBreakdown,
  type PlayerLeaderboardActivityEntry,
} from "@bibliothecadao/eternum/game-sync";

const DEFAULT_LIMIT = 20;
const REGISTERED_POINTS_PRECISION = 1_000_000;

export interface LandingLeaderboardEntry {
  rank: number;
  address: string;
  displayName: string | null;
  points: number;
  mmr?: number;
  mmrTier?: string;
  registeredPoints?: number;
  unregisteredPoints?: number;
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
  const activities = new Map(activityEntries.map((entry) => [entry.address, entry.activityBreakdown]));
  const unregisteredPoints = calculateUnregisteredShareholderPoints(
    {
      gameRegistry: rows(snapshot, "GameRegistry"),
      hyperstructures: rows(snapshot, "Hyperstructure"),
      presets: rows(snapshot, "PresetConfig"),
      shareholders: rows(snapshot, "HyperstructureShareholders"),
    },
    snapshot.game_id,
  );
  return rows(snapshot, "PlayerRegisteredPoints")
    .flatMap((row) => {
      const address = normalizeLeaderboardAddress(row.address);
      if (!address) return [];
      const registeredPoints = Number(toBigInt(row.registered_points) ?? 0n) / REGISTERED_POINTS_PRECISION;
      const livePoints = unregisteredPoints.get(address) ?? 0;
      const activity = activities.get(address) ?? createEmptyActivityBreakdown();
      return [
        {
          rank: 0,
          address,
          displayName: names.get(address) ?? null,
          points: registeredPoints + livePoints,
          registeredPoints,
          unregisteredPoints: livePoints,
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
        },
      ];
    })
    .toSorted((left, right) => right.points - left.points || left.address.localeCompare(right.address))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
};

const fetchLeaderboardSource = async (world: WorldDeployment, gameId: number) => {
  const [snapshot, leaderboard] = await Promise.all([
    fetchHeraldGameSnapshot(world, gameId, [
      "PlayerRegisteredPoints",
      "AddressName",
      "Hyperstructure",
      "HyperstructureShareholders",
      "GameRegistry",
      "PresetConfig",
    ]),
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
