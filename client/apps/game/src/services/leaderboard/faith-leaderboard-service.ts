import { buildApiUrl, fetchWithErrorHandling } from "@bibliothecadao/torii";

import { getSqlApiBaseUrl } from "@/services/api";

interface FaithLeaderboardRow {
  wonder_id?: unknown;
  last_recorded_owner?: unknown;
  claimed_points?: unknown;
  claim_per_sec?: unknown;
  num_structures_pledged?: unknown;
}

export interface FaithLeaderboardEntry {
  rank: number;
  wonderId: bigint;
  wonderName: string;
  ownerAddress: string;
  ownerName: string | null;
  totalFaithPoints: bigint;
  faithPointsPerSecond: number;
  followerCount: number;
}

const WONDER_FAITH_LEADERBOARD_QUERY = `
  SELECT
    wf.wonder_id,
    wf.last_recorded_owner,
    wf.claimed_points,
    wf.claim_per_sec,
    wf.num_structures_pledged
  FROM [s1_eternum-WonderFaith] wf
  WHERE wf.wonder_id > 0
  ORDER BY wf.claimed_points DESC, wf.claim_per_sec DESC, wf.wonder_id ASC;
`;

const ensureSqlSuffix = (baseUrl: string): string => (baseUrl.endsWith("/sql") ? baseUrl : `${baseUrl}/sql`);

const parseBigInt = (value: unknown): bigint | null => {
  if (typeof value === "bigint") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return BigInt(Math.floor(value));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.length) return null;

    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }

  return null;
};

const parseIntNumber = (value: unknown): number => {
  const parsed = parseBigInt(value);
  if (parsed == null || parsed < 0n) {
    return 0;
  }

  const asNumber = Number(parsed);
  if (!Number.isFinite(asNumber) || asNumber < 0) {
    return 0;
  }

  return Math.floor(asNumber);
};

const formatOwnerAddress = (value: unknown): string => {
  const parsed = parseBigInt(value);
  if (parsed == null) {
    return "0x0";
  }

  return `0x${parsed.toString(16).padStart(64, "0")}`;
};

const buildWonderName = (wonderId: bigint): string => `Wonder #${wonderId.toString()}`;

const transformFaithLeaderboardRows = (rows: FaithLeaderboardRow[]): FaithLeaderboardEntry[] => {
  const entries = rows
    .map((row) => {
      const wonderId = parseBigInt(row.wonder_id);
      if (wonderId == null || wonderId <= 0n) {
        return null;
      }

      const totalFaithPoints = parseBigInt(row.claimed_points) ?? 0n;
      const faithPointsPerSecond = parseIntNumber(row.claim_per_sec);
      const followerCount = parseIntNumber(row.num_structures_pledged);

      return {
        rank: 0,
        wonderId,
        wonderName: buildWonderName(wonderId),
        ownerAddress: formatOwnerAddress(row.last_recorded_owner),
        ownerName: null,
        totalFaithPoints,
        faithPointsPerSecond,
        followerCount,
      } satisfies FaithLeaderboardEntry;
    })
    .filter((entry): entry is FaithLeaderboardEntry => entry !== null)
    .toSorted((left, right) => {
      if (left.totalFaithPoints !== right.totalFaithPoints) {
        return left.totalFaithPoints < right.totalFaithPoints ? 1 : -1;
      }

      if (left.faithPointsPerSecond !== right.faithPointsPerSecond) {
        return right.faithPointsPerSecond - left.faithPointsPerSecond;
      }

      if (left.wonderId !== right.wonderId) {
        return left.wonderId > right.wonderId ? 1 : -1;
      }

      return 0;
    });

  return entries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
};

export const fetchFaithLeaderboard = async (toriiBaseUrl?: string): Promise<FaithLeaderboardEntry[]> => {
  const explicitUrl = toriiBaseUrl?.trim();
  const baseUrl = explicitUrl?.length ? explicitUrl : getSqlApiBaseUrl();

  if (!baseUrl?.trim()) {
    return [];
  }

  const sqlBaseUrl = ensureSqlSuffix(baseUrl.trim());
  const url = buildApiUrl(sqlBaseUrl, WONDER_FAITH_LEADERBOARD_QUERY);
  const rows = await fetchWithErrorHandling<FaithLeaderboardRow>(url, "Failed to fetch faith leaderboard");
  return transformFaithLeaderboardRows(rows);
};
