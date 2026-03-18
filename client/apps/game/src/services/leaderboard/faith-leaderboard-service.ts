import { getRealmNameById } from "@bibliothecadao/eternum";
import { buildApiUrl, fetchWithErrorHandling } from "@bibliothecadao/torii";

import { getSqlApiBaseUrl } from "@/services/api";

interface FaithLeaderboardRow {
  wonder_id?: unknown;
  realm_id?: unknown;
  owner_address?: unknown;
  owner_name?: unknown;
  total_fp?: unknown;
  fp_per_sec?: unknown;
  follower_count?: unknown;
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
  WITH wonder_data AS (
    SELECT
      wf.wonder_id AS wonder_id,
      wf.claimed_points AS total_fp,
      wf.claim_per_sec AS fp_per_sec,
      s.owner AS owner_address,
      sos.name AS owner_name,
      s.\`metadata.realm_id\` AS realm_id
    FROM [s1_eternum-WonderFaith] wf
    INNER JOIN [s1_eternum-Structure] s ON s.entity_id = wf.wonder_id
    LEFT JOIN [s1_eternum-StructureOwnerStats] sos ON sos.owner = s.owner
    WHERE s.\`metadata.has_wonder\` = true
  ),
  follower_counts AS (
    SELECT
      faith_rows.wonder_id AS wonder_id,
      COUNT(
        DISTINCT CASE
          WHEN faith_rows.pledger_owner_norm = faith_rows.wonder_owner_norm THEN NULL
          ELSE faith_rows.pledger_owner_norm
        END
      ) AS follower_count
    FROM (
      SELECT
        fs.wonder_id AS wonder_id,
        REPLACE(LOWER(CAST(pledged.owner AS TEXT)), '0x', '') AS pledger_owner_norm,
        REPLACE(LOWER(CAST(wonder.owner AS TEXT)), '0x', '') AS wonder_owner_norm
      FROM [s1_eternum-FaithfulStructure] fs
      INNER JOIN [s1_eternum-Structure] pledged ON pledged.entity_id = fs.structure_id
      INNER JOIN [s1_eternum-Structure] wonder ON wonder.entity_id = fs.wonder_id
      WHERE fs.wonder_id > 0
    ) faith_rows
    GROUP BY faith_rows.wonder_id
  )
  SELECT
    wd.wonder_id,
    wd.realm_id,
    wd.owner_address,
    wd.owner_name,
    wd.total_fp,
    wd.fp_per_sec,
    COALESCE(fc.follower_count, 0) AS follower_count
  FROM wonder_data wd
  LEFT JOIN follower_counts fc ON fc.wonder_id = wd.wonder_id
  ORDER BY wd.total_fp DESC, wd.fp_per_sec DESC, wd.wonder_id ASC;
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
      const totalFaithPoints = parseBigInt(row.total_fp) ?? 0n;
      const faithPointsPerSecond = parseIntNumber(row.fp_per_sec);
      const followerCount = parseIntNumber(row.follower_count);

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
