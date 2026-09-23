/**
 * Per-game availability + metadata for a CHOSEN game, keyed by (chain id, game id).
 *
 * Herald's directory on the game's shard resolves registry/config metadata and the connected player's settlement
 * state. The card grid rides the same directory through the bulk worlds summary.
 */
import type { HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import type { ResolvedGameMode } from "@/config/game-modes/resolved-mode";
import { fetchHeraldGameDirectory, type GameRef, type Shard } from "@bibliothecadao/eternum/game-client";
import { requireOpenShard } from "@/runtime/world/shards";
import { gameKey } from "@/runtime/world/store";
import { useQueries } from "@tanstack/react-query";

interface WorldConfigMeta {
  /** The game's display name from its shard's directory. */
  name: string | null;
  ready: boolean;
  mode: ResolvedGameMode;
  // The shard this meta belongs to — downstream flows pick its Herald and contracts with it.
  chainId: string | null;
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
  registrationStartAt: number | null;
  registrationEndAt: number | null;
  // Dev mode - allows blitz settlement during ongoing games.
  devModeOn: boolean;
  // Blitz-only: whether the connected player already settled into the game.
  isPlayerRegistered: boolean | null;
  // Blitz-only: whether the connected player is on the game's fixed roster.
  isRosterMember: boolean | null;
  // Blitz-only: players on the fixed roster; settlement progress is settledPlayersCount over this.
  rosterCount: number | null;
  // Eternum-only: whether the connected player already has at least one settled realm.
  hasPlayerSettledRealm: boolean | null;
  // Global settled structure counts used by landing cards.
  settledPlayersCount: number | null;
  settledRealmsCount: number | null;
  settledVillagesCount: number | null;
}

interface WorldAvailability extends GameRef {
  worldKey: string;
  isAvailable: boolean;
  meta: WorldConfigMeta | null;
  isLoading: boolean;
  error: Error | null;
}

const emptyWorldConfigMeta = (): WorldConfigMeta => ({
  name: null,
  mode: "unknown",
  chainId: null,
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
  registrationStartAt: null,
  registrationEndAt: null,
  devModeOn: false,
  ready: false,
  isPlayerRegistered: null,
  isRosterMember: null,
  rosterCount: null,
  hasPlayerSettledRealm: null,
  settledPlayersCount: null,
  settledRealmsCount: null,
  settledVillagesCount: null,
});

const applyDirectoryGame = (meta: WorldConfigMeta, game: HeraldGameDirectoryEntry): void => {
  meta.name = game.name;
  meta.gameId = game.game_id;
  meta.ready = game.ready;
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
  meta.rosterCount = game.roster_count;
  meta.settledRealmsCount = game.settled_realms_count;
  meta.settledVillagesCount = game.settled_villages_count;
};

const fetchGameMeta = async (shard: Shard, gameId: number, playerAddress?: string | null): Promise<WorldConfigMeta> => {
  const meta = emptyWorldConfigMeta();
  const directory = await fetchHeraldGameDirectory(shard, playerAddress ?? undefined);
  const game = directory.games.find((candidate) => candidate.game_id === gameId);
  if (!game) return meta;

  applyDirectoryGame(meta, game);
  if (playerAddress && meta.mode === "blitz") {
    meta.isPlayerRegistered = game.player_state?.registered ?? false;
    meta.isRosterMember = game.player_state?.roster_member ?? false;
  } else if (playerAddress && (meta.mode === "eternum" || meta.mode === "frontier")) {
    meta.hasPlayerSettledRealm = game.player_state?.settled ?? false;
  }
  return meta;
};

const checkWorldAvailability = async (
  game: GameRef,
  playerAddress?: string | null,
): Promise<{ isAvailable: boolean; meta: WorldConfigMeta | null }> => {
  const shard = await requireOpenShard(game.chainId);
  const meta = await fetchGameMeta(shard, game.gameId, playerAddress);
  meta.chainId = shard.chainId;
  return { isAvailable: meta.gameId !== null, meta };
};

/**
 * Hook to check multiple games' availability with batched queries.
 * Auto-refreshes every 30 seconds to catch registration and phase updates.
 */
export const useWorldsAvailability = (
  worlds: GameRef[],
  enabled = true,
  playerAddress?: string | null,
  refetchIntervalMs?: number,
) => {
  const queries = useQueries({
    queries: worlds.map((world) => ({
      // Include playerAddress in query key so it refetches when user connects
      queryKey: ["worldAvailability", gameKey(world), playerAddress ?? "anonymous"],
      queryFn: () => checkWorldAvailability(world, playerAddress),
      enabled,
      refetchInterval: refetchIntervalMs,
      staleTime: 30 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
    })),
  });

  const results: Map<string, WorldAvailability> = new Map();

  queries.forEach((query, index) => {
    const world = worlds[index];
    const worldKey = gameKey(world);
    results.set(worldKey, {
      worldKey,
      chainId: world.chainId,
      gameId: world.gameId,
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
