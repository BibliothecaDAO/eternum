export type ID = number;
export type ContractAddress = string;

export interface Position {
  x: number;
  y: number;
}

export interface ResourceCost {
  resourceId: number;
  name: string;
  amount: number;
}

export interface ResourceProduction {
  rate: number;
  ratePerTick: number;
  buildingCount: number;
  isActive: boolean;
  isPaused: boolean;
  outputRemaining: number;
  timeRemainingSeconds: number;
  depletesAt: number | null;
  inputs: ResourceCost[];
}

export interface ResourceState {
  resourceId: number;
  name: string;
  tier: string;
  balance: number;
  rawBalance: bigint;
  production: ResourceProduction | null;
  atMaxCapacity: boolean;
  weightKg: number;
}

export interface ProductionState {
  resourceId: number;
  name: string;
  rate: number;
  ratePerTick: number;
  buildingCount: number;
  isActive: boolean;
  isPaused: boolean;
  outputRemaining: number;
  timeRemainingSeconds: number;
  depletesAt: number | null;
  inputs: ResourceCost[];
}

export interface BuildingState {
  buildingId: number;
  name: string;
  category: string;
  position: Position;
  level: number;
  isActive: boolean;
  isPaused: boolean;
  resourceProduced: number | null;
  cost: ResourceCost[];
}

export interface GuardSlot {
  troopType: string;
  count: number;
  tier: number;
}

export interface GuardState {
  totalTroops: number;
  slots: GuardSlot[];
  strength: number;
}

export interface ExplorerSummary {
  entityId: ID;
  explorerId: ID;
  owner: ContractAddress;
  position: Position;
  stamina: number;
  maxStamina: number;
  troops: GuardSlot[];
  strength: number;
  isInBattle: boolean;
  carriedResources: ResourceCost[];
}

export interface ArrivalState {
  entityId: ID;
  owner: ContractAddress;
  origin: Position;
  destination: Position;
  arrivalTime: number;
  resources: ResourceCost[];
  isRoundTrip: boolean;
}

export interface TradeOrderState {
  orderId: ID;
  makerId: ID;
  makerAddress: ContractAddress;
  offerResources: ResourceCost[];
  requestedResources: ResourceCost[];
  expiresAt: number;
  isActive: boolean;
}

export interface RelicState {
  relicId: ID;
  entityId: ID;
  position: Position;
  isAttached: boolean;
  bonusType: string | null;
}

export interface BattleReference {
  battleId: ID;
  position: Position;
  attackerStrength: number;
  defenderStrength: number;
  startedAt: number;
  estimatedEndAt: number;
}

export interface NearbyEntity {
  entityId: ID;
  entityType: string;
  position: Position;
  distance: number;
  owner: ContractAddress | null;
}

export interface AmmPoolState {
  resourceId: number;
  resourceName: string;
  lordsReserve: number;
  resourceReserve: number;
  price: number;
  totalLiquidity: number;
}

export interface TileState {
  position: Position;
  biome: string;
  explored: boolean;
  occupiedBy: ID | null;
}

export interface MapStructure {
  entityId: ID;
  structureType: string;
  position: Position;
  owner: ContractAddress;
  name: string;
  level: number;
}

export interface MapArmy {
  entityId: ID;
  owner: ContractAddress;
  position: Position;
  troops: GuardSlot[];
  strength: number;
  stamina: number;
  isInBattle: boolean;
}

export interface SwapEvent {
  eventId: ID;
  resourceId: number;
  resourceName: string;
  lordsAmount: number;
  resourceAmount: number;
  isBuy: boolean;
  timestamp: number;
  trader: ContractAddress;
}

export interface MarketOrder {
  orderId: ID;
  resourceId: number;
  resourceName: string;
  amount: number;
  price: number;
  maker: ContractAddress;
  expiresAt: number;
}

export interface GameEvent {
  eventId: ID;
  eventType: string;
  timestamp: number;
  data: Record<string, unknown>;
  involvedEntities: ID[];
}

export interface LpPosition {
  resourceId: number;
  resourceName: string;
  lordsAmount: number;
  resourceAmount: number;
  sharePercentage: number;
}

export interface LeaderboardEntry {
  address: ContractAddress;
  name: string;
  points: number;
  rank: number;
  realmCount: number;
}

export interface AggregatedResource {
  resourceId: number;
  name: string;
  totalBalance: number;
  totalProduction: number;
  structureCount: number;
}

export interface PlayerStructureSummary {
  entityId: ID;
  structureType: string;
  name: string;
  position: Position;
  level: number;
  resourceCount: number;
  guardStrength: number;
}

export interface PlayerArmySummary {
  entityId: ID;
  explorerId: ID;
  position: Position;
  strength: number;
  stamina: number;
  isInBattle: boolean;
  carriedResourceCount: number;
}

export interface CombatPreview {
  attackerStrength: number;
  defenderStrength: number;
  attackerDamageModifier: number;
  defenderDamageModifier: number;
  estimatedOutcome: "attacker_wins" | "defender_wins" | "uncertain";
  attackerLossPercentage: number;
  defenderLossPercentage: number;
}
