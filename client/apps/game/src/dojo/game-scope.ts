import type { Chain } from "@contracts";

/**
 * Active game scope for the s2 single-world arm.
 *
 * On the appchain, one persistent `s2_blitz` world hosts every game and each
 * per-game model leads with `game_id` as key[0]. Every Torii clause the client
 * builds (streams, snapshots, targeted queries) must carry that prefix or it
 * reads other games' state — the ghost-settlement / wrong-clock class of bug.
 * Legacy chains keep one world per game (`s1_eternum`, gameId 0) and build the
 * exact same clauses they always have.
 *
 * Set once during bootstrap, before any subscription or query is created.
 */

export type GameNamespace = "s1_eternum" | "s2_blitz";

export const namespaceForChain = (chain: Chain): GameNamespace => (chain === "appchain" ? "s2_blitz" : "s1_eternum");

let activeNamespace: GameNamespace = "s1_eternum";
let activeGameId = 0;

export const setGameScope = (namespace: GameNamespace, gameId: number) => {
  activeNamespace = namespace;
  activeGameId = gameId;
};

export const getGameNamespace = (): GameNamespace => activeNamespace;

export const getScopedGameId = (): number => activeGameId;

export const isGameScoped = (): boolean => activeGameId > 0;

/** Fully-qualified Torii model name for the active arm, e.g. `s2_blitz-TileOpt`. */
export const gameModel = (name: string): string => `${activeNamespace}-${name}`;

/** The active game id as a KeysClause key slot (unpadded hex — D16-pinned encoding). */
export const gameIdKey = (): string => `0x${activeGameId.toString(16)}`;

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
