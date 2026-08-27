import type { SqlApi } from "./api";

type AsyncSqlApiMethodName = {
  [Key in keyof SqlApi]: SqlApi[Key] extends (...args: infer _Args) => Promise<unknown> ? Key : never;
}[keyof SqlApi];

type SqlFactDisposition = "keep-history" | "keep-aggregate" | "keep-external-snapshot" | "deleted-s4";

interface SqlFactOwnershipDecision {
  disposition: SqlFactDisposition;
  reason: string;
}

const keepHistory = (reason: string): SqlFactOwnershipDecision => ({ disposition: "keep-history", reason });
const keepAggregate = (reason: string): SqlFactOwnershipDecision => ({ disposition: "keep-aggregate", reason });
const keepExternalSnapshot = (reason: string): SqlFactOwnershipDecision => ({
  disposition: "keep-external-snapshot",
  reason,
});
const deletedS4 = (reason: string): SqlFactOwnershipDecision => ({ disposition: "deleted-s4", reason });

/**
 * Fact-level ownership audit for every public async SqlApi method.
 *
 * The `satisfies` constraint makes a new method a compile failure until its
 * ownership is adjudicated. S4 deletes the live-state entries after runtime
 * recovery and replacement consumers are proven.
 */
export const SQL_API_FACT_OWNERSHIP = {
  fetchQuest: deletedS4("Current quest/tile state now comes from RECS."),
  fetchSurroundingWonderBonus: deletedS4("The in-session wonder lookup now derives from Structure in RECS."),
  fetchTilesByCoords: deletedS4("Current TileOpt state now comes from the spatial projection."),
  fetchRealmSettlements: keepExternalSnapshot(
    "The pre-session settlement picker has no active GameSyncRuntime; in-session ownership does not use this API.",
  ),
  fetchStructuresByOwner: keepExternalSnapshot(
    "Pre-session, mobile, and headless consumers have no active GameSyncRuntime; in-session game views read RECS.",
  ),
  fetchRealmVillageSlots: keepExternalSnapshot(
    "The pre-session village planner has no active GameSyncRuntime and needs a settlement-slot snapshot.",
  ),
  fetchSettlementPlannerSnapshot: keepExternalSnapshot(
    "The pre-session settlement planner has no active GameSyncRuntime; no in-session consumer uses this snapshot.",
  ),
  fetchExploredTilesInBounds: keepExternalSnapshot(
    "The pre-session settlement planner has no active GameSyncRuntime and requests a bounded planning snapshot.",
  ),
  fetchTokenTransfers: deletedS4("The method had no consumer."),
  fetchStructureByCoord: deletedS4("Current Structure lookup now uses the RECS spatial projection."),
  fetchGlobalStructureExplorerAndGuildDetails: deletedS4(
    "The PlayerDataStore duplicate of structures, explorers, and owners was retired.",
  ),
  fetchAllTiles: keepExternalSnapshot(
    "The headless client and onchain agent do not yet host GameSyncRuntime; the game client does not use this API.",
  ),
  fetchHyperstructures: keepExternalSnapshot(
    "The headless client lacks GameSyncRuntime; in-session game views read RECS and the spatial projection.",
  ),
  fetchOtherStructures: deletedS4("Current Structure ownership and category now come from RECS."),
  fetchSwapEvents: keepHistory("Immutable swap history is a SQL read model."),
  fetchExplorerAddressOwner: keepExternalSnapshot(
    "The headless client lacks GameSyncRuntime; the game client resolves explorer ownership through Structure in RECS.",
  ),
  fetchBattleLogs: deletedS4("The method had no consumer."),
  fetchPlayerStructures: keepExternalSnapshot(
    "Pre-session settlement entry and the headless client have no active GameSyncRuntime; in-session views read RECS.",
  ),
  fetchResourceBalances: keepExternalSnapshot(
    "The headless client and onchain agent have not adopted GameSyncRuntime; the game client reads Resource from RECS.",
  ),
  fetchResourceBalancesAndProduction: deletedS4("Current balances and production now come from Resource in RECS."),
  fetchResourceBalancesWithProduction: deletedS4("The method had no consumer."),
  fetchSeasonEnded: deletedS4("Current season status is streamed into RECS."),
  fetchGuardsByStructure: keepExternalSnapshot(
    "The headless client lacks GameSyncRuntime; game and mobile UI derive guards from Structure in RECS.",
  ),
  fetchChestsNearPosition: deletedS4("Current chest occupancy now uses TileOpt in the spatial projection."),
  fetchPlayerStructureRelics: deletedS4("Current structure relic ownership now comes from Resource in RECS."),
  fetchPlayerArmyRelics: deletedS4("Current army relic ownership now comes from Resource in RECS."),
  fetchAllPlayerRelics: deletedS4("The duplicate relic aggregate was replaced by RECS-derived inventory."),
  fetchAllStructuresMapData: keepExternalSnapshot(
    "The headless client and onchain agent have not adopted GameSyncRuntime; the game map uses the projection.",
  ),
  fetchAllArmiesMapData: keepExternalSnapshot(
    "The headless client and onchain agent have not adopted GameSyncRuntime; the game map uses the projection.",
  ),
  fetchBuildingsByStructures: deletedS4("The method had no consumer."),
  fetchWorldAddress: keepAggregate("Indexer metadata identifies the world; it is not gameplay entity truth."),
  fetchHyperstructuresWithRealmCount: deletedS4(
    "Hyperstructure realm counts now derive from Structure in RECS and the spatial projection.",
  ),
  fetchStoryEvents: keepHistory("StoryEvent is immutable paginated history."),
  fetchStoryEventsSince: deletedS4("The method had no consumer."),
  fetchStoryEventsByEntity: keepHistory("StoryEvent is immutable paginated history."),
  fetchStoryEventsByOwner: keepHistory("StoryEvent is immutable paginated history."),
  fetchStoryEventsCount: keepAggregate("Pagination count over immutable StoryEvent history."),
  fetchRegisteredPlayerPoints: deletedS4("The method had no consumer."),
  fetchPlayerLeaderboard: keepAggregate(
    "Landing pagination has no active game RECS session; in-session consumers use only the aggregate over immutable StoryEvent history while rank and points read RECS.",
  ),
  fetchPlayerLeaderboardByAddress: keepAggregate(
    "Landing and post-game review lookup has no active game RECS session; its StoryEvent activity breakdown is an immutable-history aggregate, not current entity truth.",
  ),
} satisfies Record<string, SqlFactOwnershipDecision>;

type UnclassifiedAsyncSqlApiMethod = Exclude<AsyncSqlApiMethodName, keyof typeof SQL_API_FACT_OWNERSHIP>;
const allAsyncSqlApiMethodsAreClassified: Record<UnclassifiedAsyncSqlApiMethod, never> = {};
void allAsyncSqlApiMethodsAreClassified;
