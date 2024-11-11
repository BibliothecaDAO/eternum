import {
  BuildingType,
  CapacityConfigCategory,
  QuestType,
  RealmLevels,
  ResourcesIds,
  TroopFoodConsumption,
} from "../constants";

export enum Winner {
  Attacker = "Attacker",
  Target = "Target",
}

export enum TickIds {
  Default,
  Armies,
}

export enum DestinationType {
  Home,
  Hyperstructure,
  Realm,
  Bank,
}

export enum EntityType {
  DONKEY,
  TROOP,
  UNKNOWN,
}

export enum BattleSide {
  None,
  Attack,
  Defence,
}

export enum Access {
  Public,
  Private,
  GuildOnly,
}

export enum TravelTypes {
  Explore,
  Travel,
}

export interface CombatResultInterface {
  attackerRealmEntityId: ID;
  targetRealmEntityId: ID;
  attackingEntityIds: ID[];
  winner: Winner;
  stolenResources: Resource[];
  damage: number;
  attackTimestamp: number;
  stolenChestsIds: ID[];
}

export interface CombatInfo {
  entityId: ID;
  health: number;
  quantity: number;
  attack: number;
  defence: number;
  sec_per_km: number;
  blocked?: boolean | undefined;
  capacity?: number | undefined;
  arrivalTime?: number | undefined;
  position?: Position | undefined;
  homePosition?: Position | undefined;
  entityOwnerId?: ID | undefined;
  owner?: ID | undefined;
  locationEntityId?: ID | undefined;
  locationType?: DestinationType;
  originRealmId?: ID | undefined;
  order: number;
  troops: {
    knightCount: number;
    paladinCount: number;
    crossbowmanCount: number;
  };
  battleEntityId: ID;
  battleSide: number;
}

/// TRADING
export interface MarketInterface {
  makerName: string;
  originName: string;
  tradeId: ID;
  makerId: ID;
  takerId: ID;
  // brillance, reflection, ...
  makerOrder: number;
  expiresAt: number;
  takerGets: Resource[];
  makerGets: Resource[];
  ratio: number;
  perLords: number;
}

export interface Trade {
  maker_id: ID;
  taker_id: ID;
  maker_order_id: ID;
  taker_order_id: ID;
  expires_at: number;
  claimed_by_maker: boolean;
  claimed_by_taker: boolean;
  taker_needs_caravan: boolean;
}

/// RESOURCES
export interface Resources {
  trait: string;
  value: number;
  colour: string;
  id: number;
  description: string;
  img: string;
  ticker: string;
  rarity?: string;
}

export interface Resource {
  resourceId: ResourcesIds;
  amount: number;
}

/// TRAVEL

export interface EntityInterface {
  entityId: ID;
  blocked: boolean | undefined;
  arrivalTime: number | undefined;
  capacity: number | undefined;
  intermediateDestination: Position | undefined;
  owner: ID | undefined;
  isMine: boolean;
  isRoundTrip: boolean;
  position: Position | undefined;
  homePosition: Position | undefined;
  resources: Resource[];
  entityType: EntityType;
}

/// REALMS
export interface SelectableRealmInterface {
  entityId: ID;
  realmId: ID;
  name: string;
  order: string;
  distance: number;
  defence?: CombatInfo;
  level?: number;
  addressName: string;
}

export interface SelectableLocationInterface {
  entityId: ID;
  home: boolean;
  realmId: ID;
  name: string;
  order: string;
  distance: number;
  defence?: CombatInfo;
  level?: number;
  addressName: string;
}
export interface RealmInterface {
  realmId: ID;
  name: string;
  cities: number;
  rivers: number;
  wonder: number;
  harbors: number;
  regions: number;
  resourceTypesCount: number;
  resourceTypesPacked: bigint;
  order: number;
  owner?: ContractAddress;
}

/// LABOR

/// BANK
export interface AuctionInterface {
  start_time: number;
  per_time_unit: bigint;
  sold: bigint;
  price_update_interval: bigint;
}

export interface BankStaticInterface {
  name: string;
  position: Position;
  distance: number | undefined;
}

export interface BankInterface {
  name: string;
  wheatPrice: number;
  fishPrice: number;
  bankId: ID;
  position: Position;
  wheatAuction: AuctionInterface | undefined;
  fishAuction: AuctionInterface | undefined;
  distance: number | undefined;
}

/// POSITION
export interface Position {
  x: number;
  y: number;
}

export interface IOrder {
  orderId: number;
  orderName: string;
  fullOrderName: string;
  color: string;
}

export type ID = number;
export type ContractAddress = bigint;

export function ID(id: number | string): ID {
  return Number(id);
}

export function ContractAddress(address: string | bigint): ContractAddress {
  return BigInt(address);
}

export interface ResourceCost {
  resource: ResourcesIds;
  amount: number;
}

export interface ResourceInputs {
  [key: number]: ResourceCost[];
}

export interface ResourceOutputs {
  [key: number]: number;
}

export interface Config {
  stamina: {
    travelCost: number;
    exploreCost: number;
    refillPerTick: number;
    startBoostTickCount: number;
  };
  resources: {
    resourcePrecision: number;
    resourceMultiplier: number;
    resourceAmountPerTick: number;
    startingResourcesInputProductionFactor: number;
    resourceInputs: ResourceInputs;
    resourceOutputs: ResourceOutputs;
    resourceWeightsGrams: { [key in ResourcesIds]: number };
    resourceBuildingCosts: ResourceInputs;
    resourceRarity: { [key in ResourcesIds]?: number };
  };
  banks: {
    name: string;
    lordsCost: number;
    lpFeesNumerator: number;
    lpFeesDenominator: number; // %
    ownerFeesNumerator: number;
    ownerFeesDenominator: number; // %
    ownerBridgeFeeOnDepositPercent: number;
    ownerBridgeFeeOnWithdrawalPercent: number;
    ammStartingLiquidity: { [key in ResourcesIds]?: number };
    lordsLiquidityPerResource: number;
  };
  populationCapacity: {
    workerHuts: number;
    basePopulation: number;
  };
  exploration: {
    reward: number;
    shardsMinesFailProbability: number;
  };
  tick: {
    defaultTickIntervalInSeconds: number;
    armiesTickIntervalInSeconds: number; // 1 hour
  };
  carryCapacityGram: Record<CapacityConfigCategory, bigint | number>;
  speed: {
    donkey: number;
    army: number;
  };
  battle: {
    graceTickCount: number;
    delaySeconds: number;
  };
  troop: {
    // The 7,200 health value makes battles last up to 20 hours at a maximum.
    // This max will be reached if both armies are very similar in strength and health
    // To reduce max battle time by 4x for example, change the health to (7,200 / 4)
    // which will make the max battle time = 5 hours.
    health: number;
    knightStrength: number;
    paladinStrength: number;
    crossbowmanStrength: number;
    advantagePercent: number;
    disadvantagePercent: number;
    maxTroopCount: number;
    baseArmyNumberForStructure: number;
    armyExtraPerMilitaryBuilding: number;
    // Max attacking armies per structure = 6 + 1 defensive army
    maxArmiesPerStructure: number; // 3 + (3 * 1) = 7 // benefits from at most 3 military buildings
    // By setting the divisor to 8, the max health that can be taken from the weaker army
    // during pillage is 100 / 8 = 12.5%. Adjust this value to change that.
    //
    // The closer the armies are in strength and health, the closer they both
    // get to losing 12.5% each. If an army is far stronger than the order,
    // they lose a small percentage (closer to 0% health loss) while the
    // weak army's loss is closer to 12.5%.
    pillageHealthDivisor: number;

    // 25%
    battleLeaveSlashNum: number;
    battleLeaveSlashDenom: number;
    // 1_000. multiply this number by 2 to reduce battle time by 2x, etc.
    battleTimeReductionScale: number;
    battleMaxTimeSeconds: number;
    troopStaminas: { [key: number]: number };
    troopFoodConsumption: Record<number, TroopFoodConsumption>;
  };
  mercenaries: {
    knights_lower_bound: number;
    knights_upper_bound: number;
    paladins_lower_bound: number;
    paladins_upper_bound: number;
    crossbowmen_lower_bound: number;
    crossbowmen_upper_bound: number;
    rewards: Array<ResourceCost>;
  };
  settlement: {
    radius: number;
    angle_scaled: number;
    center: number;
    min_distance: number;
    max_distance: number;
    min_scaling_factor_scaled: bigint;
    min_angle_increase: number;
    max_angle_increase: number;
  };
  season: {
    seasonPassAddress: string;
    realmsAddress: string;
    lordsAddress: string;
  };
  bridge: {
    velords_fee_on_dpt_percent: number;
    velords_fee_on_wtdr_percent: number;
    season_pool_fee_on_dpt_percent: number;
    season_pool_fee_on_wtdr_percent: number;
    client_fee_on_dpt_percent: number;
    client_fee_on_wtdr_percent: number;
    velords_fee_recipient: ContractAddress;
    season_pool_fee_recipient: ContractAddress;
    max_bank_fee_dpt_percent: number;
    max_bank_fee_wtdr_percent: number;
  };
  buildings: {
    buildingCapacity: Partial<{ [key in BuildingType]: number }>;
    buildingPopulation: Partial<{ [key in BuildingType]: number }>;
    buildingResourceProduced: Partial<{ [key in BuildingType]: number }>;
    buildingCosts: ResourceInputs;
    buildingFixedCostScalePercent: number;
  };

  hyperstructures: {
    hyperstructureCreationCosts: ResourceCost[];
    hyperstructureConstructionCosts: ResourceCost[];
    hyperstructureTotalCosts: ResourceCost[];
    hyperstructurePointsPerCycle: number;
    hyperstructurePointsOnCompletion: number;
    hyperstructureTimeBetweenSharesChangeSeconds: number;
    hyperstructurePointsForWin: number;
  };
  questResources: { [key in QuestType]: ResourceCost[] };
  realmUpgradeCosts: { [key in RealmLevels]: ResourceCost[] };
  realmMaxLevel: number;
}

export interface Player {
  address: ContractAddress;
  addressName: string;
  rank?: number;
  points?: number;
  isAlive?: boolean;
}

export type GuildInfo = {
  entityId: ID;
  name: string;
  isOwner: boolean;
  memberCount: number;
  rank?: number;
  points?: number;
  isPublic?: boolean;
  age?: string;
  isMember?: boolean;
};

export type GuildMemberInfo = {
  guildEntityId: ID;
  name: string;
  rank: number;
  points: number;
  address: ContractAddress;
  age: string;
  isUser: boolean;
  isGuildMaster: boolean;
};

export type GuildWhitelistInfo = {
  guildEntityId: ID;
  guildName: string;
  name?: string;
  rank?: number;
  points?: number;
  address?: ContractAddress;
};
