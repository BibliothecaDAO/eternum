import { ComponentValue, Entity } from "@dojoengine/recs";
import { Account, AccountInterface } from "starknet";
import {
  BiomeType,
  BuildingType,
  CapacityConfig,
  QuestType,
  RealmLevels,
  ResourcesIds,
  ResourceTier,
  StructureType,
} from "../constants";
import { ClientComponents } from "../dojo";

/**
 * Interface representing season contract addresses and resources
 * @interface SeasonAddresses
 */
export interface SeasonAddresses {
  /** Address of the season pass contract */
  seasonPass: string;
  /** Address of the realms contract */
  realms: string;
  /** Address of the LORDS token contract */
  lords: string;
  /** Map of resource name to [resourceId, contractAddress] */
  resources: {
    [key: string]: (string | number)[];
  };
}

export type ArrivalInfo = {
  entityId: ID;
  recipientEntityId: ID;
  position: Position;
  arrivesAt: bigint;
  isOwner: boolean;
  hasResources: boolean;
  isHome: boolean;
};

export type DojoAccount = Account | AccountInterface;

export enum OccupiedBy {
  None = 0,
  RealmRegular = 1,
  RealmWonder = 2,
  Hyperstructure = 3,
  FragmentMine = 4,
  Village = 5,
  Bank = 6,
  Explorer = 7,
}

export type ArmyInfo = {
  entityId: ID;
  troops: Troops;
  stamina: bigint;
  name: string;
  isMine: boolean;
  isMercenary: boolean;
  isHome: boolean;
  position: Position;
  owner: ContractAddress;
  entity_owner_id: ID;
  totalCapacity: bigint;
  weight: bigint;
  structure: ComponentValue<ClientComponents["Structure"]["schema"]> | undefined;
};

export type Structure = {
  entityId: ID;
  structure: ComponentValue<ClientComponents["Structure"]["schema"]>;
  isMine: boolean;
  isMercenary: boolean;
  name: string;
  category: StructureType;
  ownerName?: string;
  protectors: ArmyInfo[];
  owner: ContractAddress;
  position: Position;
};

export type PlayerStructure = {
  structure: ComponentValue<ClientComponents["Structure"]["schema"]>;
  position: Position;
  name: string;
  category: StructureType;
  owner: ContractAddress;
};

export type RealmWithPosition = ComponentValue<ClientComponents["Structure"]["schema"]> & {
  position: Position;
  name: string;
  owner: ContractAddress;
  resources: ResourcesIds[];
};
export interface Prize {
  id: QuestType;
  title: string;
}

export enum QuestStatus {
  InProgress,
  Completed,
  Claimed,
}

export interface Building {
  name: string;
  category: string;
  paused: boolean;
  produced: ResourceCost;
  consumed: ResourceCost[];
  bonusPercent: number;
  innerCol: number;
  innerRow: number;
}

export enum BattleType {
  Hex,
  Structure,
}

export enum BattleStatus {
  BattleStart = "Start battle",
  BattleOngoing = "",
  UserWon = "Victory",
  UserLost = "Defeat",
  BattleEnded = "Battle has ended",
}

export enum RaidStatus {
  isRaidable = "Raid!",
  NoStamina = "Not enough stamina",
  NoStructureToClaim = "No structure to raid",
  OwnStructure = "Can't raid your own structure",
  NoArmy = "No army selected",
  ArmyNotInBattle = "Selected army not in this battle",
  MinTroops = "Minimum 100 troops required",
}

export enum LeaveStatus {
  Leave = "Leave",
  NoBattleToLeave = "No battle to leave",
  DefenderCantLeaveOngoing = "A defender can't leave an ongoing battle",
  NoArmyInBattle = "Your armies aren't in this battle",
}

export enum BattleStartStatus {
  MinTroops = "Minimum 100 troops required",
  BattleStart = "Start battle",
  ForceStart = "Force start",
  NothingToAttack = "Nothing to attack",
  CantStart = "Can't start a battle now.",
}

export enum ClaimStatus {
  Claimable = "Claim",
  NoSelectedArmy = "No selected army",
  BattleOngoing = "Battle ongoing",
  DefenderPresent = "An army's defending the structure",
  NoStructureToClaim = "No structure to claim",
  StructureIsMine = "Can't claim your own structure",
  SelectedArmyIsDead = "Selected army is dead",
}

export type HexPosition = { col: number; row: number };

export type HexEntityInfo = {
  id: ID;
  owner: ContractAddress;
};

export type HexTileInfo = {
  col: number;
  row: number;
  staminaCost: number;
  biomeType: BiomeType | undefined;
};

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

export interface Health {
  current: bigint;
  lifetime: bigint;
}

export interface Troops {
  category: string;
  tier: string;
  count: bigint;
  stamina: {
    amount: bigint;
    updated_tick: bigint;
  };
}

export enum TroopTier {
  T1 = "T1",
  T2 = "T2",
  T3 = "T3",
}

export enum TroopType {
  Knight = "Knight",
  Paladin = "Paladin",
  Crossbowman = "Crossbowman",
}

export type TroopInfo = {
  type: TroopType;
  count: number;
  label: string;
};

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
  imageUrl: string;
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
export interface ResourceCostMinMax {
  resource_tier: ResourceTier;
  min_amount: number;
  max_amount: number;
}

export interface ResourceInputs {
  [key: number]: ResourceCost[];
}

export interface ResourceOutputs {
  [key: number]: number;
}

export interface ProductionByLaborParams {
  [key: number]: {
    resource_rarity: number;
    depreciation_percent_num: number;
    depreciation_percent_denom: number;
    wheat_burn_per_labor: number;
    fish_burn_per_labor: number;
  };
}

export interface Config {
  resources: {
    resourcePrecision: number;
    resourceMultiplier: number;
    resourceAmountPerTick: number;
    startingResourcesInputProductionFactor: number;
    resourceInputs: ResourceInputs;
    resourceOutputs: ResourceOutputs;
    resourceWeightsGrams: { [key in ResourcesIds]: number };
    resourceProductionByLaborParams: ProductionByLaborParams;
    resourceRarity: { [key in ResourcesIds]?: number };
  };
  trade: {
    maxCount: number;
  };
  banks: {
    name: string;
    lordsCost: number;
    lpFeesNumerator: number;
    lpFeesDenominator: number; // %
    ownerFeesNumerator: number;
    ownerFeesDenominator: number; // %
    maxNumBanks: number;
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
    shardsMinesWinProbability: number;
    hyperstructureWinProbAtCenter: number;
    hyperstructureFailProbAtCenter: number;
    hyperstructureFailProbIncreasePerHexDistance: number;
    hyperstructureFailProbIncreasePerHyperstructureFound: number;
    shardsMineInitialWheatBalance: number;
    shardsMineInitialFishBalance: number;
  };
  tick: {
    defaultTickIntervalInSeconds: number;
    armiesTickIntervalInSeconds: number; // 1 hour
  };
  carryCapacityGram: Record<CapacityConfig, bigint | number | string>;
  speed: {
    donkey: number;
    army: number;
  };
  battle: {
    graceTickCount: number;
    graceTickCountHyp: number;
    delaySeconds: number;
  };
  troop: {
    damage: {
      t1DamageValue: bigint;
      t2DamageMultiplier: bigint;
      t3DamageMultiplier: bigint;
      damageBiomeBonusNum: number;
      damageScalingFactor: bigint;
      damageC0: bigint;
      damageDelta: bigint;
      damageBetaSmall: bigint;
      damageBetaLarge: bigint;
    };
    stamina: {
      staminaGainPerTick: number;
      staminaInitial: number;
      staminaBonusValue: number;
      staminaKnightMax: number;
      staminaPaladinMax: number;
      staminaCrossbowmanMax: number;
      staminaAttackReq: number;
      staminaAttackMax: number;
      staminaExploreWheatCost: number;
      staminaExploreFishCost: number;
      staminaExploreStaminaCost: number;
      staminaTravelWheatCost: number;
      staminaTravelFishCost: number;
      staminaTravelStaminaCost: number;
    };
    limit: {
      explorerMaxPartyCount: number;
      explorerAndGuardMaxTroopCount: number;
      guardResurrectionDelay: number;
      mercenariesTroopLowerBound: number;
      mercenariesTroopUpperBound: number;
    };
  };
  settlement: {
    center: number;
    base_distance: number;
    min_first_layer_distance: number;
    points_placed: number;
    current_layer: number;
    current_side: number;
    current_point_on_side: number;
  };
  season: {
    startAfterSeconds: number;
    bridgeCloseAfterEndSeconds: number;
  };
  bridge: {
    velords_fee_on_dpt_percent: number;
    velords_fee_on_wtdr_percent: number;
    season_pool_fee_on_dpt_percent: number;
    season_pool_fee_on_wtdr_percent: number;
    client_fee_on_dpt_percent: number;
    client_fee_on_wtdr_percent: number;
    velords_fee_recipient: string;
    season_pool_fee_recipient: string;
    max_bank_fee_dpt_percent: number;
    max_bank_fee_wtdr_percent: number;
  };
  vrf: {
    vrfProviderAddress: string;
  };
  buildings: {
    buildingCapacity: Partial<{ [key in BuildingType]: number }>;
    buildingPopulation: Partial<{ [key in BuildingType]: number }>;
    buildingResourceProduced: Partial<{ [key in BuildingType]: number }>;
    otherBuildingCosts: ResourceInputs;
    resourceBuildingCosts: ResourceInputs;
    buildingFixedCostScalePercent: number;
  };

  hyperstructures: {
    hyperstructureCreationCosts: ResourceCostMinMax[];
    hyperstructureConstructionCosts: ResourceCostMinMax[];
    hyperstructureTotalCosts: ResourceCostMinMax[];
    hyperstructurePointsPerCycle: number;
    hyperstructurePointsOnCompletion: number;
    hyperstructureTimeBetweenSharesChangeSeconds: number;
    hyperstructurePointsForWin: number;
  };
  questResources: { [key in QuestType]: ResourceCost[] };
  realmUpgradeCosts: { [key in RealmLevels]: ResourceCost[] };
  realmMaxLevel: number;
  villageMaxLevel: number;

  // Config for calling the setup function
  setup?: {
    chain: string;
    addresses: SeasonAddresses;
    manifest: any;
  };
}

export interface RealmInfo {
  realmId: ID;
  entityId: ID;
  name: string;
  resources: ResourcesIds[];
  order: number;
  position: Position;
  population?: number | undefined;
  capacity?: number;
  hasCapacity: boolean;
  owner: ContractAddress;
  ownerName: string;
  hasWonder: boolean;
  level: number;
  storehouses: {
    capacityKg: number;
    quantity: number;
  };
}

export interface PlayerInfo {
  entity: Entity;
  rank: number;
  address: bigint;
  name: string;
  points: number;
  percentage: number;
  lords: number;
  realms: number;
  mines: number;
  hyperstructures: number;
  isAlive: boolean;
  guildName: string;
}

export interface Player {
  entity: Entity;
  address: ContractAddress;
  name: string;
}

export type GuildInfo = {
  entityId: ID;
  name: string;
  isOwner: boolean;
  memberCount: number;
  isPublic?: boolean;
  isMember?: boolean;
};

export type GuildMemberInfo = {
  guildEntityId: ID;
  name: string;
  address: ContractAddress;
  isUser: boolean;
  isGuildMaster: boolean;
};

export enum ResourceMiningTypes {
  Forge = "forge",
  Mine = "mine",
  LumberMill = "lumber_mill",
  Dragonhide = "dragonhide",
}
