import { sqlApi } from "@/services/api";
import { SqlApi, type PlayerLeaderboardRow } from "@bibliothecadao/torii";

const DEFAULT_LIMIT = 20;
const REGISTERED_POINTS_PRECISION = 1_000_000;
const SCORE_TO_BEAT_ENDPOINT_TIMEOUT_MS = 10_000;

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

export interface ScoreToBeatRun {
  endpoint: string;
  points: number;
  rank: number;
}

export interface ScoreToBeatEntrySummary {
  address: string;
  displayName: string | null;
  combinedPoints: number;
  runs: ScoreToBeatRun[];
  totalRuns: number;
}

export interface ScoreToBeatResult {
  entries: ScoreToBeatEntrySummary[];
  endpoints: string[];
  failedEndpoints: string[];
  generatedAt: number;
}

export interface ScoreToBeatOptions {
  perEndpointLimit?: number;
  runsToAggregate?: number;
  maxPlayers?: number;
}

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

const buildLeaderboardEntries = (rows: PlayerLeaderboardRow[], safeOffset: number): PlayerLeaderboardData[] => {
  const entries: PlayerLeaderboardData[] = [];

  rows.forEach((rawRow, index) => {
    const entry = transformLandingLeaderboardRow(rawRow, safeOffset + index + 1);
    if (entry) {
      entries.push(entry);
    }
  });

  return entries.sort((a, b) => b.points - a.points).map((entry, index) => ({ ...entry, rank: index + 1 }));
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
): Promise<PlayerLeaderboardData[]> => fetchLeaderboardWithClient(sqlApi, limit, offset);

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

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const normaliseToriiEndpoint = (value: string): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.search = "";
    const base = trimTrailingSlash(url.toString());
    return base.endsWith("/sql") ? base : `${base}/sql`;
  } catch {
    return null;
  }
};

const sanitiseToriiEndpoints = (endpoints: string[]): string[] => {
  const seen = new Set<string>();
  const sanitized: string[] = [];

  endpoints.forEach((candidate) => {
    const normalized = normaliseToriiEndpoint(candidate);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      sanitized.push(normalized);
    }
  });

  return sanitized;
};

type EndpointSnapshot = {
  endpoint: string;
  entries: PlayerLeaderboardData[];
};

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

const fetchLeaderboardForEndpoint = async (
  endpoint: string,
  limit: number,
  offset: number = 0,
): Promise<EndpointSnapshot> => ({
  endpoint,
  entries: await withTimeout(
    fetchLeaderboardWithClient(new SqlApi(endpoint), limit, offset),
    SCORE_TO_BEAT_ENDPOINT_TIMEOUT_MS,
    `Score to beat request timed out for ${endpoint}`,
  ),
});

export const fetchScoreToBeatAcrossEndpoints = async (
  toriiEndpoints: string[],
  { perEndpointLimit = 50, runsToAggregate = 2, maxPlayers = 10 }: ScoreToBeatOptions = {},
): Promise<ScoreToBeatResult> => {
  const safePerEndpointLimit = perEndpointLimit > 0 ? perEndpointLimit : DEFAULT_LIMIT;
  const safeRunsToAggregate = runsToAggregate > 0 ? runsToAggregate : 2;
  const safeMaxPlayers = maxPlayers > 0 ? maxPlayers : 10;

  const sanitizedEndpoints = sanitiseToriiEndpoints(toriiEndpoints);

  if (sanitizedEndpoints.length === 0) {
    return {
      entries: [],
      endpoints: [],
      failedEndpoints: [],
      generatedAt: Date.now(),
    };
  }

  const settledSnapshots = await Promise.allSettled(
    sanitizedEndpoints.map((endpoint) => fetchLeaderboardForEndpoint(endpoint, safePerEndpointLimit)),
  );

  const successfulSnapshots: EndpointSnapshot[] = [];
  const failedEndpoints: string[] = [];

  settledSnapshots.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successfulSnapshots.push(result.value);
    } else {
      failedEndpoints.push(sanitizedEndpoints[index]);
      console.error("Failed to fetch Torii leaderboard", sanitizedEndpoints[index], result.reason);
    }
  });

  const perPlayer = new Map<string, { address: string; displayName: string | null; runs: ScoreToBeatRun[] }>();

  successfulSnapshots.forEach(({ endpoint, entries }) => {
    entries.forEach((entry) => {
      const key = entry.address.toLowerCase();
      const snapshot = perPlayer.get(key) ?? {
        address: entry.address,
        displayName: entry.displayName ?? null,
        runs: [],
      };

      if (!snapshot.displayName && entry.displayName) {
        snapshot.displayName = entry.displayName;
      }

      snapshot.runs.push({ endpoint, points: entry.points, rank: entry.rank });
      perPlayer.set(key, snapshot);
    });
  });

  const aggregatedEntries = Array.from(perPlayer.values())
    .map((player) => {
      const sortedRuns = [...player.runs].sort((a, b) => b.points - a.points).slice(0, safeRunsToAggregate);
      const combinedPoints = sortedRuns.reduce((sum, run) => sum + run.points, 0);

      return {
        address: player.address,
        displayName: player.displayName,
        combinedPoints,
        runs: sortedRuns,
        totalRuns: player.runs.length,
      } satisfies ScoreToBeatEntrySummary;
    })
    .filter((entry) => entry.runs.length > 0)
    .sort((a, b) => b.combinedPoints - a.combinedPoints)
    .slice(0, safeMaxPlayers);

  return {
    entries: aggregatedEntries,
    endpoints: sanitizedEndpoints,
    failedEndpoints,
    generatedAt: Date.now(),
  } satisfies ScoreToBeatResult;
};
