/**
 * Per-game availability + metadata for a CHOSEN game, keyed by launch name.
 *
 * Appchain-only (amendment S1): a "world" ref here is a game row inside a
 * directory world — one joined query against that world's torii resolves the
 * game's registry row (clock, dev mode), its per-game WorldConfig
 * (registration + settlement modes) and the chain-global ChainConfig
 * (fee/entry tokens). The entry modal polls this while open; the card grid
 * rides the bulk worlds summary instead.
 */
import { WORLD_AVAILABILITY_QUERY_KEY } from "@/hooks/world-list-queries";
import { isToriiAvailable } from "@/runtime/world/factory-resolver";
import {
  parseMaybeBooleanFlag,
  resolveGameModeFromBlitzFlag,
  type ResolvedGameMode,
} from "@/config/game-modes/resolved-mode";
import { appchainModel } from "@/dojo/game-scope";
import { buildPlayerBlitzSettlementStatusQuery } from "@/services/blitz/blitz-settlement-sql";
import { nameToPaddedFelt } from "@/runtime/world/normalize";
import { resolveAppchainWorldIdForGame } from "@/runtime/world/game-registry";
import { getDefaultWorld, getWorldById } from "@/runtime/world/world-directory";
import type { Chain } from "@contracts";
import { useQueries } from "@tanstack/react-query";

const parseMaybeHexToNumber = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    try {
      if (v.startsWith("0x") || v.startsWith("0X")) return Number(BigInt(v));
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  return null;
};

const parseMaybeHexToBigInt = (v: unknown): bigint | null => {
  if (v == null) return null;
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string") {
    try {
      return BigInt(v);
    } catch {
      return null;
    }
  }
  return null;
};

const parseMaybeHexToAddress = (v: unknown): string | null => {
  const bigIntVal = parseMaybeHexToBigInt(v);
  if (bigIntVal == null || bigIntVal === 0n) return null;
  return `0x${bigIntVal.toString(16)}`;
};

export interface WorldConfigMeta {
  mode: ResolvedGameMode;
  // The directory world this meta belongs to — downstream flows pick their
  // deployment (torii, contract map) with it.
  worldId: string | null;
  // The GameRegistry id this meta describes — the settle flow requires it
  // (registration targets a chosen game, never ambient scope).
  gameId: number | null;
  startSettlingAt: number | null;
  startMainAt: number | null;
  endAt: number | null;
  seasonDurationSeconds: number | null;
  // Eternum spacing config — dormant until the eternum world lands (W5).
  settlementBaseDistance: number | null;
  spiresLayerDistance: number | null;
  spiresMaxCount: number | null;
  spiresSettledCount: number | null;
  settlementLayerMax: number | null;
  settlementLayersSkipped: number | null;
  mapCenterOffset: number | null;
  seasonPassAddress: string | null;
  villagePassAddress: string | null;
  registrationCount: number | null;
  registrationCountMax: number | null;
  singleRealmMode: boolean;
  twoPlayerMode: boolean;
  // Blitz registration config
  entryTokenAddress: string | null;
  feeTokenAddress: string | null;
  feeAmount: bigint;
  registrationStartAt: number | null;
  registrationEndAt: number | null;
  // MMR
  mmrEnabled: boolean;
  // Dev mode - allows blitz settlement during ongoing games.
  devModeOn: boolean;
  // Blitz-only: whether the connected player already settled into the game.
  isPlayerRegistered: boolean | null;
  // Eternum-only: whether the connected player already has at least one settled realm.
  hasPlayerSettledRealm: boolean | null;
  // Global settled structure counts used by landing cards.
  settledPlayersCount: number | null;
  settledRealmsCount: number | null;
  settledVillagesCount: number | null;
  // Reward distribution contract for this world
  prizeDistributionAddress: string | null;
  // Current fee-token balance held by the reward distribution contract.
  winnerJackpotAmount: bigint | null;
}

interface WorldRef {
  name: string;
  chain?: Chain;
  worldId?: string;
}

export const getWorldKey = (world: WorldRef): string => (world.chain ? `${world.chain}:${world.name}` : world.name);

interface WorldAvailability {
  worldKey: string;
  worldName: string;
  chain?: Chain;
  isAvailable: boolean;
  meta: WorldConfigMeta | null;
  isLoading: boolean;
  error: Error | null;
}

const emptyWorldConfigMeta = (): WorldConfigMeta => ({
  mode: "unknown",
  worldId: null,
  gameId: null,
  startSettlingAt: null,
  startMainAt: null,
  endAt: null,
  seasonDurationSeconds: null,
  settlementBaseDistance: null,
  spiresLayerDistance: null,
  spiresMaxCount: null,
  spiresSettledCount: null,
  settlementLayerMax: null,
  settlementLayersSkipped: null,
  mapCenterOffset: null,
  seasonPassAddress: null,
  villagePassAddress: null,
  registrationCount: null,
  registrationCountMax: null,
  singleRealmMode: false,
  twoPlayerMode: false,
  entryTokenAddress: null,
  feeTokenAddress: null,
  feeAmount: 0n,
  registrationStartAt: null,
  registrationEndAt: null,
  mmrEnabled: false,
  devModeOn: false,
  isPlayerRegistered: null,
  hasPlayerSettledRealm: null,
  settledPlayersCount: null,
  settledRealmsCount: null,
  settledVillagesCount: null,
  prizeDistributionAddress: null,
  winnerJackpotAmount: null,
});

/**
 * Whether the player already holds a settlement row for this game.
 * Blitz settles in one step, so the settlement row itself is the source of truth.
 */
const fetchPlayerRegistration = async (
  toriiBaseUrl: string,
  playerAddress: string,
  gameId: number,
): Promise<boolean | null> => {
  try {
    const query = buildPlayerBlitzSettlementStatusQuery(playerAddress, gameId);
    const response = await fetch(`${toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`);
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>[];
    return data.length > 0;
  } catch {
    // Silently fail - registration check is best-effort
  }
  return null;
};

const buildGameMetaQuery = (paddedNameFelt: string) => `
  SELECT
    g.game_id AS game_id,
    g.dev_mode_on AS dev_mode_on,
    g.start_settling_at AS start_settling_at,
    g.start_main_at AS start_main_at,
    g.end_at AS end_at,
    c.blitz_mode_on AS blitz_mode_on,
    c."blitz_registration_config.registration_count" AS registration_count,
    c."blitz_registration_config.registration_count_max" AS registration_count_max,
    c."blitz_registration_config.registration_start_at" AS registration_start_at,
    c."blitz_registration_config.fee_amount" AS fee_amount,
    c."blitz_settlement_config.single_realm_mode" AS single_realm_mode,
    c."blitz_settlement_config.two_player_mode" AS two_player_mode,
    c."settlement_config.layer_max" AS settlement_layer_max,
    c."settlement_config.layers_skipped" AS settlement_layers_skipped,
    c."settlement_config.base_distance" AS settlement_base_distance,
    c."settlement_config.spires_max_count" AS spires_max_count,
    c."settlement_config.spires_settled_count" AS spires_settled_count,
    c.map_center_offset AS map_center_offset,
    cc.entry_token_address AS entry_token_address,
    cc.fee_token AS fee_token
  FROM "${appchainModel("GameRegistry")}" g
  JOIN "${appchainModel("WorldConfig")}" c ON c.game_id = g.game_id
  CROSS JOIN "${appchainModel("ChainConfig")}" cc
  WHERE g.name = "${paddedNameFelt}"
  LIMIT 1;
`;

const fetchGameMeta = async (
  toriiBaseUrl: string,
  gameName: string,
  playerAddress?: string | null,
): Promise<WorldConfigMeta> => {
  const meta = emptyWorldConfigMeta();

  try {
    const query = buildGameMetaQuery(nameToPaddedFelt(gameName));
    const response = await fetch(`${toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`);
    if (!response.ok) return meta;
    const [row] = (await response.json()) as Record<string, unknown>[];
    if (!row) return meta;

    const gameId = parseMaybeHexToNumber(row.game_id);
    if (gameId == null || gameId <= 0) return meta;

    meta.gameId = gameId;
    meta.mode = resolveGameModeFromBlitzFlag(row.blitz_mode_on);
    meta.startSettlingAt = parseMaybeHexToNumber(row.start_settling_at);
    meta.startMainAt = parseMaybeHexToNumber(row.start_main_at);
    meta.endAt = parseMaybeHexToNumber(row.end_at);
    if (meta.startMainAt != null && meta.endAt != null && meta.endAt >= meta.startMainAt) {
      meta.seasonDurationSeconds = meta.endAt - meta.startMainAt;
    }
    meta.devModeOn = (parseMaybeHexToNumber(row.dev_mode_on) ?? 0) !== 0;
    meta.registrationCount = parseMaybeHexToNumber(row.registration_count);
    meta.registrationCountMax = parseMaybeHexToNumber(row.registration_count_max);
    meta.registrationStartAt = parseMaybeHexToNumber(row.registration_start_at);
    // Registration closes when the main phase opens.
    meta.registrationEndAt = meta.startMainAt;
    meta.feeAmount = parseMaybeHexToBigInt(row.fee_amount) ?? 0n;
    meta.singleRealmMode = parseMaybeBooleanFlag(row.single_realm_mode) ?? false;
    meta.twoPlayerMode = parseMaybeBooleanFlag(row.two_player_mode) ?? false;
    meta.entryTokenAddress = parseMaybeHexToAddress(row.entry_token_address);
    meta.feeTokenAddress = parseMaybeHexToAddress(row.fee_token);
    // Eternum settlement-planner geometry + spire progress (W3 put these on
    // the per-game WorldConfig; the planner throws without them).
    meta.settlementLayerMax = parseMaybeHexToNumber(row.settlement_layer_max);
    meta.settlementLayersSkipped = parseMaybeHexToNumber(row.settlement_layers_skipped);
    meta.settlementBaseDistance = parseMaybeHexToNumber(row.settlement_base_distance);
    meta.spiresMaxCount = parseMaybeHexToNumber(row.spires_max_count);
    meta.spiresSettledCount = parseMaybeHexToNumber(row.spires_settled_count);
    meta.mapCenterOffset = parseMaybeHexToNumber(row.map_center_offset);

    if (playerAddress && meta.mode === "blitz") {
      meta.isPlayerRegistered = await fetchPlayerRegistration(toriiBaseUrl, playerAddress, gameId);
    }
  } catch {
    // Silently fail - metadata fetch is best-effort
  }
  return meta;
};

const checkWorldAvailability = async (
  world: WorldRef,
  playerAddress?: string | null,
): Promise<{ isAvailable: boolean; meta: WorldConfigMeta | null }> => {
  const worldId = world.worldId ?? (await resolveAppchainWorldIdForGame(world.name)) ?? undefined;
  const deployment = getWorldById(worldId) ?? getDefaultWorld();

  const isAvailable = await isToriiAvailable(deployment.toriiBaseUrl);
  if (!isAvailable) {
    return { isAvailable: false, meta: null };
  }

  const meta = await fetchGameMeta(deployment.toriiBaseUrl, world.name, playerAddress);
  if (meta) meta.worldId = deployment.id;
  return { isAvailable: true, meta };
};

/**
 * Hook to check multiple games' availability with batched queries.
 * Auto-refreshes every 30 seconds to catch registration and phase updates.
 */
export const useWorldsAvailability = (worlds: WorldRef[], enabled = true, playerAddress?: string | null) => {
  const queries = useQueries({
    queries: worlds.map((world) => ({
      // Include playerAddress in query key so it refetches when user connects
      queryKey: [...WORLD_AVAILABILITY_QUERY_KEY, getWorldKey(world), playerAddress ?? "anonymous"],
      queryFn: () => checkWorldAvailability(world, playerAddress),
      enabled: enabled && !!world.name,
      staleTime: 30 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchInterval: 30 * 1000,
      refetchIntervalInBackground: false,
      retry: 1,
    })),
  });

  const results: Map<string, WorldAvailability> = new Map();

  queries.forEach((query, index) => {
    const world = worlds[index];
    const worldKey = getWorldKey(world);
    results.set(worldKey, {
      worldKey,
      worldName: world.name,
      chain: world.chain,
      isAvailable: query.data?.isAvailable ?? false,
      meta: query.data?.meta ?? null,
      isLoading: query.isLoading || (query.data === undefined && query.error == null),
      error: query.error as Error | null,
    });
  });

  const isAnyLoading = queries.some((q) => q.isLoading || (q.data === undefined && q.error == null));
  const allSettled = queries.every((q) => q.data !== undefined || q.error != null);

  return {
    results,
    isAnyLoading,
    allSettled,
    refetchAll: () => Promise.all(queries.map((q) => q.refetch())),
  };
};
