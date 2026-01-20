import { ContractAddress } from "@bibliothecadao/types";

import {
  HyperstructureLeaderboardConfigRow,
  HyperstructureRow,
  HyperstructureShareholderRow,
  PlayerActivityBreakdown,
  PlayerActivityStat,
  PlayerLeaderboardRow,
  RawPlayerLeaderboardRow,
} from "../../types/sql";
import {
  calculateUnregisteredShareholderPointsCache,
  ContractAddressAndAmount,
  HyperstructureLeaderboardHyperstructure,
  HyperstructureShareholder,
} from "../../utils/leaderboard";
import {
  buildApiUrl,
  extractFirstOrNull,
  fetchJsonWithErrorHandling,
  fetchWithErrorHandling,
  formatAddressForQuery,
} from "../../utils/sql";
import { LEADERBOARD_QUERIES } from "./leaderboard";

export const REGISTERED_POINTS_PRECISION = 1_000_000;

type NumericLike = string | number | bigint | null | undefined;

interface ParsedActivityStat {
  pointsRaw: number;
  count: number;
}

const parseActivityStat = (pointsValue: NumericLike, countValue: NumericLike): ParsedActivityStat => {
  const pointsRaw = Math.max(0, Math.floor(parseNumericValue(pointsValue)));
  const count = Math.max(0, Math.floor(parseNumericValue(countValue)));

  return { pointsRaw, count };
};

const toPlayerActivityStat = (value: ParsedActivityStat): PlayerActivityStat => {
  return {
    points: value.pointsRaw / REGISTERED_POINTS_PRECISION,
    count: value.count,
  };
};

const buildActivityBreakdown = (
  row: Partial<RawPlayerLeaderboardRow> | undefined,
  totalRaw: number,
): PlayerActivityBreakdown => {
  const totalRawSafe = Math.max(0, Math.floor(Number.isFinite(totalRaw) ? totalRaw : 0));
  const source = row ?? {};

  const exploration = parseActivityStat(source.exploration_points, source.exploration_count);
  const openRelicChest = parseActivityStat(source.open_relic_chest_points, source.open_relic_chest_count);
  const hyperStructureBanditsDefeat = parseActivityStat(
    source.hyperstructure_bandits_defeat_points,
    source.hyperstructure_bandits_defeat_count,
  );
  const otherStructureBanditsDefeat = parseActivityStat(
    source.other_structure_bandits_defeat_points,
    source.other_structure_bandits_defeat_count,
  );

  const recordedPointsRaw =
    exploration.pointsRaw +
    openRelicChest.pointsRaw +
    hyperStructureBanditsDefeat.pointsRaw +
    otherStructureBanditsDefeat.pointsRaw;

  const hyperstructureShareRaw = Math.max(0, totalRawSafe - recordedPointsRaw);
  const hyperstructureShare: ParsedActivityStat = {
    pointsRaw: hyperstructureShareRaw,
    count: 0,
  };

  return {
    exploration: toPlayerActivityStat(exploration),
    openRelicChest: toPlayerActivityStat(openRelicChest),
    hyperStructureBanditsDefeat: toPlayerActivityStat(hyperStructureBanditsDefeat),
    otherStructureBanditsDefeat: toPlayerActivityStat(otherStructureBanditsDefeat),
    hyperstructureShare: toPlayerActivityStat(hyperstructureShare),
  };
};

export interface LeaderboardPagination {
  safeLimit: number;
  safeOffset: number;
  effectiveLimit: number;
}

export interface LeaderboardSourceData {
  registeredRows: RawPlayerLeaderboardRow[];
  hyperstructureShareholderRows: HyperstructureShareholderRow[];
  hyperstructureRows: HyperstructureRow[];
  hyperstructureConfigRow?: HyperstructureLeaderboardConfigRow;
}

export interface FetchLeaderboardSourceDataOptions {
  baseUrl: string;
  cacheBaseUrl?: string;
  effectiveLimit: number;
  defaultHyperstructureRadius: number;
}

interface LeaderboardCacheResponse {
  registeredRows: RawPlayerLeaderboardRow[];
  hyperstructureShareholderRows: HyperstructureShareholderRow[];
  hyperstructureRows: HyperstructureRow[];
  hyperstructureConfigRow?: HyperstructureLeaderboardConfigRow;
}

const buildCacheUrl = (baseUrl: string, path: string): URL => {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(`${trimmed}${normalizedPath}`);
};

const appendToriiSqlBaseUrl = (cacheUrl: URL, toriiSqlBaseUrl: string): void => {
  const trimmed = toriiSqlBaseUrl.trim();
  if (!trimmed) {
    return;
  }

  cacheUrl.searchParams.set("toriiSqlBaseUrl", trimmed);
};

export const sanitizeLeaderboardPagination = (limit: number, offset: number): LeaderboardPagination => {
  const safeLimit = Math.max(0, limit);
  const safeOffset = Math.max(0, offset);

  return {
    safeLimit,
    safeOffset,
    effectiveLimit: safeLimit + safeOffset,
  };
};

export const fetchLeaderboardSourceData = async ({
  baseUrl,
  cacheBaseUrl,
  effectiveLimit,
}: FetchLeaderboardSourceDataOptions): Promise<LeaderboardSourceData> => {
  const cacheBase = cacheBaseUrl?.trim();

  if (cacheBase) {
    try {
      const cacheUrl = buildCacheUrl(cacheBase, "/api/cache/leaderboard");
      cacheUrl.searchParams.set("limit", effectiveLimit > 0 ? effectiveLimit.toString() : "0");
      appendToriiSqlBaseUrl(cacheUrl, baseUrl);
      const cached = await fetchJsonWithErrorHandling<LeaderboardCacheResponse>(
        cacheUrl.toString(),
        "Failed to fetch cached player leaderboard",
      );

      return {
        registeredRows: cached.registeredRows ?? [],
        hyperstructureShareholderRows: cached.hyperstructureShareholderRows ?? [],
        hyperstructureRows: cached.hyperstructureRows ?? [],
        hyperstructureConfigRow: cached.hyperstructureConfigRow,
      };
    } catch (error) {
      console.warn("Cached leaderboard fetch failed; falling back to direct SQL.", error);
    }
  }

  const leaderboardQuery =
    effectiveLimit > 0
      ? LEADERBOARD_QUERIES.PLAYER_LEADERBOARD.replace("{limit}", effectiveLimit.toString()).replace("{offset}", "0")
      : LEADERBOARD_QUERIES.PLAYER_LEADERBOARD_ALL;

  const [registeredRows, hyperstructureShareholderRows, hyperstructureRows, hyperstructureConfigRows] =
    await Promise.all([
      fetchWithErrorHandling<RawPlayerLeaderboardRow>(
        buildApiUrl(baseUrl, leaderboardQuery),
        "Failed to fetch player leaderboard",
      ),
      fetchWithErrorHandling<HyperstructureShareholderRow>(
        buildApiUrl(baseUrl, LEADERBOARD_QUERIES.HYPERSTRUCTURE_SHAREHOLDERS),
        "Failed to fetch hyperstructure shareholders",
      ),
      fetchWithErrorHandling<HyperstructureRow>(
        buildApiUrl(baseUrl, LEADERBOARD_QUERIES.HYPERSTRUCTURES_WITH_MULTIPLIER),
        "Failed to fetch hyperstructure multipliers",
      ),
      fetchWithErrorHandling<HyperstructureLeaderboardConfigRow>(
        buildApiUrl(baseUrl, LEADERBOARD_QUERIES.HYPERSTRUCTURE_LEADERBOARD_CONFIG),
        "Failed to fetch hyperstructure leaderboard config",
      ),
    ]);

  return {
    registeredRows,
    hyperstructureShareholderRows,
    hyperstructureRows,
    hyperstructureConfigRow: hyperstructureConfigRows[0],
  };
};

export interface FetchRegisteredLeaderboardRowOptions {
  baseUrl: string;
  playerAddress: string;
}

export const fetchRegisteredLeaderboardRow = async ({
  baseUrl,
  playerAddress,
}: FetchRegisteredLeaderboardRowOptions): Promise<RawPlayerLeaderboardRow | null> => {
  const trimmed = playerAddress.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-f]+$/.test(prefixed)) {
    return null;
  }

  let canonicalAddress: string;
  try {
    canonicalAddress = formatAddressForQuery(prefixed).toLowerCase();
  } catch {
    return null;
  }

  const query = LEADERBOARD_QUERIES.PLAYER_LEADERBOARD_BY_ADDRESS.replace("{playerAddress}", canonicalAddress);

  const results = await fetchWithErrorHandling<RawPlayerLeaderboardRow>(
    buildApiUrl(baseUrl, query),
    "Failed to fetch player leaderboard entry",
  );

  return extractFirstOrNull(results);
};

export interface LeaderboardConfig {
  pointsPerSecondWithoutMultiplier: number;
  seasonEnd: number;
}

const parseLeaderboardConfig = (configRow?: HyperstructureLeaderboardConfigRow): LeaderboardConfig | null => {
  if (!configRow) {
    return null;
  }

  const rawPointsPerSecond = parseBigIntValue(configRow.points_per_second);
  const pointsPerSecondWithoutMultiplier =
    rawPointsPerSecond > 0n ? Number(rawPointsPerSecond) / REGISTERED_POINTS_PRECISION : 0;

  if (pointsPerSecondWithoutMultiplier <= 0) {
    return null;
  }

  const seasonEnd = Math.max(0, Math.floor(parseNumericValue(configRow.season_end)));

  return {
    pointsPerSecondWithoutMultiplier,
    seasonEnd,
  };
};

const buildHyperstructures = (hyperstructureRows: HyperstructureRow[]): HyperstructureLeaderboardHyperstructure[] => {
  return hyperstructureRows
    .map((row) => {
      const hyperstructureId = Math.floor(parseNumericValue(row.hyperstructure_id));
      if (!Number.isFinite(hyperstructureId) || hyperstructureId <= 0) {
        return null;
      }

      const pointsMultiplierRaw = parseNumericValue(row.points_multiplier);
      const pointsMultiplier = pointsMultiplierRaw > 0 ? pointsMultiplierRaw : 1;

      return {
        hyperstructure_id: hyperstructureId,
        points_multiplier: pointsMultiplier,
      };
    })
    .filter((item): item is HyperstructureLeaderboardHyperstructure => item !== null);
};

const buildHyperstructureShareholders = (
  hyperstructureShareholderRows: HyperstructureShareholderRow[],
): HyperstructureShareholder[] => {
  return hyperstructureShareholderRows
    .map((row) => {
      const hyperstructureId = Math.floor(parseNumericValue(row.hyperstructure_id));
      if (!Number.isFinite(hyperstructureId) || hyperstructureId <= 0) {
        return null;
      }

      const startAt = Math.floor(parseNumericValue(row.start_at));
      if (startAt <= 0) {
        return null;
      }

      const shareholders = parseShareholders(row.shareholders);
      if (shareholders.length === 0) {
        return null;
      }

      return {
        hyperstructure_id: hyperstructureId,
        start_at: startAt,
        shareholders,
      };
    })
    .filter((item): item is HyperstructureShareholder => item !== null);
};

export interface ComputeUnregisteredShareholderPointsOptions {
  configRow?: HyperstructureLeaderboardConfigRow;
  hyperstructureRows: HyperstructureRow[];
  hyperstructureShareholderRows: HyperstructureShareholderRow[];
}

export const computeUnregisteredShareholderPoints = ({
  configRow,
  hyperstructureRows,
  hyperstructureShareholderRows,
}: ComputeUnregisteredShareholderPointsOptions): Map<string, number> => {
  const config = parseLeaderboardConfig(configRow);
  if (!config) {
    return new Map();
  }

  const hyperstructures = buildHyperstructures(hyperstructureRows);
  const hyperstructureShareholders = buildHyperstructureShareholders(hyperstructureShareholderRows);

  if (hyperstructures.length === 0 || hyperstructureShareholders.length === 0) {
    return new Map();
  }

  const computed = calculateUnregisteredShareholderPointsCache({
    pointsPerSecondWithoutMultiplier: config.pointsPerSecondWithoutMultiplier,
    seasonEnd: config.seasonEnd,
    hyperstructureShareholders,
    hyperstructures,
  });

  return new Map(
    Array.from(computed.entries())
      .map(([address, points]) => {
        const normalizedAddress = normalizeAddress(address);
        return normalizedAddress ? ([normalizedAddress.toLowerCase(), points] as const) : null;
      })
      .filter((entry): entry is readonly [string, number] => entry !== null),
  );
};

export interface BuildRegisteredLeaderboardEntriesOptions {
  registeredRows: RawPlayerLeaderboardRow[];
  unregisteredShareholderPoints: Map<string, number>;
}

export interface BuildRegisteredLeaderboardEntriesResult {
  entries: PlayerLeaderboardRow[];
  processedAddresses: Set<string>;
}

export const buildRegisteredLeaderboardEntries = ({
  registeredRows,
  unregisteredShareholderPoints,
}: BuildRegisteredLeaderboardEntriesOptions): BuildRegisteredLeaderboardEntriesResult => {
  const entries: PlayerLeaderboardRow[] = [];
  const processedAddresses = new Set<string>();

  for (const row of registeredRows) {
    const normalizedAddress = normalizeAddress(row.player_address);
    if (!normalizedAddress) {
      continue;
    }

    const canonicalAddress = normalizedAddress.toLowerCase();
    processedAddresses.add(canonicalAddress);

    const registeredRaw = Math.max(0, Math.floor(parseNumericValue(row.registered_points)));
    const bonusPoints = unregisteredShareholderPoints.get(canonicalAddress) ?? 0;
    const bonusRaw = Math.round(bonusPoints * REGISTERED_POINTS_PRECISION);
    const totalRaw = registeredRaw + bonusRaw;
    const activityBreakdown = buildActivityBreakdown(row, totalRaw);

    entries.push({
      playerAddress: normalizedAddress,
      playerName: row.player_name ?? null,
      prizeClaimed: Boolean(parseNumericValue(row.prize_claimed)),
      registeredPoints: totalRaw,
      registeredPointsRegistered: registeredRaw,
      registeredPointsRaw: totalRaw,
      totalPoints: totalRaw / REGISTERED_POINTS_PRECISION,
      unregisteredPoints: bonusPoints,
      activityBreakdown,
    });
  }

  return { entries, processedAddresses };
};

export interface BuildAdditionalLeaderboardEntriesOptions {
  unregisteredShareholderPoints: Map<string, number>;
  processedAddresses: Set<string>;
}

export const buildAdditionalLeaderboardEntries = ({
  unregisteredShareholderPoints,
  processedAddresses,
}: BuildAdditionalLeaderboardEntriesOptions): PlayerLeaderboardRow[] => {
  const additionalEntries: PlayerLeaderboardRow[] = [];

  for (const [address, points] of unregisteredShareholderPoints) {
    if (processedAddresses.has(address) || points <= 0) {
      continue;
    }

    const totalRaw = Math.round(points * REGISTERED_POINTS_PRECISION);
    const activityBreakdown = buildActivityBreakdown(undefined, totalRaw);

    additionalEntries.push({
      playerAddress: address,
      playerName: null,
      prizeClaimed: false,
      registeredPoints: totalRaw,
      registeredPointsRegistered: 0,
      registeredPointsRaw: totalRaw,
      totalPoints: totalRaw / REGISTERED_POINTS_PRECISION,
      unregisteredPoints: points,
      activityBreakdown,
    });
  }

  return additionalEntries;
};

export const sortLeaderboardEntries = (entries: PlayerLeaderboardRow[]): PlayerLeaderboardRow[] => {
  return entries.sort((a, b) => {
    const aTotal = parseNumericValue(a.registeredPoints);
    const bTotal = parseNumericValue(b.registeredPoints);

    return bTotal - aTotal;
  });
};

export const addLeaderboardRanks = (entries: PlayerLeaderboardRow[]): PlayerLeaderboardRow[] => {
  let lastTotal: number | null = null;
  let currentRank = 0;

  return entries.map((entry, index) => {
    const total = parseNumericValue(entry.registeredPoints);
    const normalizedTotal = Number.isFinite(total) ? total : 0;

    if (lastTotal === null || normalizedTotal !== lastTotal) {
      currentRank = index + 1;
      lastTotal = normalizedTotal;
    }

    return {
      ...entry,
      rank: currentRank,
    };
  });
};

const parseShareholders = (raw: unknown): ContractAddressAndAmount[] => {
  if (raw === null || raw === undefined) {
    return [];
  }

  let candidate: unknown = raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed.length) {
      return [];
    }

    try {
      candidate = JSON.parse(trimmed);
    } catch {
      const normalised = trimmed.replace(/\(/g, "[").replace(/\)/g, "]");
      try {
        candidate = JSON.parse(normalised);
      } catch {
        return [];
      }
    }
  }

  if (!Array.isArray(candidate)) {
    return [];
  }

  const shareholders: ContractAddressAndAmount[] = [];

  for (const entry of candidate) {
    if (!entry) {
      continue;
    }

    let addressValue: unknown;
    let percentageValue: unknown;

    if (Array.isArray(entry)) {
      [addressValue, percentageValue] = entry;
    } else if (typeof entry === "object") {
      const record = entry as Record<string, unknown>;

      if (Array.isArray(record.value)) {
        [addressValue, percentageValue] = record.value;
      } else {
        addressValue = record.address ?? record["0"];
        percentageValue = record.percentage ?? record["1"];
      }
    }

    addressValue = unwrapValue(addressValue);
    percentageValue = unwrapValue(percentageValue);

    const address = normalizeAddress(addressValue);
    if (!address) {
      continue;
    }

    const numeric = parseNumericValue(percentageValue as NumericLike);
    if (numeric <= 0) {
      continue;
    }

    let percentage = numeric;
    if (percentage > 1) {
      if (percentage > 1000) {
        percentage = percentage / 10_000;
      } else if (percentage > 100) {
        percentage = percentage / 10_000;
      } else {
        percentage = percentage / 100;
      }
    }

    if (percentage <= 0) {
      continue;
    }

    if (percentage > 1) {
      percentage = 1;
    }

    shareholders.push({
      address: address as unknown as ContractAddress,
      percentage,
    });
  }

  return shareholders;
};

const normalizeAddress = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  return lower.startsWith("0x") ? lower : "0x" + lower;
};

const unwrapValue = (input: unknown): unknown => {
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    if ("value" in record) {
      return unwrapValue(record.value);
    }
    if ("inner" in record) {
      return unwrapValue(record.inner);
    }
  }
  return input;
};

const parseNumericValue = (value: NumericLike): number => {
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

      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? numeric : 0;
    } catch {
      return 0;
    }
  }

  return 0;
};

const parseBigIntValue = (value: NumericLike): bigint => {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return 0n;
    }

    return BigInt(Math.trunc(value));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return 0n;
    }

    try {
      const normalized = trimmed.startsWith("0x") ? trimmed : "0x" + trimmed;
      return BigInt(normalized as unknown as string);
    } catch {
      return 0n;
    }
  }

  return 0n;
};
