/**
 * Per-game availability + metadata for a CHOSEN game, keyed by launch name.
 *
 * Appchain-only (amendment S1): a "world" ref here is a game row inside a
 * directory world. Herald's directory resolves registry/config metadata; a
 * selective snapshot adds the connected player's settlement state. The card
 * grid rides the same directory through the bulk worlds summary.
 */
import { WORLD_AVAILABILITY_QUERY_KEY } from "@/hooks/world-list-queries";
import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import type { ResolvedGameMode } from "@/config/game-modes/resolved-mode";
import { resolveWorldIdForGame } from "@/runtime/world/game-registry";
import { fetchHeraldGameDirectory } from "@/runtime/world/herald-http";
import { getDefaultWorld, getWorldById } from "@/runtime/world/world-directory";
import type { WorldDeployment } from "@/runtime/world/world-directory";
import type { GameChain as Chain } from "@realms-world/chain";
import { useQueries } from "@tanstack/react-query";

export interface WorldConfigMeta {
  mode: ResolvedGameMode;
  // The directory world this meta belongs to — downstream flows pick their
  // deployment (Herald, contract map) with it.
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

const applyDirectoryGame = (meta: WorldConfigMeta, game: HeraldGameDirectoryEntry): void => {
  meta.gameId = game.game_id;
  meta.mode = game.mode ?? "unknown";
  meta.startSettlingAt = game.clock.start_settling_at;
  meta.startMainAt = game.clock.start_main_at;
  meta.endAt = game.clock.end_at;
  meta.seasonDurationSeconds = Math.max(0, game.clock.end_at - game.clock.start_main_at);
  meta.devModeOn = game.dev_mode_on;
  meta.registrationCount = game.registration?.count ?? null;
  meta.registrationCountMax = game.registration?.max ?? null;
  meta.registrationStartAt = game.registration?.start_at ?? null;
  meta.registrationEndAt = game.clock.start_main_at;
  meta.feeAmount = game.registration ? BigInt(game.registration.fee_amount) : 0n;
  meta.singleRealmMode = game.settlement?.single_realm_mode ?? false;
  meta.twoPlayerMode = game.settlement?.two_player_mode ?? false;
  meta.settlementLayerMax = game.settlement?.layer_max ?? null;
  meta.settlementLayersSkipped = game.settlement?.layers_skipped ?? null;
  meta.settlementBaseDistance = game.settlement?.base_distance ?? null;
  meta.spiresLayerDistance = game.settlement?.spires_layer_distance ?? null;
  meta.spiresMaxCount = game.settlement?.spires_max_count ?? null;
  meta.spiresSettledCount = game.settlement?.spires_settled_count ?? null;
  meta.mapCenterOffset = game.settlement?.map_center_offset ?? null;
  meta.settledPlayersCount = game.player_count;
  meta.settledRealmsCount = game.settled_realms_count;
  meta.settledVillagesCount = game.settled_villages_count;
};

const fetchGameMeta = async (
  world: WorldDeployment,
  gameName: string,
  playerAddress?: string | null,
): Promise<WorldConfigMeta> => {
  const meta = emptyWorldConfigMeta();
  const directory = await fetchHeraldGameDirectory(world, playerAddress ?? undefined);
  const game = directory.games.find((candidate) => candidate.name === gameName);
  if (!game) return meta;

  applyDirectoryGame(meta, game);
  meta.entryTokenAddress = directory.chain_config?.entry_token_address ?? null;
  meta.feeTokenAddress = directory.chain_config?.fee_token_address ?? null;
  meta.mmrEnabled = directory.chain_config?.mmr_enabled ?? false;
  if (playerAddress && meta.mode === "blitz") {
    meta.isPlayerRegistered = game.player_state?.registered ?? false;
  } else if (playerAddress && meta.mode === "eternum") {
    meta.hasPlayerSettledRealm = game.player_state?.settled ?? false;
  }
  return meta;
};

const checkWorldAvailability = async (
  world: WorldRef,
  playerAddress?: string | null,
): Promise<{ isAvailable: boolean; meta: WorldConfigMeta | null }> => {
  const worldId = world.worldId ?? (await resolveWorldIdForGame(world.name)) ?? undefined;
  const deployment = getWorldById(worldId) ?? getDefaultWorld();

  const meta = await fetchGameMeta(deployment, world.name, playerAddress);
  if (meta) meta.worldId = deployment.id;
  return { isAvailable: meta.gameId !== null, meta };
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
