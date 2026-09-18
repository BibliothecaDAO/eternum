import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { Account, AccountInterface } from "starknet";
import {
  BiomeType,
  BuildingType,
  CapacityConfig,
  RealmLevels,
  ResourcesIds,
  ResourceTier,
  StructureType,
} from "../constants";

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
  Hyperstructure = 9,
  //
  Mine = 12,
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
  //
  Chest = 34,
  Spire = 35,
  //
  Camp = 37,
  BitcoinMine = 38,
  ReservedHyperstructure = 39,
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
  hyperstructure: NativeRows["Hyperstructure"];
  structure: NativeRows["Structure"];
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
  explorer: NativeRows["ExplorerTroops"];
  structure: NativeRows["Structure"] | undefined;
  hasAdjacentStructure: boolean;
};

export type Structure = {
  entityId: ID;
  structure: NativeRows["Structure"];
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

export type TroopFoodConsumption = {
  explore_wheat_burn_amount: number;
  explore_fish_burn_amount: number;
  travel_wheat_burn_amount: number;
  travel_fish_burn_amount: number;
};

export type PlayerStructure = {
  entityId: ID;
  structure: NativeRows["Structure"];
  position: Position;
  category: StructureType;
  owner: ContractAddress;
};

export type RealmWithPosition = NativeRows["Structure"] & {
  entityId: ID;
  position: Position;
  name: string;
  owner: ContractAddress;
  resources: ResourcesIds[];
};
export interface Building {
  name: string;
  category: BuildingType;
  paused: boolean;
  produced: ResourceCost;
  consumed: ResourceCost[];
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

export type Troops = NativeRows["ExplorerTroops"]["troops"];
export type TroopBoosts = Troops["boosts"];
export type TroopTier = Troops["tier"];
export const TroopTier = { T1: "T1", T2: "T2", T3: "T3" } as const;
export type TroopType = Troops["category"];
export const TroopType = { Knight: "Knight", Paladin: "Paladin", Crossbowman: "Crossbowman" } as const;

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

export type BlitzExplorationRewardProfileId = "official-60" | "official-90";

export interface BlitzExplorationReward {
  rewardId: ResourcesIds;
  amount: number;
  probabilityBps: number;
}

export interface Config {
  spireTravelEssenceCost: number;
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
    campFindProbability: number;
    campFindFailProbability: number;
    hyperstructureWinProbAtCenter: number;
    hyperstructureFailProbAtCenter: number;
    hyperstructureFailProbIncreasePerHexDistance: number;
    hyperstructureFailProbIncreasePerHyperstructureFound: number;
    shardsMineInitialWheatBalance: number;
    shardsMineInitialFishBalance: number;
    relicDiscoveryIntervalSeconds: number;
    relicHexDistanceFromCenter: number;
    relicChestRelicsPerChest: number;
    bitcoinMineWinProbability: number;
    bitcoinMineFailProbability: number;
  };
  tick: {
    defaultTickIntervalInSeconds: number;
    armiesTickIntervalInSeconds: number; // 1 hour
    deliveryTickIntervalInSeconds: number;
    bitcoinPhaseInSeconds: number;
  };
  carryCapacityGram: Record<CapacityConfig, bigint | number | string>;
  speed: {
    donkey_for_resources: number;
    donkey_for_troops: number;
  };
  battle: {
    regularImmunityTicks: number;
    villageImmunityTicks: number;
    delaySeconds: number;
    villageRaidImmunityTicks: number;
  };
  troop: {
    damage: {
      t1DamageValue: bigint;
      t2DamageMultiplier: bigint;
      t3DamageMultiplier: bigint;
      damageRaidPercentNum: number;
      damageBiomeBonusNum: number;
      damageScalingFactor: bigint;
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
      guardResurrectionDelay: number;
      mercenariesTroopLowerBound: number;
      mercenariesTroopUpperBound: number;
      settlementDeploymentCap: number;
      cityDeploymentCap: number;
      kingdomDeploymentCap: number;
      empireDeploymentCap: number;
      t1TierStrength: number;
      t2TierStrength: number;
      t3TierStrength: number;
      t1TierModifier: number;
      t2TierModifier: number;
      t3TierModifier: number;
    };
  };
  settlement: {
    center: number;
    base_distance: number;
    layers_skipped: number;
    layer_max: number;
    layer_capacity_increment: number;
    layer_capacity_bps: number;
    spires_layer_distance: number;
    spires_max_count: number;
    spires_settled_count: number;
    single_realm_mode: boolean;
    two_player_mode: boolean;
  };
  biomeClimate: {
    elevationScaleBps: number;
    moistureScaleBps: number;
    elevationBiasBps: number;
    moistureBiasBps: number;
    elevationSeed: number;
    moistureSeed: number;
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

    endGraceSeconds: number;
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
  campStartingResources: ResourceMinMax[];
  realmUpgradeCosts: { [key in RealmLevels]: ResourceCost[] };
  realmMaxLevel: number;
  villageMaxLevel: number;

  dev: {
    mode: {
      on: boolean;
    };
  };
  blitz: {
    mode: {
      on: boolean;
    };
    exploration: {
      rewardProfileId: BlitzExplorationRewardProfileId;
      rewards: BlitzExplorationReward[];
    };
    registration: {
      registration_count_max: number;
      registration_delay_seconds: number;
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
  bitcoin?: {
    prizePerPhase: number;
    minimumLabor: number;
    ownerCutBps: number;
  };
  mines?: {
    kinds: Record<
      number,
      {
        resourceType: number;
        buildingCategory: number;
        productionRate: number;
        capMinimum: number;
        capSteps: number;
      }
    >;
    surfacePool: Array<{ kind: number; weight: number }>;
  };
  faith?: {
    enabled: boolean;
    wonder_base_fp_per_sec: number;
    realm_fp_per_sec: number;
    village_fp_per_sec: number;
    owner_share_percent: number;
    reward_token: string;
  };
  artificer?: {
    research_cost_for_relic: number;
  };

  // Config for calling the setup function
  setup?: {
    chain: string;
    addresses: SeasonAddresses;
  };
}

export type FactoryMapConfigOverrides = Partial<
  Pick<
    Config["exploration"],
    | "shardsMinesWinProbability"
    | "shardsMinesFailProbability"
    | "campFindProbability"
    | "campFindFailProbability"
    | "bitcoinMineWinProbability"
    | "bitcoinMineFailProbability"
    | "hyperstructureWinProbAtCenter"
    | "hyperstructureFailProbAtCenter"
    | "hyperstructureFailProbIncreasePerHexDistance"
    | "hyperstructureFailProbIncreasePerHyperstructureFound"
    | "relicDiscoveryIntervalSeconds"
    | "relicHexDistanceFromCenter"
    | "relicChestRelicsPerChest"
  >
>;

export type FactoryBiomeClimateOverrides = Partial<Config["biomeClimate"]>;

export interface FactoryBlitzRegistrationOverrides {
  registration_count_max?: number;
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
  structure: NativeRows["Structure"];
}

export interface PlayerInfo {
  entity: string;
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

/** A registered player: the identity username (else the chosen chain name), or null when neither was chosen. */
export interface Player {
  entity: string;
  address: ContractAddress;
  name: string | null;
  /** The identity portrait id ("01".."12") when the player picked one. */
  portrait: string | null;
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
  guildEntityId: ContractAddress;
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
