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
  end_tick: number;
  usage_left: number;
}

export enum ActorType {
  Explorer = "explorer",
  Structure = "structure",
}

export interface SelectedEntity {
  name: string;
  entityId: ID;
}

export enum TileOccupier {
  None = 0,
  //
  RealmRegularLevel1 = 1,
  RealmRegularLevel2 = 2,
  RealmRegularLevel3 = 3,
  RealmRegularLevel4 = 4,
  //
  RealmWonderLevel1 = 5,
  RealmWonderLevel2 = 6,
  RealmWonderLevel3 = 7,
  RealmWonderLevel4 = 8,
  //
  HyperstructureLevel1 = 9,
  HyperstructureLevel2 = 10,
  HyperstructureLevel3 = 11,
  //
  FragmentMine = 12,
  Village = 13,
  Bank = 14,
  //
  ExplorerKnightT1Regular = 15,
  ExplorerKnightT2Regular = 16,
  ExplorerKnightT3Regular = 17,
  ExplorerPaladinT1Regular = 18,
  ExplorerPaladinT2Regular = 19,
  ExplorerPaladinT3Regular = 20,
  ExplorerCrossbowmanT1Regular = 21,
  ExplorerCrossbowmanT2Regular = 22,
  ExplorerCrossbowmanT3Regular = 23,
  //
  ExplorerKnightT1Daydreams = 24,
  ExplorerKnightT2Daydreams = 25,
  ExplorerKnightT3Daydreams = 26,
  ExplorerPaladinT1Daydreams = 27,
  ExplorerPaladinT2Daydreams = 28,
  ExplorerPaladinT3Daydreams = 29,
  ExplorerCrossbowmanT1Daydreams = 30,
  ExplorerCrossbowmanT2Daydreams = 31,
  ExplorerCrossbowmanT3Daydreams = 32,
  //
  Quest = 33,
  Chest = 34,
  Spire = 35,
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
  position: Position;
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
  relicEffects: ResourcesIds[];
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
  alt: boolean;
  col: number;
  row: number;
  biome: number;
  occupier_id: ID;
  occupier_type: number;
  occupier_is_structure: boolean;
  reward_extracted: boolean;
};

export type TileOpt = {
  alt: boolean;
  col: number;
  row: number;
  data: bigint;
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
    alt: boolean;
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

export type RelicEffectWithEndTick = { id: ResourcesIds; endTick: number };

export interface TroopBoosts {
  incr_damage_dealt_percent_num: number;
  incr_damage_dealt_end_tick: number;
  decr_damage_gotten_percent_num: number;
  decr_damage_gotten_end_tick: number;
  incr_stamina_regen_percent_num: number;
  incr_stamina_regen_tick_count: number;
  incr_explore_reward_percent_num: number;
  incr_explore_reward_end_tick: number;
}

export interface Troops {
  category: string;
  tier: string;
  count: bigint;
  stamina: {
    amount: bigint;
    updated_tick: bigint;
  };
  boosts: TroopBoosts;
  battle_cooldown_end: number;
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
  alt: boolean;
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
      staminaDefenseReq: number;
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
    single_realm_mode: boolean;
  };
  season: {
    // we expect one or the other. The
    // startSettlingAt takes precedence
    startSettlingAfterSeconds: number;
    startSettlingAt: number;
    durationSeconds: number;

    // we expect one or the other. The
    // startMainAt takes precedence
    startMainAfterSeconds: number;
    startMainAt: number;

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
    pointsForRelicDiscovery: bigint;
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
  dev: {
    mode: {
      on: boolean;
    };
  };
  blitz: {
    mode: {
      on: boolean;
    };
    registration: {
      fee_token: string;
      fee_recipient: string;
      fee_amount: bigint;
      registration_count_max: number;
      registration_delay_seconds: number;
      registration_period_seconds: number;
      entry_token_class_hash: string;
      entry_token_ipfs_cid: string;

      collectible_cosmetics_max_items: number;
      collectible_cosmetics_address: string;
      collectible_timelock_address: string;
      collectibles_lootchest_address: string;
      collectibles_elitenft_address: string;
    };
  };
  factory: {
    address: string;
  };

  // Config for calling the setup function
  setup?: {
    chain: string;
    addresses: SeasonAddresses;
    manifest: any;
  };

  // Previous prize distribution systems address (carried between runs)
  prev_prize_distribution_address?: string | null;
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
