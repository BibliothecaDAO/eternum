import type { Chain } from "@contracts";

/**
 * Active game scope for the s2 single-world arm.
 *
 * On the appchain, the persistent `s2` worlds host every game/season and each
 * per-game model leads with `game_id` as key[0]. Every Torii clause the client
 * builds (streams, snapshots, targeted queries) must carry that prefix or it
 * reads other games' state — the ghost-settlement / wrong-clock class of bug.
 * Legacy chains keep one world per game (`s1_eternum`, gameId 0) and build the
 * exact same clauses they always have.
 *
 * Set once during bootstrap, before any subscription or query is created.
 */

export type GameNamespace = "s1_eternum" | "s2";

export const namespaceForChain = (chain: Chain): GameNamespace => (chain === "appchain" ? "s2" : "s1_eternum");

let activeNamespace: GameNamespace = "s1_eternum";
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
 * s2 entrypoint takes `game_id` first; legacy worlds take nothing. Spread this
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

/** The active game id as a KeysClause key slot (unpadded hex — D16-pinned encoding). */
export const gameIdKey = (): string => `0x${activeGameId.toString(16)}`;

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
  "AddressName",
  "BiomeDiscovered",
  "BuildingCategoryConfig",
  "ChainConfig",
  "GameCounter",
  "HyperstrtConstructConfig",
  "Preset",
  "PresetConfig",
  "PresetGameConfig",
  "RNG",
  "ResourceBridgeWtlConfig",
  "ResourceFactoryConfig",
  "ResourceList",
  "ResourceMinMaxList",
  "ResourceRevBridgeWtlConfig",
  "Series",
  "SeriesChestRewardState",
  "StructureLevelConfig",
  "WeightConfig",
  // events
  "TrophyCreation",
  "TrophyProgression",
]);

export const s2GlobalModelNames = (): ReadonlySet<string> => S2_GLOBAL_MODELS;

/**
 * Whether a fully-qualified model's clauses must be prefixed with the active
 * game id. Always false on the legacy arm (gameId 0).
 */
export const isGameScopedModel = (qualifiedModel: string): boolean => {
  if (!isGameScoped()) return false;
  const separatorIndex = qualifiedModel.indexOf("-");
  const bareName = separatorIndex >= 0 ? qualifiedModel.slice(separatorIndex + 1) : qualifiedModel;
  return !S2_GLOBAL_MODELS.has(bareName);
};
