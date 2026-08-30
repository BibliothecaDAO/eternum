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
import { getGameManifest } from "@contracts";
import { getContractByName } from "@dojoengine/core";
import type { GameChain as Chain } from "@realms-world/chain";
import type { HeraldGameSnapshot, HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { RESOURCE_PRECISION, tileDataToTile } from "@bibliothecadao/types";
import type { Account, AccountInterface } from "starknet";
import { buildGameReviewDerivedMetrics, type GameReviewValueMetric } from "./game-review-stats-utils";

const RANKING_BATCH_SIZE = 200;
const HISTORY_PAGE_SIZE = 500;
const MAX_MAP_SNAPSHOT_TILES = 4_200;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

type Row = Record<string, unknown>;

interface ReviewFinalizationMeta {
  registeredPlayers: string[];
  registrationCount: number;
  finalTrialId: bigint | null;
  rankingFinalized: boolean;
  devModeOn: boolean;
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
  chests: number;
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

interface ReviewSource {
  gameId: number;
  history: HeraldHistoryEvent[];
  snapshot: HeraldGameSnapshot;
  transactionCount: number;
  world: WorldDeployment;
}

interface FinalizeGameReviewResult {
  rankingSubmitted: boolean;
  rankingSkipped: boolean;
  totalPlayers: number;
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
  const registration = record(config.blitz_registration_config);
  const registeredPlayers = uniqueAddresses(modelRows(source.snapshot, "BlitzSettlement").map((row) => row.player));
  const configuredRegistrations = Math.max(0, toNumber(registration.registration_count));
  const finalTrialId = toBigInt(registry.final_trial_id);
  const seasonEndAtValue = toNumber(registry.end_at);
  const seasonEndAt = seasonEndAtValue > 0 ? seasonEndAtValue : null;
  const registrationGraceSeconds = Math.max(0, toNumber(registry.registration_grace_seconds));
  return {
    registeredPlayers,
    registrationCount: configuredRegistrations || registeredPlayers.length,
    finalTrialId,
    rankingFinalized: finalTrialId !== null && finalTrialId > 0n,
    devModeOn: toBoolean(registry.dev_mode_on),
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
  if (!finalization.rankingFinalized || finalization.finalTrialId === null) {
    return {
      scoreSubmitted: false,
      isRanked: false,
      chests: 0,
      eliteTicketEarned: false,
      eliteTicketReason: "Submit score and finalize rankings to evaluate elite ticket eligibility.",
    };
  }
  const rankRow = modelRows(source.snapshot, "PlayerRank").find((row) => sameFelt(row.player, playerAddress));
  const rank = Math.max(0, toNumber(rankRow?.rank) || personalScore?.rank || 0);
  if (rank <= 0) {
    return {
      scoreSubmitted: true,
      isRanked: false,
      chests: 0,
      eliteTicketEarned: false,
      eliteTicketReason: "Player is not ranked in the final results.",
    };
  }
  const prize = modelRows(source.snapshot, "RankPrize").find((row) => toNumber(row.rank) === rank) ?? {};
  const trial =
    modelRows(source.snapshot, "PlayersRankTrial").find((row) => sameFelt(row.nonce, finalization.finalTrialId)) ?? {};
  const eliteTicketEarned = toBoolean(prize.grant_elite_nft);
  return {
    scoreSubmitted: true,
    isRanked: true,
    chests: Math.max(0, toNumber(rankRow?.chests)),
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

const rankedPlayers = (snapshot: HeraldGameSnapshot): string[] => {
  const pointsByPlayer = new Map(
    modelRows(snapshot, "PlayerRegisteredPoints").flatMap((row) => {
      const address = parseAddress(row.address);
      return address ? [[address, toBigInt(row.registered_points) ?? 0n] as const] : [];
    }),
  );
  return uniqueAddresses(modelRows(snapshot, "BlitzSettlement").map((row) => row.player))
    .map((address) => ({ address, points: pointsByPlayer.get(address) ?? 0n }))
    .toSorted((left, right) => {
      if (left.points !== right.points) return left.points > right.points ? -1 : 1;
      const leftAddress = BigInt(left.address);
      const rightAddress = BigInt(right.address);
      return leftAddress < rightAddress ? -1 : leftAddress > rightAddress ? 1 : 0;
    })
    .map(({ address }) => address);
};

export const finalizeGameRanking = async (input: {
  worldName: string;
  chain: Chain;
  signer: Account | AccountInterface;
}): Promise<FinalizeGameReviewResult> => {
  const profile = await buildWorldProfile(input.chain, input.worldName);
  const source = await loadReviewSource(input.worldName);
  const finalization = buildFinalization(source);
  const playersForSubmission = rankedPlayers(source.snapshot);
  if (playersForSubmission.length === 0) throw new Error("No registered players found for this game.");
  if (playersForSubmission.length !== finalization.registrationCount) {
    throw new Error(
      `Result roster has ${playersForSubmission.length} players; the game registered ${finalization.registrationCount}.`,
    );
  }

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

  if (!finalization.rankingFinalized) {
    const trialId = randomTrialId();
    const batches = chunk(playersForSubmission, RANKING_BATCH_SIZE);
    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      await executeObservedClientTransaction({
        account: input.signer,
        calls: [
          {
            contractAddress: prizeDistributionAddress,
            entrypoint: "blitz_prize_player_rank",
            calldata: [...gamePrefix, trialId, index === 0 ? playersForSubmission.length : 0, batch.length, ...batch],
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
    rankingSubmitted = true;
  }

  return {
    rankingSubmitted,
    rankingSkipped: !rankingSubmitted,
    totalPlayers: playersForSubmission.length,
  };
};
