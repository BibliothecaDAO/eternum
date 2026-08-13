import type { SqlApi } from "./api";

type AsyncSqlApiMethodName = {
  [Key in keyof SqlApi]: SqlApi[Key] extends (...args: infer _Args) => Promise<unknown> ? Key : never;
}[keyof SqlApi];

type SqlFactDisposition =
  | "keep-history"
  | "keep-aggregate"
  | "delete-live-state-s4"
  | "review-in-s2-s3"
  | "review-in-s3";

interface SqlFactOwnershipDecision {
  disposition: SqlFactDisposition;
  reason: string;
}

const keepHistory = (reason: string): SqlFactOwnershipDecision => ({ disposition: "keep-history", reason });
const keepAggregate = (reason: string): SqlFactOwnershipDecision => ({ disposition: "keep-aggregate", reason });
const deleteLiveState = (reason: string): SqlFactOwnershipDecision => ({
  disposition: "delete-live-state-s4",
  reason,
});
const reviewInS2S3 = (reason: string): SqlFactOwnershipDecision => ({ disposition: "review-in-s2-s3", reason });
const reviewInS3 = (reason: string): SqlFactOwnershipDecision => ({ disposition: "review-in-s3", reason });

/**
 * Fact-level ownership audit for every public async SqlApi method.
 *
 * The `satisfies` constraint makes a new method a compile failure until its
 * ownership is adjudicated. S4 deletes the live-state entries after runtime
 * recovery and replacement consumers are proven.
 */
export const SQL_API_FACT_OWNERSHIP = {
  fetchQuest: deleteLiveState("Current quest/tile state must come from RECS."),
  fetchFirstStructure: deleteLiveState("Bootstrap selection must select from the authoritative Structure snapshot."),
  fetchSurroundingWonderBonus: reviewInS3("Decide when the spatial projection exists to replace this aggregate."),
  fetchTilesByCoords: deleteLiveState("Current TileOpt state must come from RECS."),
  fetchRealmSettlements: deleteLiveState("Current Structure locations must come from RECS."),
  fetchStructuresByOwner: deleteLiveState("Current Structure ownership must come from RECS."),
  fetchRealmVillageSlots: deleteLiveState("Current settlement slots must come from RECS."),
  fetchSettlementPlannerSnapshot: deleteLiveState("Planner realms and villages duplicate current Structure facts."),
  fetchExploredTilesInBounds: deleteLiveState("Current explored TileOpt state must come from RECS."),
  fetchTokenTransfers: keepHistory("Immutable token-transfer history is a SQL read model."),
  fetchStructureByCoord: deleteLiveState("Current Structure lookup must use the RECS spatial projection."),
  fetchGlobalStructureExplorerAndGuildDetails: deleteLiveState("Duplicates current structures, explorers, and owners."),
  fetchAllTiles: deleteLiveState("Duplicates the authoritative TileOpt snapshot."),
  fetchHyperstructures: deleteLiveState("Current Hyperstructure state must come from RECS."),
  fetchOtherStructures: deleteLiveState("Current Structure ownership and category must come from RECS."),
  fetchSwapEvents: keepHistory("Immutable swap history is a SQL read model."),
  fetchExplorerAddressOwner: deleteLiveState("Current explorer ownership must come from RECS."),
  fetchBattleLogs: keepHistory("Battle history is intentionally not current entity truth."),
  fetchPlayerStructures: deleteLiveState("Current player Structure membership must come from RECS."),
  fetchResourceBalances: deleteLiveState("Current Resource balances must come from RECS."),
  fetchResourceBalancesAndProduction: deleteLiveState("Current balances and production must come from RECS."),
  fetchResourceBalancesWithProduction: deleteLiveState("Current dynamic Resource production must come from RECS."),
  fetchSeasonEnded: deleteLiveState("Current season status is streamed into RECS."),
  fetchGuardsByStructure: deleteLiveState("Current troop guards must come from Structure in RECS."),
  fetchChestsNearPosition: deleteLiveState("Current chest occupancy must use TileOpt in the spatial projection."),
  fetchPlayerStructureRelics: deleteLiveState("Current relic ownership is Resource state in RECS."),
  fetchPlayerArmyRelics: deleteLiveState("Current relic ownership is Resource state in RECS."),
  fetchAllPlayerRelics: deleteLiveState("Combines two current-state relic queries."),
  fetchAllStructuresMapData: deleteLiveState("MapDataStore duplicate of current Structure state."),
  fetchAllArmiesMapData: deleteLiveState("MapDataStore duplicate of current ExplorerTroops state."),
  fetchBuildingsByStructures: deleteLiveState("Current Building placement must come from RECS."),
  fetchWorldAddress: keepAggregate("Indexer metadata identifies the world; it is not gameplay entity truth."),
  fetchHyperstructuresWithRealmCount: reviewInS3(
    "Decide when the spatial projection exists to replace this aggregate.",
  ),
  fetchStoryEvents: keepHistory("StoryEvent is immutable paginated history."),
  fetchStoryEventsSince: keepHistory("StoryEvent is immutable paginated history."),
  fetchStoryEventsByEntity: keepHistory("StoryEvent is immutable paginated history."),
  fetchStoryEventsByOwner: keepHistory("StoryEvent is immutable paginated history."),
  fetchStoryEventsCount: keepAggregate("Pagination count over immutable StoryEvent history."),
  fetchRegisteredPlayerPoints: reviewInS2S3(
    "RECS owns in-session points; decide how out-of-session leaderboard pages obtain ranked data.",
  ),
  fetchPlayerLeaderboard: reviewInS2S3(
    "Decide whether out-of-session ranked pagination remains a SQL aggregate when no game RECS session exists.",
  ),
  fetchPlayerLeaderboardByAddress: reviewInS2S3(
    "Decide whether out-of-session player rank lookup remains a SQL aggregate when no game RECS session exists.",
  ),
} satisfies Record<AsyncSqlApiMethodName, SqlFactOwnershipDecision>;
