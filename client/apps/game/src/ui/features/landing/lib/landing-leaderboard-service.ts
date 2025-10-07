import { sqlApi } from "@/services/api";

const DEFAULT_LIMIT = 20;

export interface PlayerLeaderboardData {
  rank: number;
  address: string;
  displayName: string | null;
  points: number;
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
    .map((row, index) => {
      const address = normaliseAddress(row.player_address);
      if (!address) {
        return null;
      }

      const points = parseNumeric(row.registered_points);
      const displayName = decodePlayerName(row.player_name);
      const prizeClaimed = Boolean(parseNumeric(row.prize_claimed));

      return {
        rank: safeOffset + index + 1,
        address,
        displayName: displayName && displayName.length ? displayName : null,
        points,
        prizeClaimed,
      } satisfies PlayerLeaderboardData;
    })
    .filter((entry): entry is PlayerLeaderboardData => entry !== null)
    .sort((a, b) => b.points - a.points)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
};
