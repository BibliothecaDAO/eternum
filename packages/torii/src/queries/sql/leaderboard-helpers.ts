import { ContractAddress } from "@bibliothecadao/types";

import {
  HyperstructureLeaderboardConfigRow,
  HyperstructureRealmCountDataRaw,
  HyperstructureRow,
  HyperstructureShareholderRow,
  PlayerLeaderboardRow,
} from "../../types/sql";
import {
  calculateUnregisteredShareholderPointsCache,
  ContractAddressAndAmount,
  HyperstructureLeaderboardHyperstructure,
  HyperstructureShareholder,
} from "../../utils/leaderboard";
import { buildApiUrl, fetchWithErrorHandling } from "../../utils/sql";
import { LEADERBOARD_QUERIES } from "./leaderboard";

export const REGISTERED_POINTS_PRECISION = 1_000_000;

type NumericLike = string | number | bigint | null | undefined;

export interface LeaderboardPagination {
  safeLimit: number;
  safeOffset: number;
  effectiveLimit: number;
}

export interface LeaderboardSourceData {
  registeredRows: PlayerLeaderboardRow[];
  hyperstructureShareholderRows: HyperstructureShareholderRow[];
  hyperstructureRows: HyperstructureRow[];
  hyperstructureConfigRow?: HyperstructureLeaderboardConfigRow;
  hyperstructureRealmCounts: HyperstructureRealmCountDataRaw[];
}

export interface FetchLeaderboardSourceDataOptions {
  baseUrl: string;
  effectiveLimit: number;
  defaultHyperstructureRadius: number;
  fetchHyperstructuresWithRealmCount: (
    radius: number,
  ) => Promise<HyperstructureRealmCountDataRaw[]>;
}

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
  effectiveLimit,
  defaultHyperstructureRadius,
  fetchHyperstructuresWithRealmCount,
}: FetchLeaderboardSourceDataOptions): Promise<LeaderboardSourceData> => {
  const leaderboardQuery = LEADERBOARD_QUERIES.PLAYER_LEADERBOARD.replace(
    "{limit}",
    effectiveLimit.toString(),
  ).replace("{offset}", "0");

  const [
    registeredRows,
    hyperstructureShareholderRows,
    hyperstructureRows,
    hyperstructureConfigRows,
    hyperstructureRealmCounts,
  ] = await Promise.all([
    fetchWithErrorHandling<PlayerLeaderboardRow>(
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
    fetchHyperstructuresWithRealmCount(defaultHyperstructureRadius),
  ]);

  return {
    registeredRows,
    hyperstructureShareholderRows,
    hyperstructureRows,
    hyperstructureConfigRow: hyperstructureConfigRows[0],
    hyperstructureRealmCounts,
  };
};

export interface LeaderboardConfig {
  pointsPerSecondWithoutMultiplier: number;
  seasonEnd: number;
}

const parseLeaderboardConfig = (
  configRow?: HyperstructureLeaderboardConfigRow,
): LeaderboardConfig | null => {
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

const buildHyperstructureRealmCountMap = (
  hyperstructureRealmCounts: HyperstructureRealmCountDataRaw[],
): Map<number, number> => {
  return new Map(
    hyperstructureRealmCounts
      .map((row) => {
        const hyperstructureId = Math.floor(parseNumericValue(row.hyperstructure_entity_id));
        if (!Number.isFinite(hyperstructureId) || hyperstructureId <= 0) {
          return null;
        }

        const realmCount = Math.max(0, Math.floor(parseNumericValue(row.realm_count_within_radius)));
        return [hyperstructureId, realmCount] as const;
      })
      .filter((entry): entry is readonly [number, number] => entry !== null),
  );
};

const buildHyperstructures = (
  hyperstructureRows: HyperstructureRow[],
  realmCountsById: Map<number, number>,
): HyperstructureLeaderboardHyperstructure[] => {
  return hyperstructureRows
    .map((row) => {
      const hyperstructureId = Math.floor(parseNumericValue(row.hyperstructure_id));
      if (!Number.isFinite(hyperstructureId) || hyperstructureId <= 0) {
        return null;
      }

      const pointsMultiplierRaw = parseNumericValue(row.points_multiplier);
      const pointsMultiplier = pointsMultiplierRaw > 0 ? pointsMultiplierRaw : 1;
      const realmCount = realmCountsById.get(hyperstructureId) ?? 0;

      return {
        hyperstructure_id: hyperstructureId,
        points_multiplier: pointsMultiplier,
        realm_count: realmCount,
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
  hyperstructureRealmCounts: HyperstructureRealmCountDataRaw[];
}

export const computeUnregisteredShareholderPoints = ({
  configRow,
  hyperstructureRows,
  hyperstructureShareholderRows,
  hyperstructureRealmCounts,
}: ComputeUnregisteredShareholderPointsOptions): Map<string, number> => {
  const config = parseLeaderboardConfig(configRow);
  if (!config) {
    return new Map();
  }

  const realmCountsById = buildHyperstructureRealmCountMap(hyperstructureRealmCounts);
  const hyperstructures = buildHyperstructures(hyperstructureRows, realmCountsById);
  const hyperstructureShareholders = buildHyperstructureShareholders(hyperstructureShareholderRows);

  if (hyperstructures.length === 0 || hyperstructureShareholders.length === 0) {
    return new Map();
  }

  const computed = calculateUnregisteredShareholderPointsCache({
    pointsPerSecondWithoutMultiplier: config.pointsPerSecondWithoutMultiplier,
    realmCountPerHyperstructures: new Map(
      hyperstructures.map((item) => [item.hyperstructure_id, item.realm_count] as const),
    ),
    seasonEnd: config.seasonEnd,
    hyperstructureShareholders,
    hyperstructures,
  });

  return new Map(
    Array.from(computed.entries())
      .map(([address, points]) => {
        const normalizedAddress = normalizeAddress(address);
        return normalizedAddress ? [normalizedAddress.toLowerCase(), points] : null;
      })
      .filter((entry): entry is readonly [string, number] => entry !== null),
  );
};

export interface BuildRegisteredLeaderboardEntriesOptions {
  registeredRows: PlayerLeaderboardRow[];
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

    entries.push({
      player_address: normalizedAddress,
      playerAddress: normalizedAddress,
      player_name: row.player_name ?? null,
      playerName: row.player_name ?? null,
      prize_claimed: row.prize_claimed ?? 0,
      prizeClaimed: Boolean(parseNumericValue(row.prize_claimed)),
      registered_points: registeredRaw,
      registeredPointsRegistered: registeredRaw,
      registeredPointsRaw: totalRaw,
      registeredPoints: totalRaw,
      total_points: totalRaw,
      totalPoints: totalRaw / REGISTERED_POINTS_PRECISION,
      unregisteredPoints: bonusPoints,
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

    additionalEntries.push({
      player_address: address,
      playerAddress: address,
      player_name: null,
      playerName: null,
      prize_claimed: 0,
      prizeClaimed: false,
      registered_points: 0,
      registeredPointsRegistered: 0,
      registeredPointsRaw: totalRaw,
      registeredPoints: totalRaw,
      total_points: totalRaw,
      totalPoints: totalRaw / REGISTERED_POINTS_PRECISION,
      unregisteredPoints: points,
    });
  }

  return additionalEntries;
};

export const sortLeaderboardEntries = (entries: PlayerLeaderboardRow[]): PlayerLeaderboardRow[] => {
  return entries.sort((a, b) => {
    const aTotal = parseNumericValue(a.registeredPoints ?? a.total_points ?? a.registered_points);
    const bTotal = parseNumericValue(b.registeredPoints ?? b.total_points ?? b.registered_points);

    return bTotal - aTotal;
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
