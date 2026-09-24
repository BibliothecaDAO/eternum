/**
 * Per-game availability and metadata for a CHOSEN game, read from its shard's directory with the connected player's
 * standing. It shares that directory's one cache entry with every other reader of the shard's directory.
 */
import type { HeraldGameDirectory, HeraldGameDirectoryEntry } from "@bibliothecadao/eternum/game-sync";
import type { ResolvedGameMode } from "@/config/game-modes/resolved-mode";
import type { GameRef } from "@bibliothecadao/eternum/game-client";
import { shardDirectoryQuery } from "@/runtime/world/shard-directory";
import { gameKey } from "@/runtime/world/store";
import { useQueries } from "@tanstack/react-query";

interface WorldConfigMeta {
  /** The game's display name from its shard's directory. */
  name: string | null;
  ready: boolean;
  mode: ResolvedGameMode;
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
  meta.settledPlayersCount = game.player_count;
  meta.rosterCount = game.roster_count;
  meta.settledRealmsCount = game.settled_realms_count;
  meta.settledVillagesCount = game.settled_villages_count;
};

/** The game's meta from its shard's directory; a game the directory does not list has no game id. */
const readGameMeta = (directory: HeraldGameDirectory, game: GameRef, playerAddress: string | null) => {
  const meta = emptyWorldConfigMeta();
  const entry = directory.games.find((candidate) => candidate.game_id === game.gameId);
  if (!entry) return { isAvailable: false, meta };

  applyDirectoryGame(meta, entry);
  if (playerAddress && meta.mode === "blitz") {
    meta.isPlayerRegistered = entry.player_state?.registered ?? false;
    meta.isRosterMember = entry.player_state?.roster_member ?? false;
  } else if (playerAddress && (meta.mode === "eternum" || meta.mode === "frontier")) {
    meta.hasPlayerSettledRealm = entry.player_state?.settled ?? false;
  }
  return { isAvailable: true, meta };
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
      ...shardDirectoryQuery(world.chainId, playerAddress ?? null),
      select: (directory: HeraldGameDirectory) => readGameMeta(directory, world, playerAddress ?? null),
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
