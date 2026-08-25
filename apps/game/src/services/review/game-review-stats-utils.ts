import { appchainModel } from "@/dojo/game-scope";
import {
  normalizeNonZeroAddress,
  parseBigIntValue,
  parseInteger,
  parseNumeric,
  parseScaledAmount,
  queryToriiSql,
} from "./sql-parse-utils";

/**
 * Review stat reads on the shared appchain worlds: every per-game model row
 * leads with `game_id`, so each query names the s2 table explicitly and
 * carries the REVIEWED game's id — never the ambient bootstrap scope.
 */

// s2: the game clock lives on the game's GameRegistry row.
const buildReviewGameStartQuery = (gameId: number) => `
  SELECT start_main_at
  FROM "${appchainModel("GameRegistry")}"
  WHERE game_id = ${gameId}
  LIMIT 1;
`;

const buildReviewFirstT3CreationQuery = (gameId: number) => `
  SELECT
    timestamp AS first_at,
    "owner.Some" AS owner_address
  FROM "${appchainModel("StoryEvent")}"
  WHERE game_id = ${gameId}
    AND story = 'ExplorerCreateStory'
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

const buildReviewFirstHyperstructureClaimQuery = (gameId: number) => `
  SELECT
    timestamp AS first_at,
    "story.BattleStory.attacker_owner_address" AS owner_address
  FROM "${appchainModel("StoryEvent")}"
  WHERE game_id = ${gameId}
    AND story = 'BattleStory'
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

const buildReviewFirstBloodRealmCaptureQuery = (gameId: number) => `
  SELECT
    timestamp AS captured_at,
    "story.BattleStory.attacker_owner_address" AS attacker_owner_address
  FROM "${appchainModel("StoryEvent")}"
  WHERE game_id = ${gameId}
    AND story = 'BattleStory'
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

const buildReviewStructureOwnersQuery = (gameId: number) => `
  SELECT entity_id, owner
  FROM "${appchainModel("Structure")}"
  WHERE game_id = ${gameId};
`;

const buildReviewBattleKillsQuery = (gameId: number) => `
  SELECT
    "story.BattleStory.attacker_owner_address" AS attacker_owner_address,
    "story.BattleStory.defender_owner_address" AS defender_owner_address,
    "story.BattleStory.attacker_troops_lost" AS attacker_troops_lost,
    "story.BattleStory.defender_troops_lost" AS defender_troops_lost
  FROM "${appchainModel("StoryEvent")}"
  WHERE game_id = ${gameId}
    AND story = 'BattleStory';
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

interface StructureOwnerRow {
  entity_id?: unknown;
  owner?: unknown;
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

interface GameReviewMilestoneTimings {
  timeToFirstT3Seconds: GameReviewValueMetric | null;
  timeToFirstHyperstructureSeconds: GameReviewValueMetric | null;
}

interface GameReviewCompetitiveMetrics {
  mostTroopsKilled: GameReviewValueMetric | null;
  biggestStructuresOwned: GameReviewValueMetric | null;
}

const EMPTY_COMPETITIVE_METRICS: GameReviewCompetitiveMetrics = {
  mostTroopsKilled: null,
  biggestStructuresOwned: null,
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
  gameId: number,
): Promise<GameReviewMilestoneTimings> => {
  try {
    const [startRows, firstT3Rows, firstHyperRows] = await Promise.all([
      queryToriiSql<StartMainRow>(
        toriiSqlBaseUrl,
        buildReviewGameStartQuery(gameId),
        "Failed to fetch game start timestamp",
      ),
      queryToriiSql<FirstMilestoneRow>(
        toriiSqlBaseUrl,
        buildReviewFirstT3CreationQuery(gameId),
        "Failed to fetch first T3 creation timestamp",
      ),
      queryToriiSql<FirstMilestoneRow>(
        toriiSqlBaseUrl,
        buildReviewFirstHyperstructureClaimQuery(gameId),
        "Failed to fetch first hyperstructure claim timestamp",
      ),
    ]);

    const gameStartAt = parseBigIntValue(startRows[0]?.start_main_at);

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

export const fetchFirstBloodMetric = async (
  toriiSqlBaseUrl: string,
  gameId: number,
): Promise<GameReviewValueMetric | null> => {
  try {
    const [startRows, firstBloodRows] = await Promise.all([
      queryToriiSql<StartMainRow>(
        toriiSqlBaseUrl,
        buildReviewGameStartQuery(gameId),
        "Failed to fetch game start timestamp",
      ),
      queryToriiSql<FirstBloodRow>(
        toriiSqlBaseUrl,
        buildReviewFirstBloodRealmCaptureQuery(gameId),
        "Failed to fetch first blood realm capture",
      ),
    ]);

    const gameStartAt = parseBigIntValue(startRows[0]?.start_main_at);
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

export const fetchGameReviewCompetitiveMetrics = async (
  toriiSqlBaseUrl: string,
  gameId: number,
): Promise<GameReviewCompetitiveMetrics> => {
  try {
    const [structureRowsResult, battleKillsRowsResult] = await Promise.allSettled([
      queryToriiSql<StructureOwnerRow>(
        toriiSqlBaseUrl,
        buildReviewStructureOwnersQuery(gameId),
        "Failed to fetch structures",
      ),
      queryToriiSql<BattleKillsRow>(
        toriiSqlBaseUrl,
        buildReviewBattleKillsQuery(gameId),
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
