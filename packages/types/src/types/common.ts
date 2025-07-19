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
import { ClientComponents } from "../dojo/create-client-components";

export interface RelicEffect {
  start_tick: number;
  end_tick: number;
  usage_left: number;
}

export enum ActorType {
  Explorer = "explorer",
  Structure = "structure",
}

export enum TileOccupier {
  None = 0,
  RealmRegularLevel1 = 1,
  RealmWonderLevel1 = 2,
  HyperstructureLevel1 = 3,
  FragmentMine = 4,
  Village = 5,
  Bank = 6,
  ExplorerKnightT1Regular = 7,
  ExplorerKnightT2Regular = 8,
  ExplorerKnightT3Regular = 9,
  ExplorerPaladinT1Regular = 10,
  ExplorerPaladinT2Regular = 11,
  ExplorerPaladinT3Regular = 12,
  ExplorerCrossbowmanT1Regular = 13,
  ExplorerCrossbowmanT2Regular = 14,
  ExplorerCrossbowmanT3Regular = 15,
  ExplorerKnightT1Daydreams = 16,
  ExplorerKnightT2Daydreams = 17,
  ExplorerKnightT3Daydreams = 18,
  ExplorerPaladinT1Daydreams = 19,
  ExplorerPaladinT2Daydreams = 20,
  ExplorerPaladinT3Daydreams = 21,
  ExplorerCrossbowmanT1Daydreams = 22,
  ExplorerCrossbowmanT2Daydreams = 23,
  ExplorerCrossbowmanT3Daydreams = 24,
  RealmRegularLevel2 = 25,
  RealmRegularLevel3 = 26,
  RealmRegularLevel4 = 27,
  RealmWonderLevel2 = 28,
  RealmWonderLevel3 = 29,
  RealmWonderLevel4 = 30,
  HyperstructureLevel2 = 31,
  HyperstructureLevel3 = 32,
  RealmRegularLevel1WonderBonus = 33,
  RealmRegularLevel2WonderBonus = 34,
  RealmRegularLevel3WonderBonus = 35,
  RealmRegularLevel4WonderBonus = 36,
  VillageWonderBonus = 37,
  Quest = 38,
  Chest = 39,
}

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

export type ResourceArrivalInfo = {
  structureEntityId: ID;
  resources: Resource[];
  arrivesAt: bigint;
  day: bigint;
  slot: bigint;
};

export type HyperstructureInfo = {
  entity_id: ID;
  hyperstructure: ComponentValue<ClientComponents["Hyperstructure"]["schema"]>;
  structure: ComponentValue<ClientComponents["Structure"]["schema"]>;
  position: { x: number; y: number };
  owner: bigint;
  ownerName: string;
  isOwner: boolean;
  access: string;
};

export type DojoAccount = Account | AccountInterface;

export type ArmyInfo = {
  entityId: ID;
  troops: Troops;
  stamina: bigint;
  name: string;
  ownerName: string;
  isMine: boolean;
  isMercenary: boolean;
  isHome: boolean;
  position: Position;
  owner: ContractAddress;
  entity_owner_id: ID;
  // without precision and in kg
  totalCapacity: number;
  // without precision and in kg
  weight: number;
  explorer: ComponentValue<ClientComponents["ExplorerTroops"]["schema"]>;
  structure: ComponentValue<ClientComponents["Structure"]["schema"]> | undefined;
  hasAdjacentStructure: boolean;
};

export type Structure = {
  entityId: ID;
  structure: ComponentValue<ClientComponents["Structure"]["schema"]>;
  isMine: boolean;
  isMercenary: boolean;
  category: StructureType;
  ownerName?: string;
  owner: ContractAddress;
  position: Position;
};

export type Tile = {
  col: number;
  row: number;
  biome: number;
  occupier_id: ID;
  occupier_type: number;
  occupier_is_structure: boolean;
};

export type Quest = {
  game_token_id: number;
  game_address: ContractAddress;
  quest_tile_id: number;
  explorer_id: number;
  completed: boolean;
};

export type QuestTile = {
  id: number;
  game_address: ContractAddress;
  coord: {
    x: number;
    y: number;
  };
  level: number;
  resource_type: number;
  amount: bigint;
  capacity: number;
  participant_count: number;
};

export type QuestLevel = {
  game_address: ContractAddress;
  levels: Level[];
};

export type Level = {
  target_score: number;
  settings_id: number;
  time_limit: number;
};

export type TroopFoodConsumption = {
  explore_wheat_burn_amount: number;
  explore_fish_burn_amount: number;
  travel_wheat_burn_amount: number;
  travel_fish_burn_amount: number;
};

export type PlayerStructure = {
  entityId: ID;
  structure: ComponentValue<ClientComponents["Structure"]["schema"]>;
  position: Position;
  category: StructureType;
  owner: ContractAddress;
};

export type RealmWithPosition = ComponentValue<ClientComponents["Structure"]["schema"]> & {
  entityId: ID;
  position: Position;
  name: string;
  owner: ContractAddress;
  resources: ResourcesIds[];
};
export interface Prize {
  id: QuestType;
  title: string;
}

export interface Building {
  name: string;
  category: BuildingType;
  paused: boolean;
  produced: ResourceCost;
  consumed: ResourceCost[];
  bonusPercent: number;
  innerCol: number;
  innerRow: number;
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

export enum TickIds {
  Default,
  Armies,
  Delivery,
}

export enum EntityType {
  DONKEY,
  ARMY,
  STRUCTURE,
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

/// TRADING
export interface MarketInterface {
  makerName: string;
  originName: string;
  tradeId: ID;
  makerId: ID;
  takerId: ID;
  // brillance, reflection, ...
  makerOrder: number;
  makerGivesMinResourceAmount: number;
  takerPaysMinResourceAmount: number;
  makerGivesMaxResourceCount: number;
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

/// REALMS

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

export interface ResourceMinMax {
  resource: ResourcesIds;
  min_amount: number;
  max_amount: number;
}
export interface HyperstructureResourceCostMinMax {
  resource_type: ResourcesIds;
  resource_completion_points: number;
  min_amount: number;
  max_amount: number;
}

export interface ResourceInputs {
  [key: number]: ResourceCost[];
}

export interface ResourceOutputs {
  [key: number]: number;
}

export interface Config {
  agent: {
    controller_address: string;
    max_lifetime_count: number;
    max_current_count: number;
    min_spawn_lords_amount: number;
    max_spawn_lords_amount: number;
  };
  village: {
    village_pass_nft_address: string;
    village_mint_initial_recipient: string;
  };
  resources: {
    resourcePrecision: number;
    productionByComplexRecipe: ResourceInputs;
    productionByComplexRecipeOutputs: ResourceOutputs;
    productionBySimpleRecipe: ResourceInputs;
    productionBySimpleRecipeOutputs: ResourceOutputs;
    laborOutputPerResource: ResourceOutputs;

    resourceWeightsGrams: { [key in ResourcesIds]: number };
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
    agentFindProbability: number;
    agentFindFailProbability: number;
    villageFindProbability: number;
    villageFindFailProbability: number;
    hyperstructureWinProbAtCenter: number;
    hyperstructureFailProbAtCenter: number;
    hyperstructureFailProbIncreasePerHexDistance: number;
    hyperstructureFailProbIncreasePerHyperstructureFound: number;
    shardsMineInitialWheatBalance: number;
    shardsMineInitialFishBalance: number;
    questFindProbability: number;
    questFindFailProbability: number;
    relicDiscoveryIntervalSeconds: number;
    relicHexDistanceFromCenter: number;
    relicChestRelicsPerChest: number;
  };
  tick: {
    defaultTickIntervalInSeconds: number;
    armiesTickIntervalInSeconds: number; // 1 hour
    deliveryTickIntervalInSeconds: number;
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
      damageRaidPercentNum: number;
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
      agentTroopLowerBound: number;
      agentTroopUpperBound: number;
    };
  };
  settlement: {
    center: number;
    base_distance: number;
    subsequent_distance: number;
  };
  season: {
    startSettlingAfterSeconds: number;
    durationSeconds: number;
    startMainAfterSeconds: number;
    bridgeCloseAfterEndSeconds: number;
    pointRegistrationCloseAfterEndSeconds: number;
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
    realm_fee_dpt_percent: number;
    realm_fee_wtdr_percent: number;
  };
  vrf: {
    vrfProviderAddress: string;
  };
  buildings: {
    buildingCapacity: Partial<{ [key in BuildingType]: number }>;
    buildingPopulation: Partial<{ [key in BuildingType]: number }>;
    buildingResourceProduced: Partial<{ [key in BuildingType]: number }>;
    complexBuildingCosts: ResourceInputs;
    simpleBuildingCost: ResourceInputs;
    buildingFixedCostScalePercent: number;
  };

  hyperstructures: {
    hyperstructureInitializationShardsCost: ResourceCost;
    hyperstructureConstructionCost: HyperstructureResourceCostMinMax[];
  };
  victoryPoints: {
    pointsForWin: bigint;
    hyperstructurePointsPerCycle: bigint;
    pointsForHyperstructureClaimAgainstBandits: bigint;
    pointsForNonHyperstructureClaimAgainstBandits: bigint;
    pointsForTileExploration: bigint;
  };
  wonderProductionBonus: {
    within_tile_distance: number;
    bonus_percent_num: number;
  };
  startingResources: ResourceCost[];
  villageStartingResources: ResourceCost[];
  discoverableVillageStartingResources: ResourceMinMax[];
  realmUpgradeCosts: { [key in RealmLevels]: ResourceCost[] };
  realmMaxLevel: number;
  villageMaxLevel: number;
  questGames: {
    address: string;
    levels: Level[];
    overwrite: boolean;
  }[];
  blitz: {
    mode: {
      on: boolean;
    };
    registration: {
      fee_token: string;
      fee_recipient: string;
      fee_amount: number;
      registration_count_max: number;
      registration_delay_seconds: number;
      registration_period_seconds: number;
      creation_period_seconds: number;
    };
  };

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
  category: StructureType;
  resources: ResourcesIds[];
  order: number;
  position: Position;
  storehouses: {
    capacityKg: number;
    capacityUsedKg: number;
    quantity: number;
  };
  population?: number | undefined;
  capacity?: number;
  hasCapacity: boolean;
  owner: ContractAddress;
  ownerName: string;
  hasWonder: boolean;
  level: number;
  structure: ComponentValue<ClientComponents["Structure"]["schema"]>;
}

export interface PlayerInfo {
  entity: Entity;
  rank: number;
  address: bigint;
  name: string;
  points: number;
  realms: number;
  mines: number;
  hyperstructures: number;
  villages: number;
  banks: number;
  isAlive: boolean;
  guildName: string;
}

export interface Player {
  entity: Entity;
  address: ContractAddress;
  name: string;
}

export type GuildInfo = {
  entityId: ContractAddress;
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
