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
  claim_last_at?: unknown;
  num_structures_pledged?: unknown;
}

interface FaithfulStructureRow {
  structure_id?: unknown;
  wonder_id?: unknown;
  faithful_since?: unknown;
  fp_to_wonder_owner_per_sec?: unknown;
  fp_to_struct_owner_per_sec?: unknown;
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

export interface FaithfulStructureStatus {
  structureId: bigint;
  wonderId: bigint;
  faithfulSince: number;
  fpToWonderOwnerPerSec: number;
  fpToStructureOwnerPerSec: number;
}

const WONDER_FAITH_LEADERBOARD_QUERY = `
  SELECT
    s.entity_id AS wonder_id,
    s.owner AS owner_address,
    sos.name AS owner_name,
    s.\`metadata.realm_id\` AS realm_id,
    COALESCE(wf.claimed_points, 0) AS claimed_points,
    COALESCE(wf.claim_per_sec, 0) AS claim_per_sec,
    COALESCE(wf.claim_last_at, 0) AS claim_last_at,
    COALESCE(wf.num_structures_pledged, 0) AS num_structures_pledged
  FROM [s1_eternum-Structure] s
  LEFT JOIN [s1_eternum-WonderFaith] wf ON wf.wonder_id = s.entity_id
  LEFT JOIN [s1_eternum-StructureOwnerStats] sos ON sos.owner = s.owner
  WHERE s.\`metadata.has_wonder\` = true
  ORDER BY COALESCE(wf.claimed_points, 0) DESC, COALESCE(wf.claim_per_sec, 0) DESC, s.entity_id ASC;
`;

const buildFaithfulStructureStatusQuery = (structureId: bigint): string => `
  SELECT
    fs.structure_id AS structure_id,
    fs.wonder_id AS wonder_id,
    fs.faithful_since AS faithful_since,
    fs.fp_to_wonder_owner_per_sec AS fp_to_wonder_owner_per_sec,
    fs.fp_to_struct_owner_per_sec AS fp_to_struct_owner_per_sec
  FROM [s1_eternum-FaithfulStructure] fs
  WHERE fs.structure_id = ${structureId.toString()}
  LIMIT 1;
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

const parseNonNegativeBigInt = (value: unknown): bigint => {
  const parsed = parseBigInt(value);
  if (parsed == null || parsed < 0n) {
    return 0n;
  }

  return parsed;
};

const parseIntNumber = (value: unknown): number => {
  const parsed = parseNonNegativeBigInt(value);

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
  if (!trimmed.length) {
    return null;
  }

  const normalized = trimmed.toLowerCase();
  if (/^0x\.{3}0+$/.test(normalized)) {
    return null;
  }

  const withoutDots = normalized.replace(/\./g, "");
  if (/^0x0+$/.test(withoutDots)) {
    return null;
  }

  return trimmed;
};

const getOptimisticFaithPoints = (
  claimedPoints: bigint,
  claimPerSecond: bigint,
  claimLastAt: bigint,
  nowInSeconds: bigint,
): bigint => {
  if (claimedPoints <= 0n && claimPerSecond <= 0n) {
    return 0n;
  }

  if (claimPerSecond <= 0n || claimLastAt <= 0n || nowInSeconds <= claimLastAt) {
    return claimedPoints;
  }

  const elapsedSeconds = nowInSeconds - claimLastAt;
  const pendingPoints = claimPerSecond * elapsedSeconds;
  return claimedPoints + pendingPoints;
};

const transformFaithLeaderboardRows = (rows: FaithLeaderboardRow[]): FaithLeaderboardEntry[] => {
  const nowInSeconds = BigInt(Math.floor(Date.now() / 1000));

  const entries = rows
    .map((row) => {
      const wonderId = parseBigInt(row.wonder_id);
      if (wonderId == null || wonderId <= 0n) {
        return null;
      }

      const realmId = parseIntNumber(row.realm_id);
      const claimedPoints = parseNonNegativeBigInt(row.claimed_points);
      const claimPerSecond = parseNonNegativeBigInt(row.claim_per_sec);
      const claimLastAt = parseNonNegativeBigInt(row.claim_last_at);
      const totalFaithPoints = getOptimisticFaithPoints(claimedPoints, claimPerSecond, claimLastAt, nowInSeconds);
      const faithPointsPerSecond = parseIntNumber(claimPerSecond);
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

const transformFaithfulStructureRows = (rows: FaithfulStructureRow[]): FaithfulStructureStatus | null => {
  const row = rows[0];
  if (!row) {
    return null;
  }

  const structureId = parseBigInt(row.structure_id);
  const wonderId = parseBigInt(row.wonder_id);

  if (structureId == null || structureId <= 0n || wonderId == null || wonderId <= 0n) {
    return null;
  }

  return {
    structureId,
    wonderId,
    faithfulSince: parseIntNumber(row.faithful_since),
    fpToWonderOwnerPerSec: parseIntNumber(row.fp_to_wonder_owner_per_sec),
    fpToStructureOwnerPerSec: parseIntNumber(row.fp_to_struct_owner_per_sec),
  };
};

const isFaithfulStructureMissingTableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();
  const hasFaithfulStructureReference = normalizedMessage.includes("faithfulstructure");
  const isMissingTableError =
    normalizedMessage.includes("no such table") ||
    normalizedMessage.includes("does not exist") ||
    normalizedMessage.includes("not found") ||
    normalizedMessage.includes("unknown table");

  return hasFaithfulStructureReference && isMissingTableError;
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

export const fetchFaithfulStructureStatus = async (
  structureIdInput: bigint | number | string,
  toriiBaseUrl?: string,
): Promise<FaithfulStructureStatus | null> => {
  const structureId = parseBigInt(structureIdInput);
  if (structureId == null || structureId <= 0n) {
    return null;
  }

  const explicitUrl = toriiBaseUrl?.trim();
  const baseUrl = explicitUrl?.length ? explicitUrl : getSqlApiBaseUrl();

  if (!baseUrl?.trim()) {
    return null;
  }

  const sqlBaseUrl = ensureSqlSuffix(baseUrl.trim());
  const url = buildApiUrl(sqlBaseUrl, buildFaithfulStructureStatusQuery(structureId));

  try {
    const rows = await fetchWithErrorHandling<FaithfulStructureRow>(url, "Failed to fetch faith devotion status");
    return transformFaithfulStructureRows(rows);
  } catch (error) {
    if (isFaithfulStructureMissingTableError(error)) {
      return null;
    }

    throw error;
  }
};
