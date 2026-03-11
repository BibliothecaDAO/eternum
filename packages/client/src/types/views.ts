import type {
  ID,
  ContractAddress,
  Position,
  ResourceState,
  ProductionState,
  BuildingState,
  GuardState,
  ExplorerSummary,
  ArrivalState,
  TradeOrderState,
  RelicState,
  BattleReference,
  NearbyEntity,
  AmmPoolState,
  TileState,
  MapStructure,
  MapArmy,
  SwapEvent,
  MarketOrder,
  GameEvent,
  LpPosition,
  LeaderboardEntry,
  AggregatedResource,
  PlayerStructureSummary,
  PlayerArmySummary,
} from "./common.js";

/**
 * Complete realm snapshot used by UIs and autonomous agents.
 *
 * Includes strategic state (resources/buildings), military posture
 * (guards/explorers), and local world context.
 *
 * @example
 * ```ts
 * const realm = await client.view.realm(42);
 * console.log(realm.name, realm.guard.totalTroops);
 * ```
 */
export interface RealmView {
  entityId: ID;
  realmId: ID;
  name: string;
  owner: ContractAddress;
  position: Position;
  level: number;
  resources: ResourceState[];
  productions: ProductionState[];
  buildings: BuildingState[];
  guard: GuardState;
  explorers: ExplorerSummary[];
  incomingArrivals: ArrivalState[];
  outgoingOrders: TradeOrderState[];
  relics: RelicState[];
  activeBattles: BattleReference[];
  nearbyEntities: NearbyEntity[];
}

/**
 * Read-model for a single explorer/army, including movement/combat-relevant state.
 */
export interface ExplorerView {
  entityId: ID;
  explorerId: ID;
  owner: ContractAddress;
  position: Position;
  stamina: number;
  maxStamina: number;
  troops: GuardState;
  carriedResources: ResourceState[];
  isInBattle: boolean;
  currentBattle: BattleReference | null;
  nearbyEntities: NearbyEntity[];
  recentEvents: GameEvent[];
}

/**
 * Snapshot of map entities in a square area around a given center coordinate.
 */
export interface MapAreaView {
  center: Position;
  radius: number;
  tiles: TileState[];
  structures: MapStructure[];
  armies: MapArmy[];
  battles: BattleReference[];
}

/**
 * Market state with liquidity pools and most recent swap activity.
 */
export interface MarketView {
  pools: AmmPoolState[];
  recentSwaps: SwapEvent[];
  openOrders: MarketOrder[];
  playerLpPositions: LpPosition[];
}

/**
 * Aggregated player profile used for wallet/account dashboards.
 */
export interface PlayerView {
  address: ContractAddress;
  name: string;
  structures: PlayerStructureSummary[];
  armies: PlayerArmySummary[];
  totalResources: AggregatedResource[];
  points: number;
  rank: number;
}

/**
 * Hyperstructure progress and associated defensive state.
 */
export interface HyperstructureView {
  entityId: ID;
  position: Position;
  owner: ContractAddress | null;
  progress: number;
  contributions: { address: ContractAddress; amount: number }[];
  guard: GuardState;
  activeBattles: BattleReference[];
  isComplete: boolean;
}

/**
 * Ranked player list for leaderboard views.
 */
export interface LeaderboardView {
  entries: LeaderboardEntry[];
  totalPlayers: number;
  lastUpdatedAt: number;
}

/**
 * Bank-specific market state for a given bank entity.
 */
export interface BankView {
  entityId: ID;
  position: Position;
  pools: AmmPoolState[];
  recentSwaps: SwapEvent[];
  playerLpPositions: LpPosition[];
}

/**
 * Paginated game event feed with total count metadata.
 */
export interface EventsView {
  events: GameEvent[];
  totalCount: number;
  hasMore: boolean;
}
