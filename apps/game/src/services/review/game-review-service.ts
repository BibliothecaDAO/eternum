import { appchainModel, namespaceForChain } from "@/dojo/game-scope";
import { executeObservedClientTransaction } from "@/observability/observed-client-transaction";
import { buildWorldProfile, patchManifestWithFactory } from "@/runtime/world";
import { resolveGameId, resolveWorldIdForGame } from "@/runtime/world/game-registry";
import { getWorldById } from "@/runtime/world/world-directory";
import {
  fetchLandingLeaderboard,
  fetchLandingLeaderboardEntryByAddress,
  type LandingLeaderboardEntry,
} from "@/services/leaderboard/landing-leaderboard-service";
import { buildSettledBlitzPlayersQuery } from "@/services/blitz/blitz-settlement-sql";
import { commitAndClaimMMR } from "@/ui/features/prize/utils/mmr-utils";
import { tileDataToTile } from "@bibliothecadao/types";
import {
  normalizeNonZeroAddress,
  parseAddress,
  parseBigIntValue,
  parseBoolean,
  parseInteger,
  parseNumeric,
  parseScaledAmount,
  parseTroopTier,
  queryToriiSql,
} from "./sql-parse-utils";
import type { GameChain as Chain } from "@realms-world/chain";
import { getGameManifest } from "@contracts";
import { getContractByName } from "@dojoengine/core";
import { Account, AccountInterface, Call, hash } from "starknet";

import { env } from "../../../env";
import {
  fetchFirstBloodMetric,
  fetchGameReviewCompetitiveMetrics,
  fetchGameReviewMilestoneTimings,
  type GameReviewValueMetric,
} from "./game-review-stats-utils";
import { estimateClaimableChests } from "./chest-reward-estimate";

const RANKING_BATCH_SIZE = 200;
const LEADERBOARD_FETCH_LIMIT = 1000;
const MAX_MAP_SNAPSHOT_TILES = 4200;
const LORDS_TOKEN_DECIMALS = 18;
const CLAIM_ALL_REWARDS_BATCH_SIZE = 200;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * Post-game review reads on the shared appchain worlds. Several games live in
 * one world behind one torii, and every per-game model row leads with
 * `game_id` — so every query below names the s2 table explicitly and carries
 * the REVIEWED game's id. The ambient bootstrap scope is never used here:
 * reviews target non-active games from the landing. Chain singletons
 * (ChainConfig) and torii-internal tables (`transactions`) have no game id.
 */

const buildReviewBattleAndCreationQuery = (gameId: number) => `
  SELECT
    story,
    "story.BattleStory.attacker_troops_lost" AS battle_attacker_troops_lost,
    "story.BattleStory.defender_troops_lost" AS battle_defender_troops_lost,
    "story.ExplorerCreateStory.tier" AS explorer_create_tier,
    "story.ExplorerCreateStory.amount" AS explorer_create_amount
  FROM "${appchainModel("StoryEvent")}"
  WHERE game_id = ${gameId}
    AND story IN ('BattleStory', 'ExplorerCreateStory');
`;

const buildReviewPlayersRankFinalQuery = (gameId: number) => `
  SELECT trial_id
  FROM "${appchainModel("PlayersRankFinal")}"
  WHERE game_id = ${gameId}
    AND trial_id > 0
  ORDER BY trial_id DESC
  LIMIT 1;
`;

const buildReviewMmrMetaQuery = (gameId: number) => `
  SELECT game_median
  FROM "${appchainModel("MMRGameMeta")}"
  WHERE game_id = ${gameId}
  LIMIT 1;
`;

// Chain-global singleton: MMR config lives on ChainConfig (no game_id key).
const REVIEW_MMR_CONFIG_QUERY = `
  SELECT
    "mmr_config.enabled" AS mmr_enabled,
    "mmr_config.min_players" AS mmr_min_players,
    "mmr_config.mmr_token_address" AS mmr_token_address
  FROM "${appchainModel("ChainConfig")}"
  LIMIT 1;
`;

// Season clock and dev mode live on the game's GameRegistry row; the
// registration count on its WorldConfig row; the loot chest collection on the
// chain-global ChainConfig singleton.
const buildReviewSeasonTimingQuery = (gameId: number) => `
  SELECT
    gr.dev_mode_on AS dev_mode_on,
    gr.end_at AS season_end_at,
    gr.registration_grace_seconds AS registration_grace_seconds,
    wc."blitz_registration_config.registration_count" AS registration_count,
    (SELECT collectibles_lootchest_address FROM "${appchainModel("ChainConfig")}" LIMIT 1) AS loot_chest_address
  FROM "${appchainModel("GameRegistry")}" gr
  LEFT JOIN "${appchainModel("WorldConfig")}" wc
    ON wc.game_id = gr.game_id
  WHERE gr.game_id = ${gameId}
  LIMIT 1;
`;

// Torii-internal table without a game linkage: on the shared world this counts
// the WHOLE world's transactions, not just the reviewed game's.
const REVIEW_TRANSACTIONS_COUNT_QUERY = `
  SELECT COUNT(*) AS transaction_count
  FROM transactions;
`;

const buildReviewGameChestRewardQuery = (gameId: number) => `
  SELECT
    allocated_chests,
    distributed_chests
  FROM "${appchainModel("GameChestReward")}"
  WHERE game_id = ${gameId}
  LIMIT 1;
`;

const buildReviewSeasonPrizeQuery = (gameId: number) => `
  SELECT total_registered_points
  FROM "${appchainModel("SeasonPrize")}"
  WHERE game_id = ${gameId}
  LIMIT 1;
`;

// s2 keys PlayerRank by (game_id, player) — there is no trial_id column; the
// final trial gating happens via PlayersRankFinal before this query runs.
const buildReviewFinalRankForPlayerQuery = (gameId: number, playerAddress: string) => `
  SELECT
    rank,
    paid
  FROM "${appchainModel("PlayerRank")}"
  WHERE game_id = ${gameId}
    AND ltrim(lower(CAST(player AS TEXT)), '0x') = ltrim(lower('${playerAddress}'), '0x')
  LIMIT 1;
`;

const buildTrialIdMatchCondition = (columnName: string, trialId: bigint): string => {
  const trialIdDecimal = trialId.toString();
  const trialIdHexNoPrefix = trialId.toString(16).toLowerCase();

  return `(
    CAST(${columnName} AS TEXT) = '${trialIdDecimal}'
    OR ltrim(lower(CAST(${columnName} AS TEXT)), '0x') = '${trialIdHexNoPrefix}'
  )`;
};

// s2 keys RankPrize by (game_id, rank) — the trial id only keyed legacy worlds.
const buildReviewRankPrizeQuery = (gameId: number, rank: number) => `
  SELECT
    total_players_same_rank_count,
    total_prize_amount,
    grant_elite_nft
  FROM "${appchainModel("RankPrize")}"
  WHERE game_id = ${gameId}
    AND rank = '${rank}'
  LIMIT 1;
`;

// s2 keys PlayersRankTrial by (game_id, nonce); the nonce IS the trial id.
const buildReviewRankTrialQuery = (gameId: number, trialId: bigint) => `
  SELECT total_player_count_committed
  FROM "${appchainModel("PlayersRankTrial")}"
  WHERE game_id = ${gameId}
    AND ${buildTrialIdMatchCondition("nonce", trialId)}
  LIMIT 1;
`;

const buildReviewRegisteredPointsQuery = (gameId: number, playerAddress: string) => `
  SELECT
    registered_points,
    prize_claimed
  FROM "${appchainModel("PlayerRegisteredPoints")}"
  WHERE game_id = ${gameId}
    AND ltrim(lower(CAST(address AS TEXT)), '0x') = ltrim(lower('${playerAddress}'), '0x')
  LIMIT 1;
`;

const buildRankedPlayersByPointsQuery = (gameId: number) => `
  SELECT
    address AS player,
    registered_points
  FROM "${appchainModel("PlayerRegisteredPoints")}"
  WHERE game_id = ${gameId}
    AND address IS NOT NULL
    AND trim(CAST(address AS TEXT)) != ''
  ORDER BY registered_points DESC
  LIMIT ${LEADERBOARD_FETCH_LIMIT};
`;

const buildReviewTilesQuery = (gameId: number) => `
  SELECT DISTINCT data
  FROM "${appchainModel("TileOpt")}"
  WHERE game_id = ${gameId}
  ORDER BY alt, col, row;
`;

interface ReviewGameContext {
  toriiSqlBaseUrl: string;
  gameId: number;
}

/**
 * Resolve which directory world owns a reviewed game and the game's registry
 * id. Routes and entry contexts only carry (chain, worldName); the owning
 * world and game id are recovered from the worlds' GameRegistry rows.
 */
const resolveReviewGameContext = async (worldName: string): Promise<ReviewGameContext> => {
  const worldId = await resolveWorldIdForGame(worldName);
  const world = getWorldById(worldId);
  if (!world) {
    throw new Error(`Game "${worldName}" was not found in any appchain world's GameRegistry.`);
  }

  const gameId = await resolveGameId(worldName, world.id);
  if (!gameId || gameId <= 0) {
    throw new Error(`Game "${worldName}" has no registry id in the ${world.id} world.`);
  }

  return {
    toriiSqlBaseUrl: `${world.toriiBaseUrl}/sql`,
    gameId,
  };
};

const formatTokenAmount = (amount: bigint, decimals: number): string => {
  const s = amount.toString();
  const pad = decimals - s.length;
  const whole = pad >= 0 ? "0" : s.slice(0, s.length - decimals);
  const fracRaw = pad >= 0 ? "0".repeat(pad) + s : s.slice(s.length - decimals);
  const wholeFmt = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = fracRaw.replace(/0+$/, "");
  return frac.length > 0 ? `${wholeFmt}.${frac}` : wholeFmt;
};

const uniqueAddresses = (addresses: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const candidate of addresses) {
    if (!candidate) continue;
    const normalized = parseAddress(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
};

const randomTrialId = () =>
  BigInt(`0x${(globalThis.crypto?.randomUUID?.().replace(/-/g, "") || Date.now().toString(16)).slice(0, 31)}`);

const chunk = <T>(items: T[], chunkSize: number): T[][] => {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    out.push(items.slice(index, index + chunkSize));
  }
  return out;
};

interface StoryStatRow {
  story?: string;
  battle_attacker_troops_lost?: unknown;
  battle_defender_troops_lost?: unknown;
  explorer_create_tier?: unknown;
  explorer_create_amount?: unknown;
}

interface RegisteredPlayerRow {
  player?: unknown;
}

interface RankFinalRow {
  trial_id?: unknown;
}

interface PlayerFinalRankRow {
  rank?: unknown;
  paid?: unknown;
}

interface RankedPlayerPointsRow {
  player?: unknown;
  registered_points?: unknown;
}

interface ReviewTileRow {
  data?: unknown;
}

interface MmrMetaRow {
  game_median?: unknown;
}

interface MmrConfigRow {
  mmr_enabled?: unknown;
  mmr_min_players?: unknown;
  mmr_token_address?: unknown;
}

interface SeasonTimingRow {
  dev_mode_on?: unknown;
  season_end_at?: unknown;
  registration_grace_seconds?: unknown;
  registration_count?: unknown;
  loot_chest_address?: unknown;
}

interface RankPrizeRow {
  total_players_same_rank_count?: unknown;
  total_prize_amount?: unknown;
  grant_elite_nft?: unknown;
}

interface RankTrialRow {
  total_player_count_committed?: unknown;
}

interface GameChestRewardRow {
  allocated_chests?: unknown;
  distributed_chests?: unknown;
}

interface SeasonPrizeRow {
  total_registered_points?: unknown;
}

interface PlayerRegisteredPointsRow {
  registered_points?: unknown;
  prize_claimed?: unknown;
}

interface TransactionsCountRow {
  transaction_count?: unknown;
}

interface ReviewFinalizationMeta {
  registeredPlayers: string[];
  registrationCount: number;
  lootChestAddress: string | null;
  finalTrialId: bigint | null;
  rankingFinalized: boolean;
  devModeOn: boolean;
  mmrCommitted: boolean;
  mmrEnabled: boolean;
  mmrMinPlayers: number;
  mmrTokenAddress: string | null;
  seasonEndAt: number | null;
  registrationGraceSeconds: number;
  scoreSubmissionOpensAt: number | null;
}

export interface GameReviewStats {
  numberOfPlayers: number;
  totalTransactions: number;
  totalTilesExplored: number;
  totalCampsTaken: number;
  totalEssenceRiftsTaken: number;
  totalHyperstructuresTaken: number;
  totalDeadTroops: number;
  totalT1TroopsCreated: number;
  totalT2TroopsCreated: number;
  totalT3TroopsCreated: number;
  timeToFirstT3Seconds: GameReviewValueMetric | null;
  timeToFirstHyperstructureSeconds: GameReviewValueMetric | null;
  firstBlood: GameReviewValueMetric | null;
  highestExploredTiles: GameReviewValueMetric | null;
  mostTroopsKilled: GameReviewValueMetric | null;
  biggestStructuresOwned: GameReviewValueMetric | null;
}

export interface GameReviewMapSnapshotTile {
  col: number;
  row: number;
  biome: number;
  hasOccupier: boolean;
  occupierType: number;
  occupierIsStructure: boolean;
}

export type GameReviewMapSnapshot =
  | {
      available: true;
      tiles: GameReviewMapSnapshotTile[];
      bounds: {
        minCol: number;
        maxCol: number;
        minRow: number;
        maxRow: number;
      };
      totalTiles: number;
      sampledTiles: number;
      fingerprintBiome: string;
      fingerprintOccupier: string;
    }
  | {
      available: false;
      reason: string;
    };

export interface GameReviewRewards {
  scoreSubmitted: boolean;
  isRanked: boolean;
  canProceedWithoutClaim: boolean;
  canClaimNow: boolean;
  alreadyClaimed: boolean;
  claimBlockedReason: string | null;
  lordsWonRaw: bigint;
  lordsWonFormatted: string;
  chestsClaimedEstimate: number;
  chestsClaimedReason: string;
  eliteTicketEarned: boolean;
  eliteTicketReason: string;
}

export interface GameReviewData {
  worldName: string;
  chain: Chain;
  topPlayers: LandingLeaderboardEntry[];
  leaderboard: LandingLeaderboardEntry[];
  personalScore: LandingLeaderboardEntry | null;
  isParticipant: boolean;
  stats: GameReviewStats;
  mapSnapshot: GameReviewMapSnapshot;
  finalization: ReviewFinalizationMeta;
  rewards: GameReviewRewards | null;
}

export interface GameReviewClaimSummary {
  canClaimNow: boolean;
  alreadyClaimed: boolean;
  lordsWonFormatted: string;
  chestsClaimedEstimate: number;
  claimBlockedReason: string | null;
}

interface FinalizeGameReviewResult {
  rankingSubmitted: boolean;
  mmrSubmitted: boolean;
  rankingSkipped: boolean;
  mmrSkipped: boolean;
  totalPlayers: number;
  mmrError: string | null;
}

interface ClaimGameReviewRewardsResult {
  claimed: boolean;
  playerAddress: string;
}

interface ClaimGameReviewRewardsForPlayersResult {
  claimed: boolean;
  claimedPlayers: number;
  playerAddresses: string[];
  batchesSubmitted: number;
}

const fetchReviewFinalizationMeta = async (
  toriiSqlBaseUrl: string,
  gameId: number,
): Promise<ReviewFinalizationMeta> => {
  const [registeredRows, rankFinalRows, mmrMetaRows, mmrConfigRows, seasonTimingRows] = await Promise.all([
    queryToriiSql<RegisteredPlayerRow>(
      toriiSqlBaseUrl,
      buildSettledBlitzPlayersQuery(gameId),
      "Failed to fetch registered players",
    ),
    queryToriiSql<RankFinalRow>(
      toriiSqlBaseUrl,
      buildReviewPlayersRankFinalQuery(gameId),
      "Failed to fetch PlayersRankFinal",
    ),
    queryToriiSql<MmrMetaRow>(toriiSqlBaseUrl, buildReviewMmrMetaQuery(gameId), "Failed to fetch MMRGameMeta"),
    queryToriiSql<MmrConfigRow>(toriiSqlBaseUrl, REVIEW_MMR_CONFIG_QUERY, "Failed to fetch MMR config"),
    queryToriiSql<SeasonTimingRow>(
      toriiSqlBaseUrl,
      buildReviewSeasonTimingQuery(gameId),
      "Failed to fetch season timing config",
    ),
  ]);

  const registeredPlayers = uniqueAddresses(registeredRows.map((row) => parseAddress(row.player)));
  const registrationCountFromConfig = Math.max(0, parseNumeric(seasonTimingRows[0]?.registration_count));
  const registrationCount =
    registrationCountFromConfig > 0
      ? registrationCountFromConfig
      : seasonTimingRows.length > 0
        ? registrationCountFromConfig
        : registeredPlayers.length;
  const finalTrialId = parseBigIntValue(rankFinalRows[0]?.trial_id);
  const rankingFinalized = finalTrialId != null && finalTrialId > 0n;
  const devModeOn = parseBoolean(seasonTimingRows[0]?.dev_mode_on);
  const mmrCommitted = parseNumeric(mmrMetaRows[0]?.game_median) > 0;

  const mmrEnabled = parseNumeric(mmrConfigRows[0]?.mmr_enabled) !== 0;
  const mmrMinPlayers = Math.max(1, parseNumeric(mmrConfigRows[0]?.mmr_min_players) || 6);
  const mmrTokenAddress = parseAddress(mmrConfigRows[0]?.mmr_token_address);
  const seasonEndAtRaw = parseNumeric(seasonTimingRows[0]?.season_end_at);
  const seasonEndAt = seasonEndAtRaw > 0 ? seasonEndAtRaw : null;
  const registrationGraceSeconds = Math.max(0, parseNumeric(seasonTimingRows[0]?.registration_grace_seconds));
  const scoreSubmissionOpensAt = seasonEndAt != null ? seasonEndAt + registrationGraceSeconds : null;
  const lootChestAddress = normalizeNonZeroAddress(seasonTimingRows[0]?.loot_chest_address);

  return {
    registeredPlayers,
    registrationCount,
    lootChestAddress,
    finalTrialId,
    rankingFinalized,
    devModeOn,
    mmrCommitted,
    mmrEnabled,
    mmrMinPlayers,
    mmrTokenAddress,
    seasonEndAt,
    registrationGraceSeconds,
    scoreSubmissionOpensAt,
  };
};

const fetchStoryStats = async (
  toriiSqlBaseUrl: string,
  gameId: number,
): Promise<
  Pick<GameReviewStats, "totalDeadTroops" | "totalT1TroopsCreated" | "totalT2TroopsCreated" | "totalT3TroopsCreated">
> => {
  const rows = await queryToriiSql<StoryStatRow>(
    toriiSqlBaseUrl,
    buildReviewBattleAndCreationQuery(gameId),
    "Failed to fetch review story stats",
  );

  let totalDeadTroops = 0;
  let totalT1TroopsCreated = 0;
  let totalT2TroopsCreated = 0;
  let totalT3TroopsCreated = 0;

  const numericTiers = rows
    .map((row) => parseInteger(row.explorer_create_tier))
    .filter((tier): tier is number => tier !== null);
  const usesZeroBasedTierEncoding = numericTiers.includes(0);

  for (const row of rows) {
    const storyType = typeof row.story === "string" ? row.story : null;

    if (storyType === "BattleStory") {
      totalDeadTroops +=
        parseScaledAmount(row.battle_attacker_troops_lost) + parseScaledAmount(row.battle_defender_troops_lost);
      continue;
    }

    if (storyType === "ExplorerCreateStory") {
      const troopTier = parseTroopTier(row.explorer_create_tier, usesZeroBasedTierEncoding);
      const troopAmount = parseScaledAmount(row.explorer_create_amount);

      if (troopTier === 1) totalT1TroopsCreated += troopAmount;
      if (troopTier === 2) totalT2TroopsCreated += troopAmount;
      if (troopTier === 3) totalT3TroopsCreated += troopAmount;
    }
  }

  return {
    totalDeadTroops,
    totalT1TroopsCreated,
    totalT2TroopsCreated,
    totalT3TroopsCreated,
  };
};

const fetchTransactionsCount = async (toriiSqlBaseUrl: string): Promise<number> => {
  try {
    const rows = await queryToriiSql<TransactionsCountRow>(
      toriiSqlBaseUrl,
      REVIEW_TRANSACTIONS_COUNT_QUERY,
      "Failed to fetch transactions count",
    );

    return parseNumeric(rows[0]?.transaction_count);
  } catch {
    return 0;
  }
};

const fnv1aUpdate = (hash: number, chunk: string): number => {
  let next = hash >>> 0;
  for (let index = 0; index < chunk.length; index += 1) {
    next ^= chunk.charCodeAt(index);
    next = Math.imul(next, FNV_PRIME) >>> 0;
  }
  return next >>> 0;
};

const formatFingerprint = (left: number, right: number): string => {
  const hex =
    `${(left >>> 0).toString(16).padStart(8, "0")}${(right >>> 0).toString(16).padStart(8, "0")}`.toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
};

const sortMapSnapshotTiles = (tiles: GameReviewMapSnapshotTile[]): GameReviewMapSnapshotTile[] => {
  return tiles.toSorted((left, right) => {
    if (left.row !== right.row) return left.row - right.row;
    if (left.col !== right.col) return left.col - right.col;
    if (left.biome !== right.biome) return left.biome - right.biome;
    if (left.hasOccupier !== right.hasOccupier) return Number(left.hasOccupier) - Number(right.hasOccupier);
    if (left.occupierType !== right.occupierType) return left.occupierType - right.occupierType;
    if (left.occupierIsStructure !== right.occupierIsStructure) {
      return Number(left.occupierIsStructure) - Number(right.occupierIsStructure);
    }
    return 0;
  });
};

const sampleMapSnapshotTiles = (tiles: GameReviewMapSnapshotTile[]): GameReviewMapSnapshotTile[] => {
  if (tiles.length <= MAX_MAP_SNAPSHOT_TILES) {
    return tiles;
  }

  const samplingStep = Math.ceil(tiles.length / MAX_MAP_SNAPSHOT_TILES);
  return tiles.filter((_, index) => index % samplingStep === 0);
};

const fetchMapSnapshot = async (toriiSqlBaseUrl: string, gameId: number): Promise<GameReviewMapSnapshot> => {
  try {
    const tileRows = await queryToriiSql<ReviewTileRow>(
      toriiSqlBaseUrl,
      buildReviewTilesQuery(gameId),
      "Failed to fetch map tiles",
    );
    const rawTiles = tileRows
      .filter((row) => row.data != null)
      .map((row) => tileDataToTile(row.data as string | number | bigint));

    if (!Array.isArray(rawTiles) || rawTiles.length === 0) {
      return {
        available: false,
        reason: "Map snapshot unavailable.",
      };
    }

    const normalizedTiles = rawTiles.map((tile) => {
      const col = Math.trunc(parseNumeric(tile.col));
      const row = Math.trunc(parseNumeric(tile.row));
      const biome = Math.trunc(parseNumeric(tile.biome));
      const occupierId = parseNumeric(tile.occupier_id);
      const occupierType = Math.trunc(parseNumeric(tile.occupier_type));

      return {
        col,
        row,
        biome,
        hasOccupier: occupierId > 0,
        occupierType,
        occupierIsStructure: Boolean(tile.occupier_is_structure),
      } satisfies GameReviewMapSnapshotTile;
    });

    if (normalizedTiles.length === 0) {
      return {
        available: false,
        reason: "Map snapshot unavailable.",
      };
    }

    const sortedTiles = sortMapSnapshotTiles(normalizedTiles);

    let minCol = Number.POSITIVE_INFINITY;
    let maxCol = Number.NEGATIVE_INFINITY;
    let minRow = Number.POSITIVE_INFINITY;
    let maxRow = Number.NEGATIVE_INFINITY;
    let biomeHash = FNV_OFFSET_BASIS;
    let occupierHash = FNV_OFFSET_BASIS;

    for (const tile of sortedTiles) {
      minCol = Math.min(minCol, tile.col);
      maxCol = Math.max(maxCol, tile.col);
      minRow = Math.min(minRow, tile.row);
      maxRow = Math.max(maxRow, tile.row);

      const baseChunk = `${tile.col}:${tile.row}:${tile.biome};`;
      biomeHash = fnv1aUpdate(biomeHash, baseChunk);

      const occupierChunk = tile.hasOccupier
        ? `${baseChunk}1:${tile.occupierType}:${tile.occupierIsStructure ? 1 : 0};`
        : `${baseChunk}0;`;
      occupierHash = fnv1aUpdate(occupierHash, occupierChunk);
    }

    const biomeTail = fnv1aUpdate(biomeHash, `tiles:${sortedTiles.length};`);
    const occupierTail = fnv1aUpdate(occupierHash, `tiles:${sortedTiles.length};`);

    const sampledTiles = sampleMapSnapshotTiles(sortedTiles);

    return {
      available: true,
      tiles: sampledTiles,
      bounds: {
        minCol: Number.isFinite(minCol) ? minCol : 0,
        maxCol: Number.isFinite(maxCol) ? maxCol : 0,
        minRow: Number.isFinite(minRow) ? minRow : 0,
        maxRow: Number.isFinite(maxRow) ? maxRow : 0,
      },
      totalTiles: sortedTiles.length,
      sampledTiles: sampledTiles.length,
      fingerprintBiome: formatFingerprint(biomeHash, biomeTail),
      fingerprintOccupier: formatFingerprint(occupierHash, occupierTail),
    };
  } catch {
    return {
      available: false,
      reason: "Map snapshot unavailable.",
    };
  }
};

const sumLeaderboardMetric = (
  rows: LandingLeaderboardEntry[],
  key:
    | "exploredTiles"
    | "campsTaken"
    | "riftsTaken"
    | "hyperstructuresConquered"
    | "relicCratesOpened"
    | "hyperstructuresHeld",
): number => {
  return rows.reduce((total, row) => total + parseNumeric(row[key]), 0);
};

const getHighestExploredTilesMetric = (rows: LandingLeaderboardEntry[]): GameReviewValueMetric | null => {
  let topPlayerAddress: string | null = null;
  let topValue = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    const playerAddress = parseAddress(row.address);
    if (!playerAddress) {
      continue;
    }

    const exploredTiles = parseNumeric(row.exploredTiles);
    if (!Number.isFinite(exploredTiles) || exploredTiles < 0) {
      continue;
    }

    if (
      topPlayerAddress == null ||
      exploredTiles > topValue ||
      (exploredTiles === topValue && playerAddress.localeCompare(topPlayerAddress) < 0)
    ) {
      topPlayerAddress = playerAddress;
      topValue = exploredTiles;
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

// Ordering matters: rank submission ranks players by registered points desc.
// Points are stored as padded hex text, so re-sort client-side as bigints.
const fetchRankedPlayersForSubmission = async (toriiSqlBaseUrl: string, gameId: number): Promise<string[]> => {
  const rows = await queryToriiSql<RankedPlayerPointsRow>(
    toriiSqlBaseUrl,
    buildRankedPlayersByPointsQuery(gameId),
    "Failed to fetch registered player points",
  );

  const ordered = rows
    .map((row) => ({
      address: parseAddress(row.player),
      points: parseBigIntValue(row.registered_points) ?? 0n,
    }))
    .filter((row): row is { address: string; points: bigint } => row.address != null)
    .toSorted((left, right) => (left.points === right.points ? 0 : left.points < right.points ? 1 : -1));

  return uniqueAddresses(ordered.map((row) => row.address));
};

const buildEliteTicketReason = ({
  eligible,
  playerRank,
  totalCommittedPlayers,
}: {
  eligible: boolean;
  playerRank: number | null;
  totalCommittedPlayers: number;
}): string => {
  if (playerRank == null || playerRank <= 0) {
    return "Player is not ranked in the final results.";
  }

  const totalPlayers = Math.max(0, totalCommittedPlayers);
  if (totalPlayers <= 0) {
    return eligible
      ? "Elite ticket is granted for this rank."
      : "Elite ticket eligibility cannot be computed until rankings are finalized.";
  }

  if (totalPlayers <= 132) {
    const cutoff = Math.floor(totalPlayers / 2);
    if (eligible) {
      return `Eligible: rank #${playerRank} is within the top ${cutoff} ranks for ${totalPlayers} players.`;
    }
    return `Not eligible: elite ticket cutoff is rank #${cutoff} for ${totalPlayers} players (you are #${playerRank}).`;
  }

  const cutoff = 66;
  if (eligible) {
    return `Eligible: rank #${playerRank} is within the top ${cutoff} ranks.`;
  }
  return `Not eligible: elite ticket cutoff is rank #${cutoff} (you are #${playerRank}).`;
};

const parseChestCount = (value: unknown): number => Math.max(0, Math.trunc(parseNumeric(value)));

const fetchReviewRewards = async ({
  toriiSqlBaseUrl,
  gameId,
  playerAddress,
  finalization,
  personalScore,
}: {
  toriiSqlBaseUrl: string;
  gameId: number;
  playerAddress: string;
  finalization: ReviewFinalizationMeta;
  personalScore: LandingLeaderboardEntry | null;
}): Promise<GameReviewRewards> => {
  const [playerPointsRows, chestRows, seasonRows] = await Promise.all([
    queryToriiSql<PlayerRegisteredPointsRow>(
      toriiSqlBaseUrl,
      buildReviewRegisteredPointsQuery(gameId, playerAddress),
      "Failed to fetch player registered points",
    ),
    queryToriiSql<GameChestRewardRow>(
      toriiSqlBaseUrl,
      buildReviewGameChestRewardQuery(gameId),
      "Failed to fetch game chest reward state",
    ),
    queryToriiSql<SeasonPrizeRow>(
      toriiSqlBaseUrl,
      buildReviewSeasonPrizeQuery(gameId),
      "Failed to fetch season prize state",
    ),
  ]);

  const playerRegisteredPoints = parseBigIntValue(playerPointsRows[0]?.registered_points) ?? 0n;
  const playerPrizeClaimed = parseBoolean(playerPointsRows[0]?.prize_claimed);
  const allocatedChests = parseChestCount(chestRows[0]?.allocated_chests);
  const distributedChests = parseChestCount(chestRows[0]?.distributed_chests);
  const totalRegisteredPoints = parseBigIntValue(seasonRows[0]?.total_registered_points) ?? 0n;
  const chestEstimate = estimateClaimableChests({
    lootChestAddress: finalization.lootChestAddress,
    allocatedChests,
    distributedChests,
    playerRegisteredPoints,
    totalRegisteredPoints,
  });
  const chestsClaimedEstimate = chestEstimate.count;
  const chestsClaimedReason = chestEstimate.reason;

  if (!finalization.rankingFinalized || finalization.finalTrialId == null) {
    return {
      scoreSubmitted: false,
      isRanked: false,
      canProceedWithoutClaim: false,
      canClaimNow: false,
      alreadyClaimed: false,
      claimBlockedReason: "Submit score first to unlock rewards.",
      lordsWonRaw: 0n,
      lordsWonFormatted: formatTokenAmount(0n, LORDS_TOKEN_DECIMALS),
      chestsClaimedEstimate,
      chestsClaimedReason,
      eliteTicketEarned: false,
      eliteTicketReason: "Submit score and finalize rankings to evaluate elite ticket eligibility.",
    };
  }

  const playerRankRows = await queryToriiSql<PlayerFinalRankRow>(
    toriiSqlBaseUrl,
    buildReviewFinalRankForPlayerQuery(gameId, playerAddress),
    "Failed to fetch player final rank",
  );

  const playerRankFromModel = parseInteger(playerRankRows[0]?.rank);
  const playerRankFromLeaderboard =
    typeof personalScore?.rank === "number" && Number.isFinite(personalScore.rank) && personalScore.rank > 0
      ? Math.trunc(personalScore.rank)
      : null;
  const playerRank =
    playerRankFromModel != null && playerRankFromModel > 0 ? playerRankFromModel : playerRankFromLeaderboard;
  const paid = parseBoolean(playerRankRows[0]?.paid) || playerPrizeClaimed || Boolean(personalScore?.prizeClaimed);
  const finalTrialId = finalization.finalTrialId;

  if (playerRank == null || playerRank <= 0 || finalTrialId == null) {
    return {
      scoreSubmitted: true,
      isRanked: false,
      canProceedWithoutClaim: true,
      canClaimNow: false,
      alreadyClaimed: paid,
      claimBlockedReason: "This account is not ranked in the final leaderboard.",
      lordsWonRaw: 0n,
      lordsWonFormatted: formatTokenAmount(0n, LORDS_TOKEN_DECIMALS),
      chestsClaimedEstimate,
      chestsClaimedReason,
      eliteTicketEarned: false,
      eliteTicketReason: "",
    };
  }

  const [rankPrizeRows, rankTrialRows] = await Promise.all([
    queryToriiSql<RankPrizeRow>(
      toriiSqlBaseUrl,
      buildReviewRankPrizeQuery(gameId, playerRank),
      "Failed to fetch rank prize details",
    ),
    queryToriiSql<RankTrialRow>(
      toriiSqlBaseUrl,
      buildReviewRankTrialQuery(gameId, finalTrialId),
      "Failed to fetch rank trial details",
    ),
  ]);

  const totalPlayersAtRank = Math.max(0, parseNumeric(rankPrizeRows[0]?.total_players_same_rank_count));
  const totalPrizeAmount = parseBigIntValue(rankPrizeRows[0]?.total_prize_amount) ?? 0n;
  const lordsWonRaw = totalPlayersAtRank > 0 ? totalPrizeAmount / BigInt(totalPlayersAtRank) : 0n;
  const eliteTicketEarned = parseBoolean(rankPrizeRows[0]?.grant_elite_nft);
  const totalCommittedPlayers = Math.max(0, parseNumeric(rankTrialRows[0]?.total_player_count_committed));
  const eliteTicketReason = buildEliteTicketReason({
    eligible: eliteTicketEarned,
    playerRank,
    totalCommittedPlayers,
  });

  return {
    scoreSubmitted: true,
    isRanked: true,
    canProceedWithoutClaim: false,
    canClaimNow: !paid,
    alreadyClaimed: paid,
    claimBlockedReason: paid ? "Rewards already claimed." : null,
    lordsWonRaw,
    lordsWonFormatted: formatTokenAmount(lordsWonRaw, LORDS_TOKEN_DECIMALS),
    chestsClaimedEstimate,
    chestsClaimedReason,
    eliteTicketEarned,
    eliteTicketReason,
  };
};

export const fetchGameReviewData = async ({
  worldName,
  chain,
  playerAddress,
}: {
  worldName: string;
  chain: Chain;
  playerAddress: string | null;
}): Promise<GameReviewData> => {
  const { toriiSqlBaseUrl, gameId } = await resolveReviewGameContext(worldName);
  // Pin leaderboard reads to the reviewed world/game — from the landing, the
  // ambient SQL scope is still the legacy s1 default and the shared s2 torii
  // has no such tables. Keep the catch as a belt-and-braces degrade.
  const reviewScope = gameId > 0 ? { namespace: namespaceForChain(chain), gameId } : undefined;

  const [
    leaderboard,
    finalization,
    storyStats,
    transactionsCount,
    mapSnapshot,
    milestoneTimings,
    firstBlood,
    competitiveMetrics,
  ] = await Promise.all([
    fetchLandingLeaderboard(LEADERBOARD_FETCH_LIMIT, 0, toriiSqlBaseUrl, reviewScope).catch(
      () => [] as LandingLeaderboardEntry[],
    ),
    fetchReviewFinalizationMeta(toriiSqlBaseUrl, gameId),
    fetchStoryStats(toriiSqlBaseUrl, gameId),
    fetchTransactionsCount(toriiSqlBaseUrl),
    fetchMapSnapshot(toriiSqlBaseUrl, gameId),
    fetchGameReviewMilestoneTimings(toriiSqlBaseUrl, gameId),
    fetchFirstBloodMetric(toriiSqlBaseUrl, gameId),
    fetchGameReviewCompetitiveMetrics(toriiSqlBaseUrl, gameId),
  ]);

  const topPlayers = leaderboard.slice(0, 3);

  const normalizedPlayerAddress = parseAddress(playerAddress);
  let personalScore =
    normalizedPlayerAddress == null
      ? null
      : (leaderboard.find((entry) => parseAddress(entry.address) === normalizedPlayerAddress) ?? null);

  if (!personalScore && normalizedPlayerAddress) {
    personalScore = await fetchLandingLeaderboardEntryByAddress(
      normalizedPlayerAddress,
      toriiSqlBaseUrl,
      reviewScope,
    ).catch(() => null);
  }

  const isParticipant =
    normalizedPlayerAddress != null
      ? finalization.registeredPlayers.includes(normalizedPlayerAddress) || Boolean(personalScore)
      : false;

  const stats: GameReviewStats = {
    numberOfPlayers: finalization.registeredPlayers.length,
    totalTransactions: transactionsCount,
    totalTilesExplored: sumLeaderboardMetric(leaderboard, "exploredTiles"),
    totalCampsTaken: sumLeaderboardMetric(leaderboard, "campsTaken"),
    totalEssenceRiftsTaken: sumLeaderboardMetric(leaderboard, "riftsTaken"),
    totalHyperstructuresTaken: sumLeaderboardMetric(leaderboard, "hyperstructuresConquered"),
    totalDeadTroops: storyStats.totalDeadTroops,
    totalT1TroopsCreated: storyStats.totalT1TroopsCreated,
    totalT2TroopsCreated: storyStats.totalT2TroopsCreated,
    totalT3TroopsCreated: storyStats.totalT3TroopsCreated,
    timeToFirstT3Seconds: milestoneTimings.timeToFirstT3Seconds,
    timeToFirstHyperstructureSeconds: milestoneTimings.timeToFirstHyperstructureSeconds,
    firstBlood,
    highestExploredTiles: getHighestExploredTilesMetric(leaderboard),
    mostTroopsKilled: competitiveMetrics.mostTroopsKilled,
    biggestStructuresOwned: competitiveMetrics.biggestStructuresOwned,
  };

  const rewards =
    normalizedPlayerAddress == null
      ? null
      : await fetchReviewRewards({
          toriiSqlBaseUrl,
          gameId,
          playerAddress: normalizedPlayerAddress,
          finalization,
          personalScore,
        });

  return {
    worldName,
    chain,
    topPlayers,
    leaderboard,
    personalScore,
    isParticipant,
    stats,
    mapSnapshot,
    finalization,
    rewards,
  };
};

export const fetchGameReviewClaimSummary = async ({
  worldName,
  chain,
  playerAddress,
}: {
  worldName: string;
  chain: Chain;
  playerAddress: string;
}): Promise<GameReviewClaimSummary> => {
  const normalizedPlayerAddress = parseAddress(playerAddress);
  if (!normalizedPlayerAddress) {
    throw new Error("Missing player address for claim summary.");
  }

  const { toriiSqlBaseUrl, gameId } = await resolveReviewGameContext(worldName);
  const claimScope = gameId > 0 ? { namespace: namespaceForChain(chain), gameId } : undefined;
  const [finalization, personalScore] = await Promise.all([
    fetchReviewFinalizationMeta(toriiSqlBaseUrl, gameId),
    fetchLandingLeaderboardEntryByAddress(normalizedPlayerAddress, toriiSqlBaseUrl, claimScope).catch(() => null),
  ]);

  const rewards = await fetchReviewRewards({
    toriiSqlBaseUrl,
    gameId,
    playerAddress: normalizedPlayerAddress,
    finalization,
    personalScore,
  });

  return {
    canClaimNow: rewards.canClaimNow,
    alreadyClaimed: rewards.alreadyClaimed,
    lordsWonFormatted: rewards.lordsWonFormatted,
    chestsClaimedEstimate: rewards.chestsClaimedEstimate,
    claimBlockedReason: rewards.claimBlockedReason,
  };
};

export const finalizeGameRankingAndMMR = async ({
  worldName,
  chain,
  signer,
}: {
  worldName: string;
  chain: Chain;
  signer: Account | AccountInterface;
}): Promise<FinalizeGameReviewResult> => {
  // buildWorldProfile resolves the owning directory world (and the game's
  // registry id) for appchain games internally.
  const profile = await buildWorldProfile(chain, worldName);
  const toriiSqlBaseUrl = `${profile.toriiBaseUrl}/sql`;
  const gameId = profile.gameId ?? 0;
  // Deployed s2 game entrypoints take `game_id` as their first argument.
  const gameCalldataPrefix = gameId > 0 ? [gameId] : [];

  const [finalization, rankedPlayersByPoints] = await Promise.all([
    fetchReviewFinalizationMeta(toriiSqlBaseUrl, gameId),
    fetchRankedPlayersForSubmission(toriiSqlBaseUrl, gameId),
  ]);

  const playersForSubmission =
    rankedPlayersByPoints.length > 0 ? rankedPlayersByPoints : finalization.registeredPlayers;

  if (playersForSubmission.length === 0) {
    throw new Error("No registered players found for this game.");
  }

  const baseManifest = getGameManifest(chain, profile.worldId === "eternum" ? "eternum" : "blitz") as unknown as Record<
    string,
    unknown
  >;
  const patchedManifest = patchManifestWithFactory(baseManifest, profile.worldAddress, profile.contractsBySelector);
  const namespace = profile.namespace ?? namespaceForChain(chain);

  const prizeDistributionAddress = getContractByName(patchedManifest, namespace, "prize_distribution_systems").address;

  let rankingSubmitted = false;
  let mmrSubmitted = false;
  let mmrError: string | null = null;
  const totalRegistrations = Math.max(finalization.registrationCount, finalization.registeredPlayers.length);
  const useSingleRegistrantClaim = totalRegistrations === 1;

  if (!finalization.rankingFinalized) {
    if (useSingleRegistrantClaim) {
      const onlyPlayer = finalization.registeredPlayers[0] ?? playersForSubmission[0];
      if (!onlyPlayer) {
        throw new Error("Single-registrant game detected but no registered player address was found.");
      }
      const claimNoGameCall: Call = {
        contractAddress: prizeDistributionAddress,
        entrypoint: "blitz_prize_claim_no_game",
        calldata: [...gameCalldataPrefix, onlyPlayer],
      };
      await executeObservedClientTransaction({
        account: signer,
        calls: [claimNoGameCall],
        surface: "game_review",
        operation: "blitz_prize_claim_no_game",
        chain,
        worldName,
        worldAddress: profile.worldAddress,
        waitForConfirmation: false,
      });
    } else {
      const totalPlayers = playersForSubmission.length;
      const playerBatches = chunk(playersForSubmission, RANKING_BATCH_SIZE);

      for (let index = 0; index < playerBatches.length; index++) {
        const batch = playerBatches[index];
        const playerRankCall: Call = {
          contractAddress: prizeDistributionAddress,
          entrypoint: "blitz_prize_player_rank",
          calldata: [...gameCalldataPrefix, randomTrialId(), index === 0 ? totalPlayers : 0, batch.length, ...batch],
        };
        await executeObservedClientTransaction({
          account: signer,
          calls: [playerRankCall],
          surface: "game_review",
          operation: "blitz_prize_player_rank",
          chain,
          worldName,
          worldAddress: profile.worldAddress,
          waitForConfirmation: false,
        });
      }
    }

    rankingSubmitted = true;
  }

  const canSubmitMMR =
    finalization.mmrEnabled &&
    Boolean(finalization.mmrTokenAddress) &&
    !finalization.mmrCommitted &&
    playersForSubmission.length >= finalization.mmrMinPlayers;

  if (canSubmitMMR) {
    const mmrSystemsAddress = getContractByName(patchedManifest, namespace, "mmr_systems").address;

    try {
      await commitAndClaimMMR({
        registeredPlayers: playersForSubmission.map((address) => BigInt(address)),
        mmrTokenAddress: finalization.mmrTokenAddress!,
        rpcUrl: profile.rpcUrl || env.VITE_PUBLIC_NODE_URL,
        signer,
        commitAndClaimGameMmr: async ({ players }) => {
          const calls: Call[] = [
            {
              contractAddress: mmrSystemsAddress,
              entrypoint: "commit_game_mmr_meta",
              calldata: [...gameCalldataPrefix, players.length, ...players],
            },
            {
              contractAddress: mmrSystemsAddress,
              entrypoint: "claim_game_mmr",
              calldata: [...gameCalldataPrefix, players.length, ...players],
            },
          ];

          return await executeObservedClientTransaction({
            account: signer,
            calls,
            surface: "game_review",
            operation: "commit_and_claim_game_mmr",
            chain,
            worldName,
            worldAddress: profile.worldAddress,
            waitForConfirmation: false,
          });
        },
      });

      mmrSubmitted = true;
    } catch (error: unknown) {
      mmrError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    rankingSubmitted,
    mmrSubmitted,
    rankingSkipped: !rankingSubmitted,
    mmrSkipped: !mmrSubmitted,
    totalPlayers: playersForSubmission.length,
    mmrError,
  };
};

export const claimGameReviewRewards = async ({
  worldName,
  chain,
  signer,
  playerAddress,
}: {
  worldName: string;
  chain: Chain;
  signer: Account | AccountInterface;
  playerAddress: string;
}): Promise<ClaimGameReviewRewardsResult> => {
  const normalizedAddress = parseAddress(playerAddress);
  if (!normalizedAddress) {
    throw new Error("Missing player address for reward claim.");
  }

  await claimGameReviewRewardsForPlayers({
    worldName,
    chain,
    signer,
    playerAddresses: [normalizedAddress],
  });

  return {
    claimed: true,
    playerAddress: normalizedAddress,
  };
};

const claimGameReviewRewardsForPlayers = async ({
  worldName,
  chain,
  signer,
  playerAddresses,
}: {
  worldName: string;
  chain: Chain;
  signer: Account | AccountInterface;
  playerAddresses: string[];
}): Promise<ClaimGameReviewRewardsForPlayersResult> => {
  const normalizedAddresses = uniqueAddresses(playerAddresses);
  if (normalizedAddresses.length === 0) {
    return {
      claimed: true,
      claimedPlayers: 0,
      playerAddresses: [],
      batchesSubmitted: 0,
    };
  }

  // buildWorldProfile resolves the owning directory world (and the game's
  // registry id) for appchain games internally.
  const profile = await buildWorldProfile(chain, worldName);
  const baseManifest = getGameManifest(chain, profile.worldId === "eternum" ? "eternum" : "blitz") as unknown as Record<
    string,
    unknown
  >;
  const patchedManifest = patchManifestWithFactory(baseManifest, profile.worldAddress, profile.contractsBySelector);
  const namespace = profile.namespace ?? namespaceForChain(chain);
  const prizeDistributionAddress = getContractByName(patchedManifest, namespace, "prize_distribution_systems").address;
  // Deployed s2 game entrypoints take `game_id` as their first argument.
  const gameCalldataPrefix = profile.gameId && profile.gameId > 0 ? [profile.gameId] : [];

  const claimBatches = chunk(normalizedAddresses, CLAIM_ALL_REWARDS_BATCH_SIZE);
  for (const batch of claimBatches) {
    const claimCall: Call = {
      contractAddress: prizeDistributionAddress,
      entrypoint: "blitz_prize_claim",
      calldata: [...gameCalldataPrefix, batch.length, ...batch],
    };

    const calls: Call[] = [];
    const vrfProviderAddress = env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS;
    if (vrfProviderAddress !== undefined && Number(vrfProviderAddress) !== 0) {
      calls.push({
        contractAddress: vrfProviderAddress,
        entrypoint: "request_random",
        calldata: [prizeDistributionAddress, 0, signer.address],
      });
    }
    calls.push(claimCall);

    await executeObservedClientTransaction({
      account: signer,
      calls,
      surface: "game_review",
      operation: "blitz_prize_claim",
      chain,
      worldName,
      worldAddress: profile.worldAddress,
      waitForConfirmation: true,
    });
  }

  return {
    claimed: true,
    claimedPlayers: normalizedAddresses.length,
    playerAddresses: normalizedAddresses,
    batchesSubmitted: claimBatches.length,
  };
};
