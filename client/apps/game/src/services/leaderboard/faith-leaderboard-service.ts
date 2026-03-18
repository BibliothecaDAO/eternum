import { getRealmNameById } from "@bibliothecadao/eternum";
import { buildApiUrl, fetchWithErrorHandling } from "@bibliothecadao/torii";

import { getSqlApiBaseUrl } from "@/services/api";

interface FaithLeaderboardRow {
  wonder_id?: unknown;
  owner_address?: unknown;
  owner_name?: unknown;
  realm_id?: unknown;
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
    s.entity_id AS wonder_id,
    s.owner AS owner_address,
    sos.name AS owner_name,
    s.\`metadata.realm_id\` AS realm_id,
    COALESCE(wf.claimed_points, 0) AS claimed_points,
    COALESCE(wf.claim_per_sec, 0) AS claim_per_sec,
    COALESCE(wf.num_structures_pledged, 0) AS num_structures_pledged
  FROM [s1_eternum-Structure] s
  LEFT JOIN [s1_eternum-WonderFaith] wf ON wf.wonder_id = s.entity_id
  LEFT JOIN [s1_eternum-StructureOwnerStats] sos ON sos.owner = s.owner
  WHERE s.\`metadata.has_wonder\` = true
  ORDER BY COALESCE(wf.claimed_points, 0) DESC, COALESCE(wf.claim_per_sec, 0) DESC, s.entity_id ASC;
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

const buildWonderName = (wonderId: bigint, realmId: number): string => {
  if (realmId > 0) {
    const realmName = getRealmNameById(realmId);
    if (realmName) {
      return `Wonder - ${realmName}`;
    }

    return `Wonder #${realmId}`;
  }

  return `Wonder #${wonderId.toString()}`;
};

const parseOwnerName = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const transformFaithLeaderboardRows = (rows: FaithLeaderboardRow[]): FaithLeaderboardEntry[] => {
  const entries = rows
    .map((row) => {
      const wonderId = parseBigInt(row.wonder_id);
      if (wonderId == null || wonderId <= 0n) {
        return null;
      }

      const realmId = parseIntNumber(row.realm_id);
      const totalFaithPoints = parseBigInt(row.claimed_points) ?? 0n;
      const faithPointsPerSecond = parseIntNumber(row.claim_per_sec);
      const followerCount = parseIntNumber(row.num_structures_pledged);

      return {
        rank: 0,
        wonderId,
        wonderName: buildWonderName(wonderId, realmId),
        ownerAddress: formatOwnerAddress(row.owner_address),
        ownerName: parseOwnerName(row.owner_name),
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
