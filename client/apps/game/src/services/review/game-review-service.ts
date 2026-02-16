import { buildWorldProfile, patchManifestWithFactory } from "@/runtime/world";
import {
  fetchLandingLeaderboard,
  fetchLandingLeaderboardEntryByAddress,
  type LandingLeaderboardEntry,
} from "@/services/leaderboard/landing-leaderboard-service";
import { commitAndClaimMMR } from "@/ui/features/prize/utils/mmr-utils";
import type { Chain } from "@contracts";
import { getGameManifest } from "@contracts";
import { getContractByName } from "@dojoengine/core";
import { SqlApi, buildApiUrl, fetchWithErrorHandling } from "@bibliothecadao/torii";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { Account, AccountInterface, Call } from "starknet";

import { env } from "../../../env";

const FORMATTED_WORLD_ID = "0x000000000000000000000000ffffffff";
const RANKING_BATCH_SIZE = 200;
const LEADERBOARD_FETCH_LIMIT = 1000;
const RESOURCE_PRECISION_BIGINT = BigInt(RESOURCE_PRECISION);

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
  WHERE world_id = '${FORMATTED_WORLD_ID}'
  LIMIT 1;
`;

const REVIEW_MMR_META_QUERY = `
  SELECT game_median
  FROM "s1_eternum-MMRGameMeta"
  WHERE world_id = '${FORMATTED_WORLD_ID}'
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

const randomTrialId = () =>
  BigInt(`0x${(globalThis.crypto?.randomUUID?.().replace(/-/g, "") || Date.now().toString(16)).slice(0, 31)}`);

const chunk = <T,>(items: T[], chunkSize: number): T[][] => {
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

interface MmrMetaRow {
  game_median?: unknown;
}

interface MmrConfigRow {
  mmr_enabled?: unknown;
  mmr_min_players?: unknown;
  mmr_token_address?: unknown;
}

interface ReviewFinalizationMeta {
  registeredPlayers: string[];
  rankingFinalized: boolean;
  mmrCommitted: boolean;
  mmrEnabled: boolean;
  mmrMinPlayers: number;
  mmrTokenAddress: string | null;
}

export interface GameReviewStats {
  numberOfPlayers: number;
  totalTilesExplored: number;
  totalCampsTaken: number;
  totalEssenceRiftsTaken: number;
  totalHyperstructuresTaken: number;
  totalDeadTroops: number;
  totalT1TroopsCreated: number;
  totalT2TroopsCreated: number;
  totalT3TroopsCreated: number;
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
}

export interface FinalizeGameReviewResult {
  rankingSubmitted: boolean;
  mmrSubmitted: boolean;
  rankingSkipped: boolean;
  mmrSkipped: boolean;
  totalPlayers: number;
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
  const rankingFinalized = Boolean(rankFinalRows[0]?.trial_id);
  const mmrCommitted = parseNumeric(mmrMetaRows[0]?.game_median) > 0;

  const mmrEnabled = parseNumeric(mmrConfigRows[0]?.mmr_enabled) !== 0;
  const mmrMinPlayers = Math.max(1, parseNumeric(mmrConfigRows[0]?.mmr_min_players) || 6);
  const mmrTokenAddress = parseAddress(mmrConfigRows[0]?.mmr_token_address);

  return {
    registeredPlayers,
    rankingFinalized,
    mmrCommitted,
    mmrEnabled,
    mmrMinPlayers,
    mmrTokenAddress,
  };
};

const fetchStoryStats = async (toriiSqlBaseUrl: string): Promise<Pick<
  GameReviewStats,
  "totalDeadTroops" | "totalT1TroopsCreated" | "totalT2TroopsCreated" | "totalT3TroopsCreated"
>> => {
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
      totalDeadTroops += parseScaledAmount(row.battle_attacker_troops_lost) + parseScaledAmount(row.battle_defender_troops_lost);
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

  const [leaderboard, finalization, storyStats] = await Promise.all([
    fetchLandingLeaderboard(LEADERBOARD_FETCH_LIMIT, 0, toriiSqlBaseUrl),
    fetchReviewFinalizationMeta(toriiSqlBaseUrl),
    fetchStoryStats(toriiSqlBaseUrl),
  ]);

  const topPlayers = leaderboard.slice(0, 3);

  const normalizedPlayerAddress = parseAddress(playerAddress);
  let personalScore =
    normalizedPlayerAddress == null
      ? null
      : leaderboard.find((entry) => parseAddress(entry.address) === normalizedPlayerAddress) ?? null;

  if (!personalScore && normalizedPlayerAddress) {
    personalScore = await fetchLandingLeaderboardEntryByAddress(normalizedPlayerAddress, toriiSqlBaseUrl);
  }

  const isParticipant =
    normalizedPlayerAddress != null
      ? finalization.registeredPlayers.includes(normalizedPlayerAddress) || Boolean(personalScore)
      : false;

  const stats: GameReviewStats = {
    numberOfPlayers: finalization.registeredPlayers.length,
    totalTilesExplored: sumLeaderboardMetric(leaderboard, "exploredTiles"),
    totalCampsTaken: sumLeaderboardMetric(leaderboard, "campsTaken"),
    totalEssenceRiftsTaken: sumLeaderboardMetric(leaderboard, "riftsTaken"),
    totalHyperstructuresTaken: sumLeaderboardMetric(leaderboard, "hyperstructuresConquered"),
    totalDeadTroops: storyStats.totalDeadTroops,
    totalT1TroopsCreated: storyStats.totalT1TroopsCreated,
    totalT2TroopsCreated: storyStats.totalT2TroopsCreated,
    totalT3TroopsCreated: storyStats.totalT3TroopsCreated,
  };

  return {
    worldName,
    chain,
    topPlayers,
    leaderboard,
    personalScore,
    isParticipant,
    stats,
    finalization,
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

  const playersForSubmission = rankedPlayersByPoints.length > 0 ? rankedPlayersByPoints : finalization.registeredPlayers;

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
