import type { GameChain as Chain } from "@realms-world/chain";
import { findGameSyncModel, getGameSyncModelsForChannel } from "@bibliothecadao/eternum/game-sync";

/**
 * Active game scope for the phase-one s2 worlds.
 *
 * The persistent `s2` worlds host every game/season and each
 * per-game model leads with `game_id` as key[0]. Every Torii clause the client
 * builds (streams, snapshots, targeted queries) must carry that prefix or it
 * reads other games' state — the ghost-settlement / wrong-clock class of bug.
 * Set once during bootstrap, before any subscription or query is created.
 */

export type GameNamespace = "s2";

export const namespaceForChain = (_chain: Chain): GameNamespace => "s2";

let activeNamespace: GameNamespace = "s2";
let activeGameId = 0;

export const setGameScope = (namespace: GameNamespace, gameId: number) => {
  activeNamespace = namespace;
  activeGameId = gameId;
};

export const getGameNamespace = (): GameNamespace => activeNamespace;

export const getScopedGameId = (): number => activeGameId;

export const isGameScoped = (): boolean => activeGameId > 0;

/**
 * Leading calldata for direct (non-provider) game-system calls: every deployed
 * s2 entrypoint takes `game_id` first; single-world deployments take nothing. Spread this
 * ahead of the call's own arguments.
 */
export const gameCallArgs = (): number[] => (activeGameId > 0 ? [activeGameId] : []);

/** Fully-qualified Torii model name for the active arm, e.g. `s2-TileOpt`. */
export const gameModel = (name: string): string => `${activeNamespace}-${name}`;

/**
 * Qualified model/table name on the appchain worlds, independent of the
 * active scope — for landing-side queries that target a CHOSEN world before
 * bootstrap. All appchain worlds share one namespace by design, so this is a
 * constant; the W2 namespace rename lands here (via namespaceForChain) alone.
 */
export const appchainModel = (name: string): string => `${namespaceForChain("appchain")}-${name}`;

/**
 * Torii KeysClause slot encoding: keys MUST be unpadded hex. Decimal key
 * strings do not survive the grpc key encoding and match nothing — the Aug 10
 * Building-clause incident, later found again in getEntitiesFromTorii. Every
 * clause key this app builds goes through this encoder (packages/torii has
 * this local encoder for query builders that cannot depend on app state.
 */
export const hexKey = (value: number | bigint): string => `0x${BigInt(value).toString(16)}`;

/** The active game id as a KeysClause key slot (unpadded hex — D16-pinned encoding). */
export const gameIdKey = (): string => hexKey(activeGameId);

/**
 * RECS entity keys for per-game models (gameEntityKey, buildingEntityKey) and
 * the WorldConfig row (worldConfigKey). Single source: packages/core's
 * config-manager, which reads the game id set by configManager.setActiveGame —
 * the bootstrap line adjacent to setGameScope, always fed the same
 * profile.gameId. Re-exported here so client call sites keep one import path;
 * never use gameEntityKey for chain-global models (AddressName, preset
 * tables, ChainConfig, ...).
 */
// Key helpers are core's single implementation, imported via its subpath
// export rather than the package root: evaluating the core barrel runs
// module-scope resource tables that break tests partially mocking
// @bibliothecadao/types, and drags all of core into every game-scope
// consumer. The subpath resolves to the same module instance as the barrel
// re-export (esm chunk splitting in dist, alias to the same source file in
// vitest), so the active-game-id mirror stays singular.
export { buildingEntityKey, gameEntityKey, worldConfigKey } from "@bibliothecadao/eternum/game-entity-keys";

// s2 models and events WITHOUT a game_id key[0] (chain singletons, preset
// rulebook side tables, player identity, series rows). Everything else in the
// s2 world is per-game. Derived from manifest_appchain.json key flags and
// pinned against it by game-scope.test.ts — fix the test, not this list.
const S2_GLOBAL_MODELS = new Set([
  "BiomeDiscovered",
  "ChainConfig",
  "GameCounter",
  "Preset",
  "PresetConfig",
  "PresetGameConfig",
  "RNG",
  "ResourceMinMaxList",
  "ResourceRevBridgeWtlConfig",
  "Series",
  "SeriesChestRewardState",
  // events
  "TrophyCreation",
  "TrophyProgression",
]);

export const s2GlobalModelNames = (): ReadonlySet<string> =>
  new Set([
    ...S2_GLOBAL_MODELS,
    ...getGameSyncModelsForChannel("gamewide-entity", { includeS2Only: true })
      .filter(({ s2Scope }) => s2Scope === "chain")
      .map(({ name }) => name),
  ]);

/**
 * Whether a fully-qualified model's clauses must be prefixed with the active
 * game id. Always false in the s1 world (gameId 0).
 */
export const isGameScopedModel = (qualifiedModel: string): boolean => {
  if (!isGameScoped()) return false;
  const separatorIndex = qualifiedModel.indexOf("-");
  const bareName = separatorIndex >= 0 ? qualifiedModel.slice(separatorIndex + 1) : qualifiedModel;
  const syncModel = findGameSyncModel(bareName);
  if (syncModel) return syncModel.s2Scope === "game";
  return !S2_GLOBAL_MODELS.has(bareName);
};
