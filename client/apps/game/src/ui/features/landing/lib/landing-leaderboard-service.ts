import { sqlApi } from "@/services/api";
import type { PlayerLeaderboardRow } from "@bibliothecadao/torii";

const DEFAULT_LIMIT = 20;
const REGISTERED_POINTS_PRECISION = 1_000_000;

export interface PlayerLeaderboardData {
  rank: number;
  address: string;
  displayName: string | null;
  /** Registered + unregistered points combined */
  points: number;
  /** Raw registered portion if available from the backend */
  registeredPoints?: number;
  /** Unregistered (shareholder) contribution if available */
  unregisteredPoints?: number;
  prizeClaimed: boolean;
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
  hyperstructuresHeld?: number;
  hyperstructuresHeldPoints?: number;
}

export type LandingLeaderboardEntry = PlayerLeaderboardData;

type NumericLike = string | number | bigint | null | undefined;

const parseNumeric = (value: NumericLike): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return 0;
    }

    try {
      if (/^0x[0-9a-f]+$/i.test(trimmed)) {
        return Number(BigInt(trimmed));
      }

      const asNumber = Number(trimmed);
      return Number.isFinite(asNumber) ? asNumber : 0;
    } catch {
      return 0;
    }
  }

  return 0;
};

const normaliseAddress = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
};

const pickStatValue = (row: Record<string, unknown>, ...keys: string[]): number | undefined => {
  for (const key of keys) {
    if (!key || !Object.prototype.hasOwnProperty.call(row, key)) {
      continue;
    }

    const rawValue = row[key] as NumericLike;
    if (rawValue === null || rawValue === undefined) {
      return undefined;
    }

    return parseNumeric(rawValue);
  }

  return undefined;
};

const decodePlayerName = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }

  if (!trimmed.startsWith("0x")) {
    return trimmed;
  }

  try {
    const hex = trimmed.slice(2);
    if (hex.length % 2 !== 0) {
      return trimmed;
    }

    let output = "";
    for (let index = 0; index < hex.length; index += 2) {
      const chunk = hex.slice(index, index + 2);
      const charCode = parseInt(chunk, 16);

      if (Number.isInteger(charCode) && charCode > 0 && charCode < 127) {
        output += String.fromCharCode(charCode);
      }
    }

    return output.length ? output : trimmed;
  } catch (error) {
    console.warn("Failed to decode player name", error);
    return trimmed;
  }
};

const transformLandingLeaderboardRow = (row: PlayerLeaderboardRow, rank: number): PlayerLeaderboardData | null => {
  const address = normaliseAddress(row.playerAddress ?? null);
  if (!address) {
    return null;
  }

  const displayName = decodePlayerName(row.playerName ?? null);

  const totalRaw = parseNumeric(row.registeredPoints);
  const registeredRaw = Math.min(parseNumeric(row.registeredPointsRegistered), totalRaw);
  const registeredPoints = registeredRaw / REGISTERED_POINTS_PRECISION;
  const totalPoints = totalRaw / REGISTERED_POINTS_PRECISION;
  const unregisteredPoints = row.unregisteredPoints ?? Math.max(totalPoints - registeredPoints, 0);
  const prizeClaimedRaw = Boolean(row.prizeClaimed);

  const dynamicRow = row as unknown as Record<string, unknown>;
  const exploredTiles = row.tilesExplored ?? pickStatValue(dynamicRow, "explored_tiles", "exploredTiles");
  const exploredTilePoints = pickStatValue(dynamicRow, "explored_tiles_points", "exploredTilePoints");
  const riftsTaken = pickStatValue(dynamicRow, "rifts_taken", "riftsTaken", "riftsCaptured");
  const riftPoints = pickStatValue(dynamicRow, "rifts_points", "riftPoints");
  const hyperstructuresConquered = pickStatValue(
    dynamicRow,
    "hyperstructures_conquered",
    "hyperstructuresConquered",
    "hyperstructuresClaimed",
  );
  const hyperstructurePoints = pickStatValue(dynamicRow, "hyperstructures_points", "hyperstructurePoints");
  const relicCratesOpened = pickStatValue(dynamicRow, "relic_crates_opened", "relicCratesOpened");
  const relicCratePoints = pickStatValue(dynamicRow, "relic_crates_points", "relicCratePoints");
  const campsTaken = pickStatValue(dynamicRow, "camps_taken", "campsCaptured", "campsTaken");
  const campPoints = pickStatValue(dynamicRow, "camps_points", "campPoints");
  const hyperstructuresHeld = pickStatValue(dynamicRow, "hyperstructures_held", "hyperstructuresHeld");
  const hyperstructuresHeldPoints = pickStatValue(
    dynamicRow,
    "hyperstructures_held_points",
    "hyperstructuresHeldPoints",
  );

  return {
    rank,
    address,
    displayName: displayName && displayName.length ? displayName : null,
    points: totalPoints,
    registeredPoints,
    unregisteredPoints,
    prizeClaimed: prizeClaimedRaw,
    exploredTiles,
    exploredTilePoints,
    riftsTaken,
    riftPoints,
    hyperstructuresConquered,
    hyperstructurePoints,
    relicCratesOpened,
    relicCratePoints,
    campsTaken,
    campPoints,
    hyperstructuresHeld,
    hyperstructuresHeldPoints,
  } satisfies PlayerLeaderboardData;
};

export const fetchLandingLeaderboard = async (
  limit: number = DEFAULT_LIMIT,
  offset: number = 0,
): Promise<PlayerLeaderboardData[]> => {
  const safeLimit = Math.max(0, limit);
  const safeOffset = Math.max(0, offset);

  if (safeLimit === 0) {
    return [];
  }

  const rows = await sqlApi.fetchPlayerLeaderboard(safeLimit, safeOffset);
  const entries: PlayerLeaderboardData[] = [];

  rows.forEach((rawRow, index) => {
    const entry = transformLandingLeaderboardRow(rawRow, safeOffset + index + 1);
    if (entry) {
      entries.push(entry);
    }
  });

  return entries.sort((a, b) => b.points - a.points).map((entry, index) => ({ ...entry, rank: index + 1 }));
};

export const fetchLandingLeaderboardEntryByAddress = async (
  playerAddress: string,
): Promise<PlayerLeaderboardData | null> => {
  const normalizedAddress = normaliseAddress(playerAddress);
  if (!normalizedAddress) {
    return null;
  }

  const rawRow = await sqlApi.fetchPlayerLeaderboardByAddress(normalizedAddress);

  if (!rawRow) {
    return null;
  }

  const rank = typeof rawRow.rank === "number" && rawRow.rank > 0 ? Math.floor(rawRow.rank) : 1;

  return transformLandingLeaderboardRow(rawRow, rank);
};
