import { SqlApi, buildApiUrl, fetchWithErrorHandling } from "@bibliothecadao/torii";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

const RESOURCE_PRECISION_BIGINT = BigInt(RESOURCE_PRECISION);

const REVIEW_GAME_START_MAIN_SEASON_QUERY = `
  SELECT "season_config.start_main_at" AS start_main_at
  FROM "s1_eternum-WorldConfig"
  LIMIT 1;
`;

const REVIEW_GAME_START_MAIN_BLITZ_QUERY = `
  SELECT "blitz_game_config.start_main_at" AS start_main_at
  FROM "s1_eternum-WorldConfig"
  LIMIT 1;
`;

const REVIEW_FIRST_T3_CREATION_QUERY = `
  SELECT
    timestamp AS first_at,
    "owner.Some" AS owner_address
  FROM "s1_eternum-StoryEvent"
  WHERE story = 'ExplorerCreateStory'
    AND (
      lower(trim(CAST("story.ExplorerCreateStory.tier" AS TEXT))) = 't3'
      OR lower(CAST("story.ExplorerCreateStory.tier" AS TEXT)) LIKE '%t3%'
      OR CAST("story.ExplorerCreateStory.tier" AS INTEGER) = 2
      OR CAST("story.ExplorerCreateStory.tier" AS INTEGER) = 3
    )
    AND "owner.Some" IS NOT NULL
  ORDER BY timestamp ASC
  LIMIT 1;
`;

const REVIEW_FIRST_HYPERSTRUCTURE_CLAIM_QUERY = `
  SELECT
    timestamp AS first_at,
    "story.BattleStory.attacker_owner_address" AS owner_address
  FROM "s1_eternum-StoryEvent"
  WHERE story = 'BattleStory'
    AND (
      CAST("story.BattleStory.defender_structure.structure_taken" AS INTEGER) = 1
      OR lower(trim(CAST("story.BattleStory.defender_structure.structure_taken" AS TEXT))) = 'true'
    )
    AND (
      CAST("story.BattleStory.defender_structure.structure_category" AS INTEGER) = 2
      OR lower(trim(CAST("story.BattleStory.defender_structure.structure_category" AS TEXT))) = 'hyperstructure'
      OR lower(CAST("story.BattleStory.defender_structure.structure_category" AS TEXT)) LIKE '%hyper%'
    )
    AND "story.BattleStory.attacker_owner_address" IS NOT NULL
  ORDER BY timestamp ASC
  LIMIT 1;
`;

const REVIEW_FIRST_BLOOD_REALM_CAPTURE_QUERY = `
  SELECT
    timestamp AS captured_at,
    "story.BattleStory.attacker_owner_address" AS attacker_owner_address
  FROM "s1_eternum-StoryEvent"
  WHERE story = 'BattleStory'
    AND (
      CAST("story.BattleStory.defender_structure.structure_taken" AS INTEGER) = 1
      OR lower(trim(CAST("story.BattleStory.defender_structure.structure_taken" AS TEXT))) = 'true'
    )
    AND (
      CAST("story.BattleStory.defender_structure.structure_category" AS INTEGER) = 1
      OR lower(trim(CAST("story.BattleStory.defender_structure.structure_category" AS TEXT))) = 'realm'
      OR lower(CAST("story.BattleStory.defender_structure.structure_category" AS TEXT)) LIKE '%realm%'
    )
    AND "story.BattleStory.attacker_owner_address" IS NOT NULL
    AND "story.BattleStory.defender_owner_address" IS NOT NULL
    AND ltrim(lower(CAST("story.BattleStory.attacker_owner_address" AS TEXT)), '0x') != ''
    AND ltrim(lower(CAST("story.BattleStory.defender_owner_address" AS TEXT)), '0x') != ''
    AND ltrim(lower(CAST("story.BattleStory.attacker_owner_address" AS TEXT)), '0x') != ltrim(lower(CAST("story.BattleStory.defender_owner_address" AS TEXT)), '0x')
  ORDER BY timestamp ASC
  LIMIT 1;
`;

const REVIEW_EXPLORER_CREATIONS_QUERY = `
  SELECT
    "owner.Some" AS owner_address,
    "story.ExplorerCreateStory.tier" AS troop_tier,
    "story.ExplorerCreateStory.amount" AS troop_amount
  FROM "s1_eternum-StoryEvent"
  WHERE story = 'ExplorerCreateStory'
    AND "owner.Some" IS NOT NULL;
`;

const REVIEW_STRUCTURE_OWNERS_QUERY = `
  SELECT entity_id, owner
  FROM "s1_eternum-Structure";
`;

const REVIEW_EXPLORER_OWNERS_QUERY = `
  SELECT explorer_id, owner AS owner_structure_id
  FROM "s1_eternum-ExplorerTroops";
`;

const REVIEW_BATTLE_KILLS_QUERY = `
  SELECT
    "story.BattleStory.attacker_owner_address" AS attacker_owner_address,
    "story.BattleStory.defender_owner_address" AS defender_owner_address,
    "story.BattleStory.attacker_troops_lost" AS attacker_troops_lost,
    "story.BattleStory.defender_troops_lost" AS defender_troops_lost
  FROM "s1_eternum-StoryEvent"
  WHERE story = 'BattleStory';
`;

interface StartMainRow {
  start_main_at?: unknown;
}

interface FirstMilestoneRow {
  first_at?: unknown;
  owner_address?: unknown;
}

interface FirstBloodRow {
  captured_at?: unknown;
  attacker_owner_address?: unknown;
}

interface ExplorerCreationRow {
  owner_address?: unknown;
  troop_tier?: unknown;
  troop_amount?: unknown;
}

interface StructureOwnerRow {
  entity_id?: unknown;
  owner?: unknown;
}

interface ExplorerOwnerRow {
  explorer_id?: unknown;
  owner_structure_id?: unknown;
}

interface OccupiedTileRow {
  occupier_id?: unknown;
  occupier_is_structure?: unknown;
}

interface BattleKillsRow {
  attacker_owner_address?: unknown;
  defender_owner_address?: unknown;
  attacker_troops_lost?: unknown;
  defender_troops_lost?: unknown;
}

export interface GameReviewValueMetric {
  playerAddress: string;
  value: number;
  timestamp?: number;
}

export interface GameReviewMilestoneTimings {
  timeToFirstT3Seconds: GameReviewValueMetric | null;
  timeToFirstHyperstructureSeconds: GameReviewValueMetric | null;
}

export interface GameReviewBiggestArmyMetric extends GameReviewValueMetric {
  tier: 1 | 2 | 3;
}

export interface GameReviewCompetitiveMetrics {
  mostTroopsKilled: GameReviewValueMetric | null;
  biggestStructuresOwned: GameReviewValueMetric | null;
}

const EMPTY_COMPETITIVE_METRICS: GameReviewCompetitiveMetrics = {
  mostTroopsKilled: null,
  biggestStructuresOwned: null,
};

const queryToriiSql = async <TRow extends object>(
  toriiSqlBaseUrl: string,
  query: string,
  errorMessage: string,
): Promise<TRow[]> => {
  const url = buildApiUrl(toriiSqlBaseUrl, query);
  return fetchWithErrorHandling<TRow>(url, errorMessage);
};

const parseBigIntValue = (value: unknown): bigint | null => {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return BigInt(Math.trunc(value));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
        return BigInt(trimmed);
      }

      if (/^[+-]?\d+$/.test(trimmed)) {
        return BigInt(trimmed);
      }
    } catch {
      return null;
    }
  }

  return null;
};

const parseInteger = (value: unknown): number | null => {
  const bigintValue = parseBigIntValue(value);
  if (bigintValue == null) {
    return null;
  }

  const asNumber = Number(bigintValue);
  return Number.isFinite(asNumber) ? asNumber : null;
};

const parseNumeric = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : 0;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;

    try {
      const parsed = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? Number(BigInt(trimmed)) : Number(trimmed);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  }

  return 0;
};

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0;
  }

  if (typeof value === "bigint") {
    return value !== 0n;
  }

  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return false;
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    return parseNumeric(trimmed) !== 0;
  }

  return false;
};

const parseScaledAmount = (value: unknown): number => {
  const bigintValue = parseBigIntValue(value);
  if (bigintValue != null) {
    const whole = bigintValue / RESOURCE_PRECISION_BIGINT;
    const remainder = bigintValue % RESOURCE_PRECISION_BIGINT;
    const wholeAsNumber = Number(whole);
    const remainderAsNumber = Number(remainder) / RESOURCE_PRECISION;

    const combined = wholeAsNumber + remainderAsNumber;
    if (Number.isFinite(combined)) {
      return combined;
    }
  }

  return parseNumeric(value) / RESOURCE_PRECISION;
};

const parseTroopTier = (value: unknown, usesZeroBasedEncoding: boolean): 1 | 2 | 3 | null => {
  if (value == null) return null;

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 1) {
      return parseTroopTier(entries[0][0], usesZeroBasedEncoding);
    }
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const normalized = trimmed.toUpperCase();
    if (normalized === "T1") return 1;
    if (normalized === "T2") return 2;
    if (normalized === "T3") return 3;

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        return parseTroopTier(JSON.parse(trimmed), usesZeroBasedEncoding);
      } catch {
        return null;
      }
    }
  }

  const numericTier = parseInteger(value);
  if (numericTier == null) {
    return null;
  }

  if (usesZeroBasedEncoding) {
    if (numericTier === 0) return 1;
    if (numericTier === 1) return 2;
    if (numericTier === 2) return 3;
    return null;
  }

  if (numericTier === 1 || numericTier === 2 || numericTier === 3) {
    return numericTier;
  }

  return null;
};

const parseAddress = (value: unknown): string | null => {
  if (value == null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
      const asHex = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? trimmed : `0x${trimmed}`;
      return `0x${BigInt(asHex).toString(16)}`.toLowerCase();
    } catch {
      return null;
    }
  }

  if (typeof value === "number" || typeof value === "bigint") {
    try {
      return `0x${BigInt(value).toString(16)}`.toLowerCase();
    } catch {
      return null;
    }
  }

  return null;
};

const normalizeNonZeroAddress = (value: unknown): string | null => {
  const address = parseAddress(value);
  if (!address) {
    return null;
  }

  try {
    return BigInt(address) === 0n ? null : address;
  } catch {
    return null;
  }
};

const incrementMetric = (metrics: Map<string, number>, key: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) {
    return;
  }

  metrics.set(key, (metrics.get(key) ?? 0) + value);
};

const pickTopMetric = (metrics: Map<string, number>): GameReviewValueMetric | null => {
  let topPlayerAddress: string | null = null;
  let topValue = Number.NEGATIVE_INFINITY;

  for (const [playerAddress, value] of metrics.entries()) {
    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }

    if (
      topPlayerAddress == null ||
      value > topValue ||
      (value === topValue && playerAddress.localeCompare(topPlayerAddress) < 0)
    ) {
      topPlayerAddress = playerAddress;
      topValue = value;
    }
  }

  if (!topPlayerAddress || !Number.isFinite(topValue) || topValue <= 0) {
    return null;
  }

  return {
    playerAddress: topPlayerAddress,
    value: topValue,
    timestamp: undefined,
  };
};

const elapsedSecondsSince = (startAt: bigint | null, eventAt: bigint | null): number | null => {
  if (startAt == null || eventAt == null || startAt <= 0n || eventAt < startAt) {
    return null;
  }

  const elapsed = Number(eventAt - startAt);
  return Number.isFinite(elapsed) ? elapsed : null;
};

const buildFirstMilestoneMetric = ({
  gameStartAt,
  row,
}: {
  gameStartAt: bigint | null;
  row: FirstMilestoneRow | undefined;
}): GameReviewValueMetric | null => {
  const milestoneAt = parseBigIntValue(row?.first_at);
  const ownerAddress = normalizeNonZeroAddress(row?.owner_address);
  const elapsedSeconds = elapsedSecondsSince(gameStartAt, milestoneAt);

  if (elapsedSeconds == null || !ownerAddress) {
    return null;
  }

  const timestamp = milestoneAt == null ? undefined : Number(milestoneAt);

  return {
    playerAddress: ownerAddress,
    value: elapsedSeconds,
    timestamp: Number.isFinite(timestamp) ? timestamp : undefined,
  };
};

const computeBiggestArmyCreated = (rows: ExplorerCreationRow[]): GameReviewBiggestArmyMetric | null => {
  const numericTiers = rows.map((row) => parseInteger(row.troop_tier)).filter((tier): tier is number => tier !== null);
  const usesZeroBasedTierEncoding = numericTiers.includes(0);

  const tierMetrics = new Map<1 | 2 | 3, Map<string, number>>([
    [1, new Map<string, number>()],
    [2, new Map<string, number>()],
    [3, new Map<string, number>()],
  ]);

  for (const row of rows) {
    const ownerAddress = normalizeNonZeroAddress(row.owner_address);
    if (!ownerAddress) {
      continue;
    }

    const troopTier = parseTroopTier(row.troop_tier, usesZeroBasedTierEncoding);
    if (troopTier == null) {
      continue;
    }

    const troopAmount = parseScaledAmount(row.troop_amount);
    incrementMetric(tierMetrics.get(troopTier)!, ownerAddress, troopAmount);
  }

  const tierOrder: Array<1 | 2 | 3> = [3, 2, 1];
  const selectedTier = tierOrder.find((tier) => {
    const metrics = tierMetrics.get(tier);
    return metrics != null && [...metrics.values()].some((value) => value > 0);
  });

  if (selectedTier == null) {
    return null;
  }

  const topMetric = pickTopMetric(tierMetrics.get(selectedTier)!);
  if (!topMetric) {
    return null;
  }

  return {
    ...topMetric,
    tier: selectedTier,
  };
};

const buildStructureOwnerLookup = (
  rows: StructureOwnerRow[],
): {
  structureOwnerByEntityId: Map<number, string | null>;
  ownerStructureCounts: Map<string, number>;
} => {
  const structureOwnerByEntityId = new Map<number, string | null>();
  const ownerStructureCounts = new Map<string, number>();

  for (const row of rows) {
    const entityId = parseInteger(row.entity_id);
    if (entityId == null || entityId <= 0) {
      continue;
    }

    const ownerAddress = normalizeNonZeroAddress(row.owner);
    structureOwnerByEntityId.set(entityId, ownerAddress);

    if (ownerAddress) {
      incrementMetric(ownerStructureCounts, ownerAddress, 1);
    }
  }

  return {
    structureOwnerByEntityId,
    ownerStructureCounts,
  };
};

const buildExplorerOwnerLookup = (rows: ExplorerOwnerRow[]): Map<number, number> => {
  const ownerStructureByExplorerId = new Map<number, number>();

  for (const row of rows) {
    const explorerId = parseInteger(row.explorer_id);
    const ownerStructureId = parseInteger(row.owner_structure_id);

    if (explorerId == null || explorerId <= 0 || ownerStructureId == null || ownerStructureId <= 0) {
      continue;
    }

    ownerStructureByExplorerId.set(explorerId, ownerStructureId);
  }

  return ownerStructureByExplorerId;
};

const computeBiggestHexesOccupied = ({
  tiles,
  structureOwnerByEntityId,
  ownerStructureByExplorerId,
}: {
  tiles: OccupiedTileRow[];
  structureOwnerByEntityId: Map<number, string | null>;
  ownerStructureByExplorerId: Map<number, number>;
}): GameReviewValueMetric | null => {
  const occupiedHexesByOwner = new Map<string, number>();

  for (const tile of tiles) {
    const occupierId = parseInteger(tile.occupier_id);
    if (occupierId == null || occupierId <= 0) {
      continue;
    }

    let ownerAddress: string | null = null;

    if (parseBoolean(tile.occupier_is_structure)) {
      ownerAddress = structureOwnerByEntityId.get(occupierId) ?? null;
    } else {
      const ownerStructureId = ownerStructureByExplorerId.get(occupierId);
      if (ownerStructureId != null) {
        ownerAddress = structureOwnerByEntityId.get(ownerStructureId) ?? null;
      }
    }

    if (!ownerAddress) {
      continue;
    }

    incrementMetric(occupiedHexesByOwner, ownerAddress, 1);
  }

  return pickTopMetric(occupiedHexesByOwner);
};

const computeMostTroopsKilled = (rows: BattleKillsRow[]): GameReviewValueMetric | null => {
  const killsByPlayer = new Map<string, number>();

  for (const row of rows) {
    const attackerAddress = normalizeNonZeroAddress(row.attacker_owner_address);
    const defenderAddress = normalizeNonZeroAddress(row.defender_owner_address);

    const attackerKills = parseScaledAmount(row.defender_troops_lost);
    const defenderKills = parseScaledAmount(row.attacker_troops_lost);

    if (attackerAddress) {
      incrementMetric(killsByPlayer, attackerAddress, attackerKills);
    }

    if (defenderAddress) {
      incrementMetric(killsByPlayer, defenderAddress, defenderKills);
    }
  }

  return pickTopMetric(killsByPlayer);
};

export const fetchGameReviewMilestoneTimings = async (
  toriiSqlBaseUrl: string,
): Promise<GameReviewMilestoneTimings> => {
  try {
    const [seasonStartRows, blitzStartRows, firstT3Rows, firstHyperRows] = await Promise.all([
      queryToriiSql<StartMainRow>(
        toriiSqlBaseUrl,
        REVIEW_GAME_START_MAIN_SEASON_QUERY,
        "Failed to fetch season start timestamp",
      ),
      queryToriiSql<StartMainRow>(
        toriiSqlBaseUrl,
        REVIEW_GAME_START_MAIN_BLITZ_QUERY,
        "Failed to fetch blitz start timestamp",
      ),
      queryToriiSql<FirstMilestoneRow>(
        toriiSqlBaseUrl,
        REVIEW_FIRST_T3_CREATION_QUERY,
        "Failed to fetch first T3 creation timestamp",
      ),
      queryToriiSql<FirstMilestoneRow>(
        toriiSqlBaseUrl,
        REVIEW_FIRST_HYPERSTRUCTURE_CLAIM_QUERY,
        "Failed to fetch first hyperstructure claim timestamp",
      ),
    ]);

    const gameStartAt = parseBigIntValue(seasonStartRows[0]?.start_main_at) ?? parseBigIntValue(blitzStartRows[0]?.start_main_at);

    return {
      timeToFirstT3Seconds: buildFirstMilestoneMetric({
        gameStartAt,
        row: firstT3Rows[0],
      }),
      timeToFirstHyperstructureSeconds: buildFirstMilestoneMetric({
        gameStartAt,
        row: firstHyperRows[0],
      }),
    };
  } catch {
    return {
      timeToFirstT3Seconds: null,
      timeToFirstHyperstructureSeconds: null,
    };
  }
};

export const fetchFirstBloodMetric = async (toriiSqlBaseUrl: string): Promise<GameReviewValueMetric | null> => {
  try {
    const [seasonStartRows, blitzStartRows, firstBloodRows] = await Promise.all([
      queryToriiSql<StartMainRow>(
        toriiSqlBaseUrl,
        REVIEW_GAME_START_MAIN_SEASON_QUERY,
        "Failed to fetch season start timestamp",
      ),
      queryToriiSql<StartMainRow>(
        toriiSqlBaseUrl,
        REVIEW_GAME_START_MAIN_BLITZ_QUERY,
        "Failed to fetch blitz start timestamp",
      ),
      queryToriiSql<FirstBloodRow>(
        toriiSqlBaseUrl,
        REVIEW_FIRST_BLOOD_REALM_CAPTURE_QUERY,
        "Failed to fetch first blood realm capture",
      ),
    ]);

    const gameStartAt = parseBigIntValue(seasonStartRows[0]?.start_main_at) ?? parseBigIntValue(blitzStartRows[0]?.start_main_at);
    const capturedAt = parseBigIntValue(firstBloodRows[0]?.captured_at);
    const attackerOwnerAddress = normalizeNonZeroAddress(firstBloodRows[0]?.attacker_owner_address);
    const elapsedSeconds = elapsedSecondsSince(gameStartAt, capturedAt);

    if (elapsedSeconds == null || !attackerOwnerAddress) {
      return null;
    }

    const timestamp = capturedAt == null ? undefined : Number(capturedAt);

    return {
      playerAddress: attackerOwnerAddress,
      value: elapsedSeconds,
      timestamp: Number.isFinite(timestamp) ? timestamp : undefined,
    };
  } catch {
    return null;
  }
};

export const fetchBiggestArmyCreatedMetric = async (
  toriiSqlBaseUrl: string,
): Promise<GameReviewBiggestArmyMetric | null> => {
  try {
    const creationRows = await queryToriiSql<ExplorerCreationRow>(
      toriiSqlBaseUrl,
      REVIEW_EXPLORER_CREATIONS_QUERY,
      "Failed to fetch explorer creation events",
    );
    return computeBiggestArmyCreated(creationRows);
  } catch {
    return null;
  }
};

export const fetchBiggestStructuresOwnedMetric = async (
  toriiSqlBaseUrl: string,
): Promise<GameReviewValueMetric | null> => {
  try {
    const structureRows = await queryToriiSql<StructureOwnerRow>(
      toriiSqlBaseUrl,
      REVIEW_STRUCTURE_OWNERS_QUERY,
      "Failed to fetch structures",
    );
    const { ownerStructureCounts } = buildStructureOwnerLookup(structureRows);
    return pickTopMetric(ownerStructureCounts);
  } catch {
    return null;
  }
};

export const fetchBiggestHexesOccupiedMetric = async (
  toriiSqlBaseUrl: string,
): Promise<GameReviewValueMetric | null> => {
  try {
    const sqlClient = new SqlApi(toriiSqlBaseUrl);
    const [structureRows, explorerRows, tiles] = await Promise.all([
      queryToriiSql<StructureOwnerRow>(toriiSqlBaseUrl, REVIEW_STRUCTURE_OWNERS_QUERY, "Failed to fetch structures"),
      queryToriiSql<ExplorerOwnerRow>(toriiSqlBaseUrl, REVIEW_EXPLORER_OWNERS_QUERY, "Failed to fetch explorers"),
      sqlClient.fetchAllTiles() as Promise<OccupiedTileRow[]>,
    ]);

    const { structureOwnerByEntityId } = buildStructureOwnerLookup(structureRows);
    const ownerStructureByExplorerId = buildExplorerOwnerLookup(explorerRows);
    return computeBiggestHexesOccupied({
      tiles,
      structureOwnerByEntityId,
      ownerStructureByExplorerId,
    });
  } catch {
    return null;
  }
};

export const fetchGameReviewCompetitiveMetrics = async (
  toriiSqlBaseUrl: string,
): Promise<GameReviewCompetitiveMetrics> => {
  try {
    const [structureRowsResult, battleKillsRowsResult] = await Promise.allSettled([
      queryToriiSql<StructureOwnerRow>(toriiSqlBaseUrl, REVIEW_STRUCTURE_OWNERS_QUERY, "Failed to fetch structures"),
      queryToriiSql<BattleKillsRow>(
        toriiSqlBaseUrl,
        REVIEW_BATTLE_KILLS_QUERY,
        "Failed to fetch battle kill metrics",
      ),
    ]);

    const structureRows = structureRowsResult.status === "fulfilled" ? structureRowsResult.value : [];
    const battleKillsRows = battleKillsRowsResult.status === "fulfilled" ? battleKillsRowsResult.value : [];

    const { ownerStructureCounts } = buildStructureOwnerLookup(structureRows);
    const biggestStructuresOwned = pickTopMetric(ownerStructureCounts);
    const mostTroopsKilled = computeMostTroopsKilled(battleKillsRows);

    return {
      mostTroopsKilled,
      biggestStructuresOwned,
    };
  } catch {
    return {
      ...EMPTY_COMPETITIVE_METRICS,
    };
  }
};
