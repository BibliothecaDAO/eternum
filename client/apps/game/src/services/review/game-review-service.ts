import { buildWorldProfile, patchManifestWithFactory } from "@/runtime/world";
import {
  fetchLandingLeaderboard,
  fetchLandingLeaderboardEntryByAddress,
  type LandingLeaderboardEntry,
} from "@/services/leaderboard/landing-leaderboard-service";
import { GLOBAL_TORII_BY_CHAIN, MMR_TOKEN_BY_CHAIN } from "@/config/global-chain";
import { commitAndClaimMMR } from "@/ui/features/prize/utils/mmr-utils";
import { getMMRTierFromRaw, toMmrIntegerFromRaw } from "@/ui/utils/mmr-tiers";
import { SqlApi, buildApiUrl, fetchWithErrorHandling } from "@bibliothecadao/torii";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { Chain } from "@contracts";
import { getGameManifest } from "@contracts";
import { getContractByName } from "@dojoengine/core";
import { Account, AccountInterface, Call, hash } from "starknet";

import { env } from "../../../env";

const RANKING_BATCH_SIZE = 200;
const LEADERBOARD_FETCH_LIMIT = 1000;
const RESOURCE_PRECISION_BIGINT = BigInt(RESOURCE_PRECISION);
const LORDS_TOKEN_DECIMALS = 18;
const VICTORY_POINTS_MULTIPLIER = 1_000_000n;
const GAME_REWARD_CHEST_POINTS_THRESHOLD = 500n * VICTORY_POINTS_MULTIPLIER;
const MMR_UPDATED_SELECTOR = hash.getSelectorFromName("MMRUpdated").toLowerCase();

const REVIEW_BATTLE_AND_CREATION_QUERY = `
  SELECT
    story,
    "story.BattleStory.attacker_troops_lost" AS battle_attacker_troops_lost,
    "story.BattleStory.defender_troops_lost" AS battle_defender_troops_lost,
    "story.ExplorerCreateStory.tier" AS explorer_create_tier,
    "story.ExplorerCreateStory.amount" AS explorer_create_amount
  FROM "s1_eternum-StoryEvent"
  WHERE story IN ('BattleStory', 'ExplorerCreateStory');
`;

const REVIEW_REGISTERED_PLAYERS_QUERY = `
  SELECT player
  FROM "s1_eternum-BlitzRealmPlayerRegister"
  WHERE once_registered = TRUE OR registered = TRUE;
`;

const REVIEW_PLAYERS_RANK_FINAL_QUERY = `
  SELECT trial_id
  FROM "s1_eternum-PlayersRankFinal"
  WHERE trial_id > 0
  ORDER BY trial_id DESC
  LIMIT 1;
`;

const REVIEW_MMR_META_QUERY = `
  SELECT game_median
  FROM "s1_eternum-MMRGameMeta"
  ORDER BY game_median DESC
  LIMIT 1;
`;

const REVIEW_MMR_CONFIG_QUERY = `
  SELECT
    "mmr_config.enabled" AS mmr_enabled,
    "mmr_config.min_players" AS mmr_min_players,
    "mmr_config.mmr_token_address" AS mmr_token_address
  FROM "s1_eternum-WorldConfig"
  LIMIT 1;
`;

const REVIEW_TRANSACTIONS_COUNT_QUERY = `
  SELECT COUNT(*) AS transaction_count
  FROM transactions;
`;

const REVIEW_GAME_CHEST_REWARD_QUERY = `
  SELECT
    allocated_chests,
    distributed_chests
  FROM "s1_eternum-GameChestReward"
  LIMIT 1;
`;

const REVIEW_SEASON_PRIZE_QUERY = `
  SELECT total_registered_points
  FROM "s1_eternum-SeasonPrize"
  LIMIT 1;
`;

const buildReviewFinalRankForPlayerQuery = (playerAddress: string) => `
  SELECT
    pr.trial_id,
    pr.rank,
    pr.paid
  FROM "s1_eternum-PlayerRank" pr
  INNER JOIN "s1_eternum-PlayersRankFinal" pf
    ON pf.trial_id = pr.trial_id
  WHERE lower(pr.player) = lower('${playerAddress}')
    AND pf.trial_id > 0
  ORDER BY pf.trial_id DESC
  LIMIT 1;
`;

const buildReviewRankPrizeQuery = (trialId: bigint, rank: number) => `
  SELECT
    total_players_same_rank_count,
    total_prize_amount,
    grant_elite_nft
  FROM "s1_eternum-RankPrize"
  WHERE trial_id = '${trialId.toString()}'
    AND rank = '${rank}'
  LIMIT 1;
`;

const buildReviewRankTrialQuery = (trialId: bigint) => `
  SELECT total_player_count_committed
  FROM "s1_eternum-PlayersRankTrial"
  WHERE trial_id = '${trialId.toString()}'
  LIMIT 1;
`;

const buildReviewRegisteredPointsQuery = (playerAddress: string) => `
  SELECT
    registered_points,
    prize_claimed
  FROM "s1_eternum-PlayerRegisteredPoints"
  WHERE lower(address) = lower('${playerAddress}')
  LIMIT 1;
`;

const buildToriiSqlUrl = (worldName: string) => `https://api.cartridge.gg/x/${worldName}/torii/sql`;

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

const formatTokenAmount = (amount: bigint, decimals: number): string => {
  const s = amount.toString();
  const pad = decimals - s.length;
  const whole = pad >= 0 ? "0" : s.slice(0, s.length - decimals);
  const fracRaw = pad >= 0 ? "0".repeat(pad) + s : s.slice(s.length - decimals);
  const wholeFmt = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = fracRaw.replace(/0+$/, "");
  return frac.length > 0 ? `${wholeFmt}.${frac}` : wholeFmt;
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

const queryToriiSql = async <TRow extends object>(
  toriiSqlBaseUrl: string,
  query: string,
  errorMessage: string,
): Promise<TRow[]> => {
  const url = buildApiUrl(toriiSqlBaseUrl, query);
  return fetchWithErrorHandling<TRow>(url, errorMessage);
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

const parseU256 = (low: unknown, high: unknown): bigint => {
  const parsedLow = parseBigIntValue(low) ?? 0n;
  const parsedHigh = parseBigIntValue(high) ?? 0n;
  return parsedLow + (parsedHigh << 128n);
};

const getGlobalToriiSqlUrl = (chain: Chain): string | null => {
  if (chain !== "mainnet" && chain !== "slot") {
    return null;
  }

  const baseUrl = GLOBAL_TORII_BY_CHAIN[chain];
  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}/sql`;
};

const buildLatestMmrForAddressesQuery = (addresses: string[], mmrTokenAddress: string): string => {
  const normalizedToken = mmrTokenAddress.trim().toLowerCase();
  const normalizedAddressList = addresses
    .map((address) => {
      const noPrefix = address.trim().toLowerCase().replace(/^0x/, "");
      const withoutLeadingZeros = noPrefix.replace(/^0+/, "");
      return `'${withoutLeadingZeros}'`;
    })
    .join(", ");

  return `
WITH mmr_events AS (
  SELECT
    id,
    executed_at,
    data,
    lower(substr(lower(keys), instr(lower(keys), '/') + 1, instr(substr(lower(keys), instr(lower(keys), '/') + 1), '/') - 1)) AS player_address
  FROM events
  WHERE instr(lower(keys), '/') > 0
    AND ltrim(substr(lower(keys), 1, instr(lower(keys), '/') - 1), '0x') = ltrim('${MMR_UPDATED_SELECTOR}', '0x')
    AND lower(id) LIKE '%:${normalizedToken}:%'
),
latest_events AS (
  SELECT
    player_address,
    id,
    data,
    ROW_NUMBER() OVER (
      PARTITION BY player_address
      ORDER BY executed_at DESC, id DESC
    ) AS rn
  FROM mmr_events
  WHERE ltrim(player_address, '0x') IN (${normalizedAddressList})
),
tokenized_1 AS (
  SELECT
    player_address,
    id,
    substr(data, 1, instr(data, '/') - 1) AS old_mmr_low,
    substr(data, instr(data, '/') + 1) AS rest_1
  FROM latest_events
  WHERE rn = 1
),
tokenized_2 AS (
  SELECT
    player_address,
    id,
    old_mmr_low,
    substr(rest_1, 1, instr(rest_1, '/') - 1) AS old_mmr_high,
    substr(rest_1, instr(rest_1, '/') + 1) AS rest_2
  FROM tokenized_1
),
tokenized_3 AS (
  SELECT
    player_address,
    id,
    old_mmr_low,
    old_mmr_high,
    substr(rest_2, 1, instr(rest_2, '/') - 1) AS new_mmr_low,
    substr(rest_2, instr(rest_2, '/') + 1) AS rest_3
  FROM tokenized_2
),
tokenized_4 AS (
  SELECT
    player_address,
    id,
    old_mmr_low,
    old_mmr_high,
    new_mmr_low,
    substr(rest_3, 1, instr(rest_3, '/') - 1) AS new_mmr_high
  FROM tokenized_3
)
SELECT player_address, new_mmr_low, new_mmr_high
FROM tokenized_4;
`;
};

const fetchLatestMmrForPlayers = async ({
  chain,
  addresses,
}: {
  chain: Chain;
  addresses: string[];
}): Promise<Map<string, Pick<LandingLeaderboardEntry, "mmr" | "mmrTier">>> => {
  const normalizedAddresses = uniqueAddresses(addresses);
  const globalToriiSqlUrl = getGlobalToriiSqlUrl(chain);
  const mmrTokenAddress = MMR_TOKEN_BY_CHAIN[chain];

  if (!globalToriiSqlUrl || !mmrTokenAddress || normalizedAddresses.length === 0) {
    return new Map();
  }

  const query = buildLatestMmrForAddressesQuery(normalizedAddresses, mmrTokenAddress);

  try {
    const rows = await queryToriiSql<LatestMmrRow>(globalToriiSqlUrl, query, "Failed to fetch latest MMR values");
    const mmrByAddress = new Map<string, Pick<LandingLeaderboardEntry, "mmr" | "mmrTier">>();

    rows.forEach((row) => {
      const playerAddress = parseAddress(row.player_address);
      if (!playerAddress) return;

      const mmrRaw = parseU256(row.new_mmr_low, row.new_mmr_high);
      mmrByAddress.set(playerAddress, {
        mmr: toMmrIntegerFromRaw(mmrRaw),
        mmrTier: getMMRTierFromRaw(mmrRaw).name,
      });
    });

    return mmrByAddress;
  } catch {
    return new Map();
  }
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
  trial_id?: unknown;
  rank?: unknown;
  paid?: unknown;
}

interface MmrMetaRow {
  game_median?: unknown;
}

interface MmrConfigRow {
  mmr_enabled?: unknown;
  mmr_min_players?: unknown;
  mmr_token_address?: unknown;
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

interface LatestMmrRow {
  player_address?: unknown;
  new_mmr_low?: unknown;
  new_mmr_high?: unknown;
}

interface ReviewFinalizationMeta {
  registeredPlayers: string[];
  finalTrialId: bigint | null;
  rankingFinalized: boolean;
  mmrCommitted: boolean;
  mmrEnabled: boolean;
  mmrMinPlayers: number;
  mmrTokenAddress: string | null;
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
}

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
  finalization: ReviewFinalizationMeta;
  rewards: GameReviewRewards | null;
}

interface FinalizeGameReviewResult {
  rankingSubmitted: boolean;
  mmrSubmitted: boolean;
  rankingSkipped: boolean;
  mmrSkipped: boolean;
  totalPlayers: number;
}

interface ClaimGameReviewRewardsResult {
  claimed: boolean;
  playerAddress: string;
}

const fetchReviewFinalizationMeta = async (toriiSqlBaseUrl: string): Promise<ReviewFinalizationMeta> => {
  const [registeredRows, rankFinalRows, mmrMetaRows, mmrConfigRows] = await Promise.all([
    queryToriiSql<RegisteredPlayerRow>(
      toriiSqlBaseUrl,
      REVIEW_REGISTERED_PLAYERS_QUERY,
      "Failed to fetch registered players",
    ),
    queryToriiSql<RankFinalRow>(toriiSqlBaseUrl, REVIEW_PLAYERS_RANK_FINAL_QUERY, "Failed to fetch PlayersRankFinal"),
    queryToriiSql<MmrMetaRow>(toriiSqlBaseUrl, REVIEW_MMR_META_QUERY, "Failed to fetch MMRGameMeta"),
    queryToriiSql<MmrConfigRow>(toriiSqlBaseUrl, REVIEW_MMR_CONFIG_QUERY, "Failed to fetch MMR config"),
  ]);

  const registeredPlayers = uniqueAddresses(registeredRows.map((row) => parseAddress(row.player)));
  const finalTrialId = parseBigIntValue(rankFinalRows[0]?.trial_id);
  const rankingFinalized = finalTrialId != null && finalTrialId > 0n;
  const mmrCommitted = parseNumeric(mmrMetaRows[0]?.game_median) > 0;

  const mmrEnabled = parseNumeric(mmrConfigRows[0]?.mmr_enabled) !== 0;
  const mmrMinPlayers = Math.max(1, parseNumeric(mmrConfigRows[0]?.mmr_min_players) || 6);
  const mmrTokenAddress = parseAddress(mmrConfigRows[0]?.mmr_token_address);

  return {
    registeredPlayers,
    finalTrialId,
    rankingFinalized,
    mmrCommitted,
    mmrEnabled,
    mmrMinPlayers,
    mmrTokenAddress,
  };
};

const fetchStoryStats = async (
  toriiSqlBaseUrl: string,
): Promise<
  Pick<GameReviewStats, "totalDeadTroops" | "totalT1TroopsCreated" | "totalT2TroopsCreated" | "totalT3TroopsCreated">
> => {
  const rows = await queryToriiSql<StoryStatRow>(
    toriiSqlBaseUrl,
    REVIEW_BATTLE_AND_CREATION_QUERY,
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

const fetchRankedPlayersForSubmission = async (client: SqlApi): Promise<string[]> => {
  const rows = await client.fetchRegisteredPlayerPoints(LEADERBOARD_FETCH_LIMIT, 0);

  const addresses = uniqueAddresses(rows.map((row) => parseAddress(row.playerAddress)));
  if (addresses.length > 0) {
    return addresses;
  }

  return [];
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

const fetchReviewRewards = async ({
  toriiSqlBaseUrl,
  playerAddress,
  finalization,
}: {
  toriiSqlBaseUrl: string;
  playerAddress: string;
  finalization: ReviewFinalizationMeta;
}): Promise<GameReviewRewards> => {
  const [playerPointsRows, chestRows, seasonRows] = await Promise.all([
    queryToriiSql<PlayerRegisteredPointsRow>(
      toriiSqlBaseUrl,
      buildReviewRegisteredPointsQuery(playerAddress),
      "Failed to fetch player registered points",
    ),
    queryToriiSql<GameChestRewardRow>(
      toriiSqlBaseUrl,
      REVIEW_GAME_CHEST_REWARD_QUERY,
      "Failed to fetch game chest reward state",
    ),
    queryToriiSql<SeasonPrizeRow>(toriiSqlBaseUrl, REVIEW_SEASON_PRIZE_QUERY, "Failed to fetch season prize state"),
  ]);

  const playerRegisteredPoints = parseBigIntValue(playerPointsRows[0]?.registered_points) ?? 0n;
  const playerPrizeClaimed = parseBoolean(playerPointsRows[0]?.prize_claimed);
  const allocatedChests = Math.max(0, parseNumeric(chestRows[0]?.allocated_chests));
  const totalRegisteredPoints = parseBigIntValue(seasonRows[0]?.total_registered_points) ?? 0n;
  const guaranteedChestBonus = playerRegisteredPoints >= GAME_REWARD_CHEST_POINTS_THRESHOLD ? 1 : 0;
  const proportionalChestShare =
    allocatedChests > 0 && totalRegisteredPoints > 0n
      ? Number((BigInt(allocatedChests) * playerRegisteredPoints) / totalRegisteredPoints)
      : 0;
  const chestsClaimedEstimate = Math.max(0, guaranteedChestBonus + proportionalChestShare);
  const chestsClaimedReason = "";

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
    buildReviewFinalRankForPlayerQuery(playerAddress),
    "Failed to fetch player final rank",
  );

  const playerRank = parseInteger(playerRankRows[0]?.rank);
  const paid = parseBoolean(playerRankRows[0]?.paid) || playerPrizeClaimed;
  const trialIdFromPlayerRank = parseBigIntValue(playerRankRows[0]?.trial_id);
  const finalTrialId = trialIdFromPlayerRank ?? finalization.finalTrialId;

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
      buildReviewRankPrizeQuery(finalTrialId, playerRank),
      "Failed to fetch rank prize details",
    ),
    queryToriiSql<RankTrialRow>(
      toriiSqlBaseUrl,
      buildReviewRankTrialQuery(finalTrialId),
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
  const toriiSqlBaseUrl = buildToriiSqlUrl(worldName);

  const [leaderboard, finalization, storyStats, transactionsCount] = await Promise.all([
    fetchLandingLeaderboard(LEADERBOARD_FETCH_LIMIT, 0, toriiSqlBaseUrl),
    fetchReviewFinalizationMeta(toriiSqlBaseUrl),
    fetchStoryStats(toriiSqlBaseUrl),
    fetchTransactionsCount(toriiSqlBaseUrl),
  ]);

  let topPlayers = leaderboard.slice(0, 3);
  if (topPlayers.length > 0) {
    const mmrByAddress = await fetchLatestMmrForPlayers({
      chain,
      addresses: topPlayers.map((entry) => entry.address),
    });

    if (mmrByAddress.size > 0) {
      topPlayers = topPlayers.map((entry) => {
        const normalizedAddress = parseAddress(entry.address);
        if (!normalizedAddress) {
          return entry;
        }

        const mmrData = mmrByAddress.get(normalizedAddress);
        if (!mmrData) {
          return entry;
        }

        return {
          ...entry,
          mmr: mmrData.mmr,
          mmrTier: mmrData.mmrTier,
        };
      });
    }
  }

  const normalizedPlayerAddress = parseAddress(playerAddress);
  let personalScore =
    normalizedPlayerAddress == null
      ? null
      : (leaderboard.find((entry) => parseAddress(entry.address) === normalizedPlayerAddress) ?? null);

  if (!personalScore && normalizedPlayerAddress) {
    personalScore = await fetchLandingLeaderboardEntryByAddress(normalizedPlayerAddress, toriiSqlBaseUrl);
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
  };

  const rewards =
    normalizedPlayerAddress == null
      ? null
      : await fetchReviewRewards({
          toriiSqlBaseUrl,
          playerAddress: normalizedPlayerAddress,
          finalization,
        });

  return {
    worldName,
    chain,
    topPlayers,
    leaderboard,
    personalScore,
    isParticipant,
    stats,
    finalization,
    rewards,
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
  const profile = await buildWorldProfile(chain, worldName);
  const toriiSqlBaseUrl = `${profile.toriiBaseUrl}/sql`;
  const sqlClient = new SqlApi(toriiSqlBaseUrl);

  const [finalization, rankedPlayersByPoints] = await Promise.all([
    fetchReviewFinalizationMeta(toriiSqlBaseUrl),
    fetchRankedPlayersForSubmission(sqlClient),
  ]);

  const playersForSubmission =
    rankedPlayersByPoints.length > 0 ? rankedPlayersByPoints : finalization.registeredPlayers;

  if (playersForSubmission.length === 0) {
    throw new Error("No registered players found for this game.");
  }

  const baseManifest = getGameManifest(chain) as unknown as Record<string, unknown>;
  const patchedManifest = patchManifestWithFactory(baseManifest, profile.worldAddress, profile.contractsBySelector);

  const prizeDistributionAddress = getContractByName(
    patchedManifest,
    "s1_eternum",
    "prize_distribution_systems",
  ).address;

  let rankingSubmitted = false;
  let mmrSubmitted = false;

  if (!finalization.rankingFinalized) {
    if (playersForSubmission.length === 1) {
      const onlyPlayer = playersForSubmission[0];
      const claimNoGameCall: Call = {
        contractAddress: prizeDistributionAddress,
        entrypoint: "blitz_prize_claim_no_game",
        calldata: [onlyPlayer],
      };
      await signer.execute([claimNoGameCall]);
    } else {
      const totalPlayers = playersForSubmission.length;
      const playerBatches = chunk(playersForSubmission, RANKING_BATCH_SIZE);

      for (let index = 0; index < playerBatches.length; index++) {
        const batch = playerBatches[index];
        const playerRankCall: Call = {
          contractAddress: prizeDistributionAddress,
          entrypoint: "blitz_prize_player_rank",
          calldata: [randomTrialId(), index === 0 ? totalPlayers : 0, batch.length, ...batch],
        };
        await signer.execute([playerRankCall]);
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
    const mmrSystemsAddress = getContractByName(patchedManifest, "s1_eternum", "mmr_systems").address;

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
            calldata: [players.length, ...players],
          },
          {
            contractAddress: mmrSystemsAddress,
            entrypoint: "claim_game_mmr",
            calldata: [players.length, ...players],
          },
        ];

        return signer.execute(calls);
      },
    });

    mmrSubmitted = true;
  }

  return {
    rankingSubmitted,
    mmrSubmitted,
    rankingSkipped: !rankingSubmitted,
    mmrSkipped: !mmrSubmitted,
    totalPlayers: playersForSubmission.length,
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

  const profile = await buildWorldProfile(chain, worldName);
  const baseManifest = getGameManifest(chain) as unknown as Record<string, unknown>;
  const patchedManifest = patchManifestWithFactory(baseManifest, profile.worldAddress, profile.contractsBySelector);
  const prizeDistributionAddress = getContractByName(
    patchedManifest,
    "s1_eternum",
    "prize_distribution_systems",
  ).address;

  const claimCall: Call = {
    contractAddress: prizeDistributionAddress,
    entrypoint: "blitz_prize_claim",
    calldata: [1, normalizedAddress],
  };

  await signer.execute([claimCall]);

  return {
    claimed: true,
    playerAddress: normalizedAddress,
  };
};
