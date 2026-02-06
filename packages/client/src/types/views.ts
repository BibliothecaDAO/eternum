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

export interface MapAreaView {
  center: Position;
  radius: number;
  tiles: TileState[];
  structures: MapStructure[];
  armies: MapArmy[];
  battles: BattleReference[];
}

export interface MarketView {
  pools: AmmPoolState[];
  recentSwaps: SwapEvent[];
  openOrders: MarketOrder[];
  playerLpPositions: LpPosition[];
}

export interface PlayerView {
  address: ContractAddress;
  name: string;
  structures: PlayerStructureSummary[];
  armies: PlayerArmySummary[];
  totalResources: AggregatedResource[];
  points: number;
  rank: number;
}

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

export interface LeaderboardView {
  entries: LeaderboardEntry[];
  totalPlayers: number;
  lastUpdatedAt: number;
}

export interface BankView {
  entityId: ID;
  position: Position;
  pools: AmmPoolState[];
  recentSwaps: SwapEvent[];
  playerLpPositions: LpPosition[];
}

export interface EventsView {
  events: GameEvent[];
  totalCount: number;
  hasMore: boolean;
}
