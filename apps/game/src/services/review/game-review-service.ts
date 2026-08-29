import { namespaceForChain } from "@/sync/game-scope";
import { executeObservedClientTransaction } from "@/observability/observed-client-transaction";
import { buildWorldProfile, patchManifestWithFactory } from "@/runtime/world";
import { resolveGameId, resolveWorldIdForGame } from "@/runtime/world/game-registry";
import {
  fetchHeraldGameHistory,
  fetchHeraldGameReviewSnapshot,
  fetchHeraldTransactionCount,
} from "@/runtime/world/herald-http";
import { getWorldById, type WorldDeployment } from "@/runtime/world/world-directory";
import {
  buildLandingLeaderboard,
  normalizeLeaderboardAddress,
  type LandingLeaderboardEntry,
} from "@/services/leaderboard/landing-leaderboard-service";
import { commitAndClaimMMR } from "@/ui/features/prize/utils/mmr-utils";
import { getGameManifest } from "@contracts";
import { getContractByName } from "@dojoengine/core";
import type { GameChain as Chain } from "@realms-world/chain";
import type { HeraldGameSnapshot, HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { RESOURCE_PRECISION, tileDataToTile } from "@bibliothecadao/types";
import type { Account, AccountInterface, Call } from "starknet";

import { env } from "../../../env";
import { estimateClaimableChests } from "./chest-reward-estimate";
import { buildGameReviewDerivedMetrics, type GameReviewValueMetric } from "./game-review-stats-utils";

const RANKING_BATCH_SIZE = 200;
const CLAIM_ALL_REWARDS_BATCH_SIZE = 200;
const HISTORY_PAGE_SIZE = 500;
const MAX_MAP_SNAPSHOT_TILES = 4_200;
const LORDS_TOKEN_DECIMALS = 18;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

type Row = Record<string, unknown>;

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
      bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number };
      totalTiles: number;
      sampledTiles: number;
      fingerprintBiome: string;
      fingerprintOccupier: string;
    }
  | { available: false; reason: string };

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

interface ReviewSource {
  gameId: number;
  history: HeraldHistoryEvent[];
  snapshot: HeraldGameSnapshot;
  transactionCount: number;
  world: WorldDeployment;
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

const record = (value: unknown): Row =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Row) : {};

const modelRows = (snapshot: HeraldGameSnapshot, model: string): Row[] =>
  snapshot.models.find((entry) => entry.model === model)?.rows.map((row) => row.value) ?? [];

const toBigInt = (value: unknown): bigint | null => {
  if (!["bigint", "number", "string"].includes(typeof value)) return null;
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    return null;
  }
};

const toNumber = (value: unknown): number => {
  const parsed = toBigInt(value);
  const number = parsed === null ? 0 : Number(parsed);
  return Number.isFinite(number) ? number : 0;
};

const toBoolean = (value: unknown): boolean => value === true || value === 1 || value === 1n || value === "0x1";

const parseAddress = (value: unknown): string | null => normalizeLeaderboardAddress(value);

const uniqueAddresses = (values: readonly unknown[]): string[] => {
  const result = new Set<string>();
  values.forEach((value) => {
    const parsed = parseAddress(value);
    if (parsed) result.add(parsed);
  });
  return [...result];
};

const sameFelt = (left: unknown, right: unknown): boolean => {
  const leftValue = toBigInt(left);
  const rightValue = toBigInt(right);
  return leftValue !== null && rightValue !== null && leftValue === rightValue;
};

const story = (event: HeraldHistoryEvent, variant: string): Row | null => {
  const payload = record(event.value.story)[variant];
  return typeof payload === "object" && payload !== null && !Array.isArray(payload) ? (payload as Row) : null;
};

const formatTokenAmount = (amount: bigint, decimals: number): string => {
  const digits = amount.toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, -decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = digits.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
};

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};

const randomTrialId = (): bigint =>
  BigInt(`0x${(globalThis.crypto?.randomUUID?.().replaceAll("-", "") ?? Date.now().toString(16)).slice(0, 31)}`);

const resolveReviewContext = async (worldName: string): Promise<{ gameId: number; world: WorldDeployment }> => {
  const worldId = await resolveWorldIdForGame(worldName);
  const world = getWorldById(worldId);
  if (!world) throw new Error(`Game "${worldName}" was not found in the world directory.`);
  const gameId = await resolveGameId(worldName, world.id);
  if (!gameId || gameId <= 0) throw new Error(`Game "${worldName}" has no registry id in ${world.id}.`);
  return { gameId, world };
};

const fetchCompleteHistory = async (
  world: WorldDeployment,
  gameId: number,
): Promise<{
  completeThroughBlock: number | null;
  events: HeraldHistoryEvent[];
}> => {
  const events: HeraldHistoryEvent[] = [];
  let completeThroughBlock: number | null = null;
  for (let offset = 0; ; offset += HISTORY_PAGE_SIZE) {
    const page = await fetchHeraldGameHistory(world, gameId, { limit: HISTORY_PAGE_SIZE, offset });
    completeThroughBlock = page.complete_through_block;
    events.push(...page.items);
    if (events.length >= page.total || page.items.length === 0) return { completeThroughBlock, events };
  }
};

const loadReviewSource = async (worldName: string): Promise<ReviewSource> => {
  const { gameId, world } = await resolveReviewContext(worldName);
  const [snapshot, history, transactionCount] = await Promise.all([
    fetchHeraldGameReviewSnapshot(world, gameId),
    fetchCompleteHistory(world, gameId),
    fetchHeraldTransactionCount(world, gameId),
  ]);
  if (history.completeThroughBlock === null || history.completeThroughBlock < snapshot.confirmed_block) {
    throw new Error(
      `Herald history is complete through block ${history.completeThroughBlock ?? "none"}; review snapshot is block ${snapshot.confirmed_block}.`,
    );
  }
  return { gameId, history: history.events, snapshot, transactionCount: transactionCount.count, world };
};

const buildFinalization = (source: ReviewSource): ReviewFinalizationMeta => {
  const registry = modelRows(source.snapshot, "GameRegistry")[0] ?? {};
  const config = modelRows(source.snapshot, "WorldConfig")[0] ?? {};
  const chainConfig = modelRows(source.snapshot, "ChainConfig")[0] ?? {};
  const rankFinal = modelRows(source.snapshot, "PlayersRankFinal")[0] ?? {};
  const mmrMeta = modelRows(source.snapshot, "MMRGameMeta")[0] ?? {};
  const registration = record(config.blitz_registration_config);
  const mmr = record(chainConfig.mmr_config);
  const registeredPlayers = uniqueAddresses(modelRows(source.snapshot, "BlitzSettlement").map((row) => row.player));
  const configuredRegistrations = Math.max(0, toNumber(registration.registration_count));
  const finalTrialId = toBigInt(rankFinal.trial_id);
  const seasonEndAtValue = toNumber(registry.end_at);
  const seasonEndAt = seasonEndAtValue > 0 ? seasonEndAtValue : null;
  const registrationGraceSeconds = Math.max(0, toNumber(registry.registration_grace_seconds));
  return {
    registeredPlayers,
    registrationCount: configuredRegistrations || registeredPlayers.length,
    lootChestAddress: parseAddress(chainConfig.collectibles_lootchest_address),
    finalTrialId,
    rankingFinalized: finalTrialId !== null && finalTrialId > 0n,
    devModeOn: toBoolean(registry.dev_mode_on),
    mmrCommitted: toNumber(mmrMeta.game_median) > 0,
    mmrEnabled: toBoolean(mmr.enabled),
    mmrMinPlayers: Math.max(1, toNumber(mmr.min_players) || 6),
    mmrTokenAddress: parseAddress(mmr.mmr_token_address),
    seasonEndAt,
    registrationGraceSeconds,
    scoreSubmissionOpensAt: seasonEndAt === null ? null : seasonEndAt + registrationGraceSeconds,
  };
};

const buildStoryStats = (events: readonly HeraldHistoryEvent[]) => {
  const totals = { totalDeadTroops: 0, totalT1TroopsCreated: 0, totalT2TroopsCreated: 0, totalT3TroopsCreated: 0 };
  for (const event of events) {
    const battle = story(event, "BattleStory");
    if (battle) {
      totals.totalDeadTroops +=
        (toNumber(battle.attacker_troops_lost) + toNumber(battle.defender_troops_lost)) / RESOURCE_PRECISION;
      continue;
    }
    const creation = story(event, "ExplorerCreateStory");
    if (!creation) continue;
    const tierValue = creation.tier;
    const tier = typeof tierValue === "object" && tierValue !== null ? Object.keys(tierValue)[0] : String(tierValue);
    const amount = toNumber(creation.amount) / RESOURCE_PRECISION;
    if (tier === "T1" || tier === "0") totals.totalT1TroopsCreated += amount;
    if (tier === "T2" || tier === "1") totals.totalT2TroopsCreated += amount;
    if (tier === "T3" || tier === "2" || tier === "3") totals.totalT3TroopsCreated += amount;
  }
  return totals;
};

const fnv1aUpdate = (hash: number, value: string): number => {
  let result = hash >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, FNV_PRIME) >>> 0;
  }
  return result;
};

const formatFingerprint = (left: number, right: number): string => {
  const value = `${left.toString(16).padStart(8, "0")}${right.toString(16).padStart(8, "0")}`.toUpperCase();
  return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}`;
};

const buildMapSnapshot = (snapshot: HeraldGameSnapshot): GameReviewMapSnapshot => {
  const tiles = modelRows(snapshot, "TileOpt")
    .flatMap((row) => {
      try {
        const tile = tileDataToTile(row.data as string | number | bigint);
        return [
          {
            col: Math.trunc(Number(tile.col)),
            row: Math.trunc(Number(tile.row)),
            biome: Math.trunc(Number(tile.biome)),
            hasOccupier: Number(tile.occupier_id) > 0,
            occupierType: Math.trunc(Number(tile.occupier_type)),
            occupierIsStructure: Boolean(tile.occupier_is_structure),
          } satisfies GameReviewMapSnapshotTile,
        ];
      } catch {
        return [];
      }
    })
    .toSorted((left, right) => left.row - right.row || left.col - right.col);
  if (tiles.length === 0) return { available: false, reason: "Map snapshot unavailable." };

  let biomeHash = FNV_OFFSET_BASIS;
  let occupierHash = FNV_OFFSET_BASIS;
  for (const tile of tiles) {
    const base = `${tile.col}:${tile.row}:${tile.biome};`;
    biomeHash = fnv1aUpdate(biomeHash, base);
    occupierHash = fnv1aUpdate(
      occupierHash,
      `${base}${tile.hasOccupier ? `1:${tile.occupierType}:${tile.occupierIsStructure ? 1 : 0}` : "0"};`,
    );
  }
  const step = Math.max(1, Math.ceil(tiles.length / MAX_MAP_SNAPSHOT_TILES));
  const sampled = tiles.filter((_, index) => index % step === 0);
  return {
    available: true,
    tiles: sampled,
    bounds: {
      minCol: Math.min(...tiles.map((tile) => tile.col)),
      maxCol: Math.max(...tiles.map((tile) => tile.col)),
      minRow: Math.min(...tiles.map((tile) => tile.row)),
      maxRow: Math.max(...tiles.map((tile) => tile.row)),
    },
    totalTiles: tiles.length,
    sampledTiles: sampled.length,
    fingerprintBiome: formatFingerprint(biomeHash, fnv1aUpdate(biomeHash, `tiles:${tiles.length};`)),
    fingerprintOccupier: formatFingerprint(occupierHash, fnv1aUpdate(occupierHash, `tiles:${tiles.length};`)),
  };
};

const sumLeaderboardMetric = (rows: LandingLeaderboardEntry[], key: keyof LandingLeaderboardEntry): number =>
  rows.reduce((total, row) => total + (typeof row[key] === "number" ? row[key] : 0), 0);

const highestExploredTiles = (rows: LandingLeaderboardEntry[]): GameReviewValueMetric | null => {
  const top = rows
    .filter((row) => (row.exploredTiles ?? 0) > 0)
    .toSorted((left, right) => (right.exploredTiles ?? 0) - (left.exploredTiles ?? 0))[0];
  return top ? { playerAddress: top.address, value: top.exploredTiles ?? 0 } : null;
};

const buildEliteTicketReason = (eligible: boolean, rank: number, totalPlayers: number): string => {
  const cutoff = totalPlayers <= 132 ? Math.floor(totalPlayers / 2) : 66;
  return eligible
    ? `Eligible: rank #${rank} is within the top ${cutoff} ranks.`
    : `Not eligible: elite ticket cutoff is rank #${cutoff} (you are #${rank}).`;
};

const buildReviewRewards = (
  source: ReviewSource,
  playerAddress: string,
  finalization: ReviewFinalizationMeta,
  personalScore: LandingLeaderboardEntry | null,
): GameReviewRewards => {
  const playerPoints = modelRows(source.snapshot, "PlayerRegisteredPoints").find((row) =>
    sameFelt(row.address, playerAddress),
  );
  const chest = modelRows(source.snapshot, "GameChestReward")[0] ?? {};
  const season = modelRows(source.snapshot, "SeasonPrize")[0] ?? {};
  const chestEstimate = estimateClaimableChests({
    lootChestAddress: finalization.lootChestAddress,
    allocatedChests: Math.max(0, toNumber(chest.allocated_chests)),
    distributedChests: Math.max(0, toNumber(chest.distributed_chests)),
    playerRegisteredPoints: toBigInt(playerPoints?.registered_points) ?? 0n,
    totalRegisteredPoints: toBigInt(season.total_registered_points) ?? 0n,
  });
  const emptyReward = {
    lordsWonRaw: 0n,
    lordsWonFormatted: "0",
    chestsClaimedEstimate: chestEstimate.count,
    chestsClaimedReason: chestEstimate.reason,
  };
  if (!finalization.rankingFinalized || finalization.finalTrialId === null) {
    return {
      ...emptyReward,
      scoreSubmitted: false,
      isRanked: false,
      canProceedWithoutClaim: false,
      canClaimNow: false,
      alreadyClaimed: false,
      claimBlockedReason: "Submit score first to unlock rewards.",
      eliteTicketEarned: false,
      eliteTicketReason: "Submit score and finalize rankings to evaluate elite ticket eligibility.",
    };
  }
  const rankRow = modelRows(source.snapshot, "PlayerRank").find((row) => sameFelt(row.player, playerAddress));
  const rank = Math.max(0, toNumber(rankRow?.rank) || personalScore?.rank || 0);
  const paid =
    toBoolean(rankRow?.paid) || toBoolean(playerPoints?.prize_claimed) || Boolean(personalScore?.prizeClaimed);
  if (rank <= 0) {
    return {
      ...emptyReward,
      scoreSubmitted: true,
      isRanked: false,
      canProceedWithoutClaim: true,
      canClaimNow: false,
      alreadyClaimed: paid,
      claimBlockedReason: "This account is not ranked in the final leaderboard.",
      eliteTicketEarned: false,
      eliteTicketReason: "Player is not ranked in the final results.",
    };
  }
  const prize = modelRows(source.snapshot, "RankPrize").find((row) => toNumber(row.rank) === rank) ?? {};
  const trial =
    modelRows(source.snapshot, "PlayersRankTrial").find((row) => sameFelt(row.nonce, finalization.finalTrialId)) ?? {};
  const playersAtRank = Math.max(0, toNumber(prize.total_players_same_rank_count));
  const lordsWonRaw = playersAtRank > 0 ? (toBigInt(prize.total_prize_amount) ?? 0n) / BigInt(playersAtRank) : 0n;
  const eliteTicketEarned = toBoolean(prize.grant_elite_nft);
  return {
    ...emptyReward,
    scoreSubmitted: true,
    isRanked: true,
    canProceedWithoutClaim: false,
    canClaimNow: !paid,
    alreadyClaimed: paid,
    claimBlockedReason: paid ? "Rewards already claimed." : null,
    lordsWonRaw,
    lordsWonFormatted: formatTokenAmount(lordsWonRaw, LORDS_TOKEN_DECIMALS),
    eliteTicketEarned,
    eliteTicketReason: buildEliteTicketReason(eliteTicketEarned, rank, toNumber(trial.total_player_count_committed)),
  };
};

export const fetchGameReviewData = async (input: {
  worldName: string;
  chain: Chain;
  playerAddress: string | null;
}): Promise<GameReviewData> => {
  const source = await loadReviewSource(input.worldName);
  const finalization = buildFinalization(source);
  const leaderboard = buildLandingLeaderboard(source.snapshot, source.history);
  const playerAddress = parseAddress(input.playerAddress);
  const personalScore = playerAddress ? (leaderboard.find((entry) => entry.address === playerAddress) ?? null) : null;
  const structures = modelRows(source.snapshot, "Structure");
  const registry = modelRows(source.snapshot, "GameRegistry")[0] ?? {};
  const derived = buildGameReviewDerivedMetrics({
    gameStartAt: toNumber(registry.start_main_at),
    storyEvents: source.history,
    structures,
  });
  const storyStats = buildStoryStats(source.history);
  const stats: GameReviewStats = {
    numberOfPlayers: finalization.registeredPlayers.length,
    totalTransactions: source.transactionCount,
    totalTilesExplored: sumLeaderboardMetric(leaderboard, "exploredTiles"),
    totalCampsTaken: sumLeaderboardMetric(leaderboard, "campsTaken"),
    totalEssenceRiftsTaken: sumLeaderboardMetric(leaderboard, "riftsTaken"),
    totalHyperstructuresTaken: sumLeaderboardMetric(leaderboard, "hyperstructuresConquered"),
    ...storyStats,
    ...derived,
    highestExploredTiles: highestExploredTiles(leaderboard),
  };
  return {
    worldName: input.worldName,
    chain: input.chain,
    topPlayers: leaderboard.slice(0, 3),
    leaderboard,
    personalScore,
    isParticipant: Boolean(playerAddress && (finalization.registeredPlayers.includes(playerAddress) || personalScore)),
    stats,
    mapSnapshot: buildMapSnapshot(source.snapshot),
    finalization,
    rewards: playerAddress ? buildReviewRewards(source, playerAddress, finalization, personalScore) : null,
  };
};

export const fetchGameReviewClaimSummary = async (input: {
  worldName: string;
  chain: Chain;
  playerAddress: string;
}): Promise<GameReviewClaimSummary> => {
  const playerAddress = parseAddress(input.playerAddress);
  if (!playerAddress) throw new Error("Missing player address for claim summary.");
  const source = await loadReviewSource(input.worldName);
  const finalization = buildFinalization(source);
  const personalScore =
    buildLandingLeaderboard(source.snapshot, source.history).find((entry) => entry.address === playerAddress) ?? null;
  const rewards = buildReviewRewards(source, playerAddress, finalization, personalScore);
  return {
    canClaimNow: rewards.canClaimNow,
    alreadyClaimed: rewards.alreadyClaimed,
    lordsWonFormatted: rewards.lordsWonFormatted,
    chestsClaimedEstimate: rewards.chestsClaimedEstimate,
    claimBlockedReason: rewards.claimBlockedReason,
  };
};

const rankedPlayers = (snapshot: HeraldGameSnapshot): string[] =>
  modelRows(snapshot, "PlayerRegisteredPoints")
    .flatMap((row) => {
      const address = parseAddress(row.address);
      return address ? [{ address, points: toBigInt(row.registered_points) ?? 0n }] : [];
    })
    .toSorted((left, right) => (left.points === right.points ? 0 : left.points < right.points ? 1 : -1))
    .map((row) => row.address);

export const finalizeGameRankingAndMMR = async (input: {
  worldName: string;
  chain: Chain;
  signer: Account | AccountInterface;
}): Promise<FinalizeGameReviewResult> => {
  const profile = await buildWorldProfile(input.chain, input.worldName);
  const source = await loadReviewSource(input.worldName);
  const finalization = buildFinalization(source);
  const players = rankedPlayers(source.snapshot);
  const playersForSubmission = players.length > 0 ? players : finalization.registeredPlayers;
  if (playersForSubmission.length === 0) throw new Error("No registered players found for this game.");

  const manifest = patchManifestWithFactory(
    getGameManifest(input.chain, profile.worldId === "eternum" ? "eternum" : "blitz") as unknown as Record<
      string,
      unknown
    >,
    profile.worldAddress,
    profile.contractsBySelector,
  );
  const namespace = profile.namespace ?? namespaceForChain(input.chain);
  const prizeDistributionAddress = getContractByName(manifest, namespace, "prize_distribution_systems").address;
  const gamePrefix = source.gameId > 0 ? [source.gameId] : [];
  let rankingSubmitted = false;
  let mmrSubmitted = false;
  let mmrError: string | null = null;

  if (!finalization.rankingFinalized) {
    if (Math.max(finalization.registrationCount, finalization.registeredPlayers.length) === 1) {
      const onlyPlayer = finalization.registeredPlayers[0] ?? playersForSubmission[0];
      await executeObservedClientTransaction({
        account: input.signer,
        calls: [
          {
            contractAddress: prizeDistributionAddress,
            entrypoint: "blitz_prize_claim_no_game",
            calldata: [...gamePrefix, onlyPlayer],
          },
        ],
        surface: "game_review",
        operation: "blitz_prize_claim_no_game",
        chain: input.chain,
        worldName: input.worldName,
        worldAddress: profile.worldAddress,
        waitForConfirmation: false,
      });
    } else {
      const batches = chunk(playersForSubmission, RANKING_BATCH_SIZE);
      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        await executeObservedClientTransaction({
          account: input.signer,
          calls: [
            {
              contractAddress: prizeDistributionAddress,
              entrypoint: "blitz_prize_player_rank",
              calldata: [
                ...gamePrefix,
                randomTrialId(),
                index === 0 ? playersForSubmission.length : 0,
                batch.length,
                ...batch,
              ],
            },
          ],
          surface: "game_review",
          operation: "blitz_prize_player_rank",
          chain: input.chain,
          worldName: input.worldName,
          worldAddress: profile.worldAddress,
          waitForConfirmation: false,
        });
      }
    }
    rankingSubmitted = true;
  }

  const canSubmitMmr =
    finalization.mmrEnabled &&
    finalization.mmrTokenAddress &&
    !finalization.mmrCommitted &&
    playersForSubmission.length >= finalization.mmrMinPlayers;
  if (canSubmitMmr) {
    const mmrSystemsAddress = getContractByName(manifest, namespace, "mmr_systems").address;
    try {
      await commitAndClaimMMR({
        registeredPlayers: playersForSubmission.map(BigInt),
        mmrTokenAddress: finalization.mmrTokenAddress!,
        rpcUrl: profile.rpcUrl || env.VITE_PUBLIC_NODE_URL,
        signer: input.signer,
        commitAndClaimGameMmr: async ({ players: mmrPlayers }) =>
          executeObservedClientTransaction({
            account: input.signer,
            calls: [
              {
                contractAddress: mmrSystemsAddress,
                entrypoint: "commit_game_mmr_meta",
                calldata: [...gamePrefix, mmrPlayers.length, ...mmrPlayers],
              },
              {
                contractAddress: mmrSystemsAddress,
                entrypoint: "claim_game_mmr",
                calldata: [...gamePrefix, mmrPlayers.length, ...mmrPlayers],
              },
            ],
            surface: "game_review",
            operation: "commit_and_claim_game_mmr",
            chain: input.chain,
            worldName: input.worldName,
            worldAddress: profile.worldAddress,
            waitForConfirmation: false,
          }),
      });
      mmrSubmitted = true;
    } catch (error) {
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

export const claimGameReviewRewards = async (input: {
  worldName: string;
  chain: Chain;
  signer: Account | AccountInterface;
  playerAddress: string;
}): Promise<ClaimGameReviewRewardsResult> => {
  const playerAddress = parseAddress(input.playerAddress);
  if (!playerAddress) throw new Error("Missing player address for reward claim.");
  await claimGameReviewRewardsForPlayers({ ...input, playerAddresses: [playerAddress] });
  return { claimed: true, playerAddress };
};

const claimGameReviewRewardsForPlayers = async (input: {
  worldName: string;
  chain: Chain;
  signer: Account | AccountInterface;
  playerAddresses: string[];
}): Promise<ClaimGameReviewRewardsForPlayersResult> => {
  const playerAddresses = uniqueAddresses(input.playerAddresses);
  if (playerAddresses.length === 0) {
    return { claimed: true, claimedPlayers: 0, playerAddresses: [], batchesSubmitted: 0 };
  }
  const profile = await buildWorldProfile(input.chain, input.worldName);
  const manifest = patchManifestWithFactory(
    getGameManifest(input.chain, profile.worldId === "eternum" ? "eternum" : "blitz") as unknown as Record<
      string,
      unknown
    >,
    profile.worldAddress,
    profile.contractsBySelector,
  );
  const namespace = profile.namespace ?? namespaceForChain(input.chain);
  const prizeDistributionAddress = getContractByName(manifest, namespace, "prize_distribution_systems").address;
  const gamePrefix = profile.gameId && profile.gameId > 0 ? [profile.gameId] : [];
  const batches = chunk(playerAddresses, CLAIM_ALL_REWARDS_BATCH_SIZE);
  for (const batch of batches) {
    const calls: Call[] = [];
    if (env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS && BigInt(env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS) !== 0n) {
      calls.push({
        contractAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
        entrypoint: "request_random",
        calldata: [prizeDistributionAddress, 0, input.signer.address],
      });
    }
    calls.push({
      contractAddress: prizeDistributionAddress,
      entrypoint: "blitz_prize_claim",
      calldata: [...gamePrefix, batch.length, ...batch],
    });
    await executeObservedClientTransaction({
      account: input.signer,
      calls,
      surface: "game_review",
      operation: "blitz_prize_claim",
      chain: input.chain,
      worldName: input.worldName,
      worldAddress: profile.worldAddress,
      waitForConfirmation: true,
    });
  }
  return {
    claimed: true,
    claimedPlayers: playerAddresses.length,
    playerAddresses,
    batchesSubmitted: batches.length,
  };
};
