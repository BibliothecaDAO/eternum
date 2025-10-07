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

  return rows
    .map((rawRow, index) => {
      const row = rawRow as Record<string, unknown>;

      const rawAddress =
        (typeof row["player_address"] === "string" ? (row["player_address"] as string) : undefined) ??
        (typeof row["playerAddress"] === "string" ? (row["playerAddress"] as string) : undefined) ??
        null;

      const address = normaliseAddress(rawAddress);
      if (!address) {
        return null;
      }

      const rawName =
        (typeof row["player_name"] === "string" ? (row["player_name"] as string) : undefined) ??
        (typeof row["playerName"] === "string" ? (row["playerName"] as string) : undefined) ??
        null;

      const displayName = decodePlayerName(rawName);

      const baseRegistered = parseNumeric(
        (row["registered_points"] as NumericLike) ??
          (row["registeredPointsRegistered"] as NumericLike) ??
          (row["registeredPointsBase"] as NumericLike) ??
          0,
      );

      const totalPointsCandidate = parseNumeric(
        (row["registeredPoints"] as NumericLike) ??
          (row["total_points"] as NumericLike) ??
          (row["points"] as NumericLike) ??
          (row["registered_points"] as NumericLike) ??
          0,
      );

      let totalRaw = totalPointsCandidate;
      let registeredRaw = baseRegistered;

      if (totalRaw <= 0 && registeredRaw > 0) {
        totalRaw = registeredRaw;
      }

      const hasExplicitRegisteredField =
        Object.prototype.hasOwnProperty.call(row, "registered_points") ||
        Object.prototype.hasOwnProperty.call(row, "registeredPointsRegistered") ||
        Object.prototype.hasOwnProperty.call(row, "registeredPointsBase");

      if (registeredRaw <= 0) {
        registeredRaw = hasExplicitRegisteredField ? 0 : totalRaw;
      }

      if (totalRaw <= 0) {
        totalRaw = registeredRaw;
      }

      if (registeredRaw > totalRaw) {
        registeredRaw = totalRaw;
      }

      let unregisteredRaw = totalRaw - registeredRaw;
      if (unregisteredRaw < 0) {
        unregisteredRaw = 0;
      }

      const registeredPoints = registeredRaw / REGISTERED_POINTS_PRECISION;
      const totalPoints = totalRaw / REGISTERED_POINTS_PRECISION;
      const unregisteredPoints = unregisteredRaw / REGISTERED_POINTS_PRECISION;

      const prizeClaimedRaw =
        typeof row["prizeClaimed"] === "boolean"
          ? (row["prizeClaimed"] as boolean)
          : Boolean(parseNumeric(row["prize_claimed"] as NumericLike));

      return {
        rank: safeOffset + index + 1,
        address,
        displayName: displayName && displayName.length ? displayName : null,
        points: totalPoints,
        registeredPoints,
        unregisteredPoints,
        prizeClaimed: prizeClaimedRaw,
      } satisfies PlayerLeaderboardData;
    })
    .filter((entry): entry is PlayerLeaderboardData => entry !== null)
    .sort((a, b) => b.points - a.points)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
};
