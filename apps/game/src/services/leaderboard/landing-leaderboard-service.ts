import { createSqlApi, sqlApi } from "@/services/api";
import { SqlApi, type PlayerLeaderboardRow, type SqlGameScope } from "@bibliothecadao/torii";

const DEFAULT_LIMIT = 20;
const REGISTERED_POINTS_PRECISION = 1_000_000;

interface PlayerLeaderboardData {
  rank: number;
  address: string;
  displayName: string | null;
  /** Registered + unregistered points combined */
  points: number;
  /** Latest global MMR (integer value) when available */
  mmr?: number;
  /** Latest MMR tier label when available */
  mmrTier?: string;
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
  hyperstructuresHeld?: number | null;
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

  const activity = row.activityBreakdown;
  const exploredTiles = activity.exploration.count;
  const exploredTilePoints = activity.exploration.points;
  const relicCratesOpened = activity.openRelicChest.count;
  const relicCratePoints = activity.openRelicChest.points;
  const structureBattlesCount = activity.otherStructureBanditsDefeat.count;
  const structureBattlesPoints = activity.otherStructureBanditsDefeat.points;
  const hyperstructureBattlesCount = activity.hyperStructureBanditsDefeat.count;
  const hyperstructureBattlesPoints = activity.hyperStructureBanditsDefeat.points;
  const hyperstructureSharePoints = activity.hyperstructureShare.points;
  const hyperstructureShareCount = activity.hyperstructureShare.count;

  const riftsTaken = structureBattlesCount;
  const riftPoints = structureBattlesPoints;
  const campsTaken = structureBattlesCount;
  const campPoints = structureBattlesPoints;
  const hyperstructuresConquered = hyperstructureBattlesCount;
  const hyperstructurePoints = hyperstructureBattlesPoints;
  const hyperstructuresHeld = hyperstructureShareCount > 0 ? hyperstructureShareCount : null;
  const hyperstructuresHeldPoints = hyperstructureSharePoints;

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

const buildLeaderboardEntries = (rows: PlayerLeaderboardRow[], safeOffset: number): PlayerLeaderboardData[] => {
  const entries: PlayerLeaderboardData[] = [];

  rows.forEach((rawRow, index) => {
    const entry = transformLandingLeaderboardRow(rawRow, safeOffset + index + 1);
    if (entry) {
      entries.push(entry);
    }
  });

  return entries.toSorted((a, b) => b.points - a.points).map((entry, index) => ({ ...entry, rank: index + 1 }));
};

const fetchLeaderboardWithClient = async (
  client: SqlApi,
  limit: number = DEFAULT_LIMIT,
  offset: number = 0,
): Promise<PlayerLeaderboardData[]> => {
  const safeLimit = Math.max(0, limit);
  const safeOffset = Math.max(0, offset);

  if (safeLimit === 0) {
    return [];
  }

  const rows = await client.fetchPlayerLeaderboard(safeLimit, safeOffset);
  return buildLeaderboardEntries(rows, safeOffset);
};

export const fetchLandingLeaderboard = async (
  limit: number = DEFAULT_LIMIT,
  offset: number = 0,
  toriiBaseUrl?: string,
  scope?: SqlGameScope,
): Promise<PlayerLeaderboardData[]> => {
  const client = toriiBaseUrl ? createSqlApi(toriiBaseUrl, scope) : sqlApi;
  return fetchLeaderboardWithClient(client, limit, offset);
};

export const fetchLandingLeaderboardEntryByAddress = async (
  playerAddress: string,
  toriiBaseUrl?: string,
  scope?: SqlGameScope,
): Promise<PlayerLeaderboardData | null> => {
  const normalizedAddress = normaliseAddress(playerAddress);
  if (!normalizedAddress) {
    return null;
  }

  const client = toriiBaseUrl ? createSqlApi(toriiBaseUrl, scope) : sqlApi;
  const rawRow = await client.fetchPlayerLeaderboardByAddress(normalizedAddress);

  if (!rawRow) {
    return null;
  }

  const rank = typeof rawRow.rank === "number" && rawRow.rank > 0 ? Math.floor(rawRow.rank) : 1;

  return transformLandingLeaderboardRow(rawRow, rank);
};
