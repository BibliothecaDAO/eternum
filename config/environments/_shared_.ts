import { CapacityConfig, RESOURCE_PRECISION, RESOURCE_RARITY, ResourcesIds, type Config } from "@bibliothecadao/types";
import { getGameManifest, getSeasonAddresses, type Chain } from "@contracts";
import { AMM_STARTING_LIQUIDITY, LORDS_LIQUIDITY_PER_RESOURCE } from "./utils/amm";
import {
  BUILDING_CAPACITY,
  BUILDING_POPULATION,
  BUILDING_RESOURCE_PRODUCED,
  COMPLEX_BUILDING_COSTS,
  SIMPLE_BUILDING_COSTS,
} from "./utils/building";
import {
  HYPERSTRUCTURE_COSTS,
  HYPERSTRUCTURE_POINTS_FOR_WIN,
  HYPERSTRUCTURE_POINTS_PER_CYCLE,
  HYPERSTRUCTURE_SHARDS_COST,
} from "./utils/hyperstructure";
import { REALM_MAX_LEVEL, REALM_UPGRADE_COSTS, VILLAGE_MAX_LEVEL } from "./utils/levels";
import {
  LABOR_PRODUCTION_OUTPUT_AMOUNTS_THROUGH_RESOURCES,
  RESOURCE_PRODUCTION_INPUT_RESOURCES,
  RESOURCE_PRODUCTION_INPUT_RESOURCES_SIMPLE_SYSTEM,
  RESOURCE_PRODUCTION_OUTPUT_AMOUNTS,
  RESOURCE_PRODUCTION_OUTPUT_AMOUNTS_SIMPLE_SYSTEM,
  RESOURCES_WEIGHTS_NANOGRAM,
  STARTING_RESOURCES,
  VILLAGE_STARTING_RESOURCES,
} from "./utils/resource";
import {
  TROOP_AGENTS_TROOP_LOWER_BOUND,
  TROOP_AGENTS_TROOP_UPPER_BOUND,
  TROOP_BASE_DAMAGE,
  TROOP_DAMAGE_BETA_LARGE,
  TROOP_DAMAGE_BETA_SMALL,
  TROOP_DAMAGE_BIOME_BONUS_NUM,
  TROOP_DAMAGE_C0,
  TROOP_DAMAGE_DELTA,
  TROOP_DAMAGE_RAID_PERCENT_NUM,
  TROOP_DAMAGE_SCALING_FACTOR,
  TROOP_EXPLORE_FISH_COST,
  TROOP_EXPLORE_STAMINA_COST,
  TROOP_EXPLORE_WHEAT_COST,
  TROOP_EXPLORER_GUARD_MAX_TROOP_COUNT,
  TROOP_EXPLORER_MAX_PARTY_COUNT,
  TROOP_GUARD_RESURRECTION_DELAY,
  TROOP_MERCENARIES_TROOP_LOWER_BOUND,
  TROOP_MERCENARIES_TROOP_UPPER_BOUND,
  TROOP_STAMINA_ATTACK_MAX,
  TROOP_STAMINA_ATTACK_REQ,
  TROOP_STAMINA_BIOME_BONUS_VALUE,
  TROOP_STAMINA_GAIN_PER_TICK,
  TROOP_STAMINA_INITIAL,
  TROOP_STAMINA_MAX,
  TROOP_T2_DAMAGE_MULTIPLIER,
  TROOP_T3_DAMAGE_MULTIPLIER,
  TROOP_TRAVEL_FISH_COST,
  TROOP_TRAVEL_STAMINA_COST,
  TROOP_TRAVEL_WHEAT_COST,
} from "./utils/troop";

const manifest = await getGameManifest(process.env.VITE_PUBLIC_CHAIN! as Chain);

// ----- Buildings ----- //
// This scales the costs of the buildings
export const BUILDING_FIXED_COST_SCALE_PERCENT = 5_000; // 5_000/10_000 = 50%

// ----- Stamina ----- //
export const STAMINA_REFILL_PER_TICK = 20;
export const STAMINA_START_BOOST_TICK_COUNT = 2;
export const STAMINA_TRAVEL_COST = 10;
export const STAMINA_EXPLORE_COST = 20;

// ----- Banks ----- //
export const BANK_NAME = "Central Bank";
export const BANK_LORDS_COST = 1000;
export const BANK_LP_FEES_NUMERATOR = 15;
export const BANK_LP_FEES_DENOMINATOR = 100;
export const BANK_OWNER_FEES_NUMERATOR = 15;
export const BANK_OWNER_FEES_DENOMINATOR = 100;

// ----- Population Capacity ----- //
export const WORKER_HUTS_CAPACITY = 5;
export const BASE_POPULATION_CAPACITY = 5;

// ----- Exploration ----- //
export const EXPLORATION_REWARD = 750;
export const SHARDS_MINES_WIN_PROBABILITY = 1; // 1/150 = 0.666%
export const SHARDS_MINES_FAIL_PROBABILITY = 149; // 149/150 = 99.33%
export const SHARDS_MINE_INITIAL_WHEAT_BALANCE = 1000;
export const SHARDS_MINE_INITIAL_FISH_BALANCE = 1000;

export const AGENT_FIND_PROBABILITY = 5; // 5/100 = 5%
export const AGENT_FIND_FAIL_PROBABILITY = 95; // 95/100 = 95%

export const HYPSTRUCTURE_WIN_PROBABILITY_AT_CENTER = 4000; // 4_000 / 100_000 = 4%
export const HYPSTRUCTURE_FAIL_PROBABILITY_AT_CENTER = 96_000; // 96_000 / 100_000 = 96%

export const QUEST_FIND_PROBABILITY = 1; // 1/60_000 = 1%
export const QUEST_FIND_FAIL_PROBABILITY = 59_999; // 59_999/60_000 = 99.99833333333333%

// This means that for every x hexes away from the center, the win probability gets
// multiplied by 0.975. so the formula is 4% * (0.975 ^ x)
export const HYPSTRUCTURE_FAIL_MULTIPLIER_PER_RADIUS_FROM_CENTER = 9_750; // 9_750 / 10_000 = 97.5%

// Without considering the hex distance, this is a linear multiplier for every
// hyperstructure found. e.g if there have been y hyperstructures found, the probability
// of finding a hyperstructure is max(4% - (0.001% * y), 0%)
export const HYPSTRUCTURE_FAIL_PROB_INCREASE_PER_HYPERSTRUCTURE_FOUND = 1; // 1 / 100_000 = 0.001%

// ----- Tick ----- //
export const DEFAULT_TICK_INTERVAL_SECONDS = 1;
export const ARMIES_TICK_INTERVAL_SECONDS = 3600;

// ----- Speed ----- //
// @dev: Seconds per km
export const DONKEY_SPEED = 9;

// @TODO: Deprecate this constant everywhere
export const ARMY_SPEED = 1;

// ----- Battle ----- //
export const BATTLE_GRACE_TICK_COUNT = 24;

// ----- Settlement ----- //
export const SETTLEMENT_CENTER = 2147483646;
export const SETTLEMENT_BASE_DISTANCE = 30;
export const SETTLEMENT_SUBSEQUENT_DISTANCE = 10;
export const SETTLEMENT_POINTS_PLACED = 0;
export const SETTLEMENT_CURRENT_LAYER = 1;
export const SETTLEMENT_CURRENT_SIDE = 1;
export const SETTLEMENT_CURRENT_POINT_ON_SIDE = 0;

// ----- Season ----- //
export const SEASON_PASS_ADDRESS = "0x0"; // set in indexer.sh
export const REALMS_ADDRESS = "0x0"; // set in indexer.sh
export const LORDS_ADDRESS = "0x0"; // set in indexer.sh

export const VELORDS_FEE_ON_DEPOSIT = 250; // 2.5%
export const SEASON_POOL_FEE_ON_DEPOSIT = 250; // 2.5%
export const CLIENT_FEE_ON_DEPOSIT = 250; // 2.5%
export const REALM_FEE_ON_DEPOSIT = 500; // 5%

export const VELORDS_FEE_ON_WITHDRAWAL = 250; // 2.5%
export const SEASON_POOL_FEE_ON_WITHDRAWAL = 250; // 2.5%
export const CLIENT_FEE_ON_WITHDRAWAL = 250; // 2.5%
export const REALM_FEE_ON_WITHDRAWAL = 500; // 5%

export const VELORDS_FEE_RECIPIENT = "0x045c587318c9ebcf2fbe21febf288ee2e3597a21cd48676005a5770a50d433c5";

//######### TODO: CHANGE SEASON POOL RECIPIENT #########

export const SEASON_POOL_FEE_RECIPIENT = "0x04CD21aA3E634E36d6379bdbB3FeF78F7E0A882Eb8a048624c4b02eeAD1bC553";
export const MAX_NUM_BANKS = 6;

const ONE_MINUTE_IN_SECONDS = 60;
const ONE_HOUR_IN_SECONDS = 60 * ONE_MINUTE_IN_SECONDS;
const ONE_DAY_IN_SECONDS = 24 * ONE_HOUR_IN_SECONDS;

export const SEASON_SETTLING_AFTER_SECONDS = ONE_DAY_IN_SECONDS; // 1 day
export const SEASON_START_AFTER_SECONDS = ONE_DAY_IN_SECONDS + ONE_HOUR_IN_SECONDS * 12; // 1 and half day

// probably best if both these values are the same
export const SEASON_BRIDGE_CLOSE_AFTER_END_SECONDS = ONE_DAY_IN_SECONDS * 7; // 7 days
export const SEASON_POINT_REGISTRATION_CLOSE_AFTER_END_SECONDS = ONE_DAY_IN_SECONDS * 7; // 7 days

export const TRADE_MAX_COUNT = 10;

export const AGENT_CONTROLLER_ADDRESS = "0x0277eE04e3f82D4E805Ab0e2044C53fB6d61ABd00a2a7f44B78410e9b43E1344"; // set in indexer.sh
export const AGENT_MAX_LIFETIME_COUNT = 10_000;
export const AGENT_MAX_CURRENT_COUNT = 1_000;
export const AGENT_MIN_SPAWN_LORDS_AMOUNT = 10;
export const AGENT_MAX_SPAWN_LORDS_AMOUNT = 35;

export const WONDER_PRODUCTION_BONUS_WITHIN_TILE_DISTANCE = 12;
export const WONDER_PRODUCTION_BONUS_PERCENT_NUM = 2000; // 20%

// catridge address should go here
export const VILLAGE_TOKEN_MINT_RECIPIENT = "0x03f7f4e5a23a712787f0c100f02934c4a88606b7f0c880c2fd43e817e6275d83";
export const VILLAGE_TOKEN_NFT_CONTRACT = await getSeasonAddresses(process.env.VITE_PUBLIC_CHAIN! as Chain)!
  .villagePass!;

export const EternumGlobalConfig: Config = {
  agent: {
    controller_address: AGENT_CONTROLLER_ADDRESS,
    max_lifetime_count: AGENT_MAX_LIFETIME_COUNT,
    max_current_count: AGENT_MAX_CURRENT_COUNT,
    min_spawn_lords_amount: AGENT_MIN_SPAWN_LORDS_AMOUNT,
    max_spawn_lords_amount: AGENT_MAX_SPAWN_LORDS_AMOUNT,
  },
  village: {
    village_pass_nft_address: VILLAGE_TOKEN_NFT_CONTRACT,
    village_mint_initial_recipient: VILLAGE_TOKEN_MINT_RECIPIENT,
  },
  resources: {
    resourcePrecision: RESOURCE_PRECISION,
    productionByComplexRecipe: RESOURCE_PRODUCTION_INPUT_RESOURCES,
    productionByComplexRecipeOutputs: RESOURCE_PRODUCTION_OUTPUT_AMOUNTS,
    productionBySimpleRecipe: RESOURCE_PRODUCTION_INPUT_RESOURCES_SIMPLE_SYSTEM,
    productionBySimpleRecipeOutputs: RESOURCE_PRODUCTION_OUTPUT_AMOUNTS_SIMPLE_SYSTEM,
    laborOutputPerResource: LABOR_PRODUCTION_OUTPUT_AMOUNTS_THROUGH_RESOURCES,
    resourceWeightsGrams: RESOURCES_WEIGHTS_NANOGRAM,
    resourceRarity: RESOURCE_RARITY,
  },
  trade: {
    maxCount: TRADE_MAX_COUNT,
  },
  banks: {
    name: BANK_NAME,
    lordsCost: BANK_LORDS_COST,
    lpFeesNumerator: BANK_LP_FEES_NUMERATOR,
    lpFeesDenominator: BANK_LP_FEES_DENOMINATOR,
    ownerFeesNumerator: BANK_OWNER_FEES_NUMERATOR,
    ownerFeesDenominator: BANK_OWNER_FEES_DENOMINATOR,
    maxNumBanks: MAX_NUM_BANKS,
    ammStartingLiquidity: AMM_STARTING_LIQUIDITY,
    lordsLiquidityPerResource: LORDS_LIQUIDITY_PER_RESOURCE,
  },
  populationCapacity: {
    workerHuts: WORKER_HUTS_CAPACITY,
    basePopulation: BASE_POPULATION_CAPACITY,
  },
  exploration: {
    reward: EXPLORATION_REWARD,
    shardsMinesFailProbability: SHARDS_MINES_FAIL_PROBABILITY,
    shardsMinesWinProbability: SHARDS_MINES_WIN_PROBABILITY,
    agentFindProbability: AGENT_FIND_PROBABILITY,
    agentFindFailProbability: AGENT_FIND_FAIL_PROBABILITY,
    hyperstructureWinProbAtCenter: HYPSTRUCTURE_WIN_PROBABILITY_AT_CENTER,
    hyperstructureFailProbAtCenter: HYPSTRUCTURE_FAIL_PROBABILITY_AT_CENTER,
    hyperstructureFailProbIncreasePerHexDistance: HYPSTRUCTURE_FAIL_MULTIPLIER_PER_RADIUS_FROM_CENTER,
    hyperstructureFailProbIncreasePerHyperstructureFound: HYPSTRUCTURE_FAIL_PROB_INCREASE_PER_HYPERSTRUCTURE_FOUND,
    shardsMineInitialWheatBalance: SHARDS_MINE_INITIAL_WHEAT_BALANCE,
    shardsMineInitialFishBalance: SHARDS_MINE_INITIAL_FISH_BALANCE,
    questFindProbability: QUEST_FIND_PROBABILITY,
    questFindFailProbability: QUEST_FIND_FAIL_PROBABILITY,
  },
  tick: {
    defaultTickIntervalInSeconds: DEFAULT_TICK_INTERVAL_SECONDS,
    armiesTickIntervalInSeconds: ARMIES_TICK_INTERVAL_SECONDS,
  },
  carryCapacityGram: {
    [CapacityConfig.None]: 0,
    [CapacityConfig.RealmStructure]: 1_000_000 * 1000, // 1m kg
    [CapacityConfig.VillageStructure]: 1_000_000 * 1000, // 1m kg
    [CapacityConfig.HyperstructureStructure]: 3_000_000 * 1000, // 3m kg
    [CapacityConfig.BankStructure]: 2_000_000 * 1000, // 2m kg
    [CapacityConfig.FragmentMineStructure]: 500_000 * 1000, // 500k kg
    [CapacityConfig.Donkey]: 500 * 1000, // 500 kg per donkey
    // 10_000 gr per army
    [CapacityConfig.Army]: 10 * 1000, // 10 kg per troop count
    [CapacityConfig.Storehouse]: 1_000_000 * 1000, // 1m kg per storehouse
  },
  speed: {
    donkey: DONKEY_SPEED,
    army: ARMY_SPEED,
  },
  battle: {
    graceTickCount: BATTLE_GRACE_TICK_COUNT,
    graceTickCountHyp: 0,
    delaySeconds: 0,
  },
  troop: {
    damage: {
      t1DamageValue: TROOP_BASE_DAMAGE,
      t2DamageMultiplier: TROOP_T2_DAMAGE_MULTIPLIER,
      t3DamageMultiplier: TROOP_T3_DAMAGE_MULTIPLIER,
      damageRaidPercentNum: TROOP_DAMAGE_RAID_PERCENT_NUM,
      damageBiomeBonusNum: TROOP_DAMAGE_BIOME_BONUS_NUM,
      damageScalingFactor: TROOP_DAMAGE_SCALING_FACTOR,
      damageBetaSmall: TROOP_DAMAGE_BETA_SMALL,
      damageBetaLarge: TROOP_DAMAGE_BETA_LARGE,
      damageC0: TROOP_DAMAGE_C0,
      damageDelta: TROOP_DAMAGE_DELTA,
    },
    stamina: {
      staminaGainPerTick: TROOP_STAMINA_GAIN_PER_TICK,
      staminaInitial: TROOP_STAMINA_INITIAL,
      staminaBonusValue: TROOP_STAMINA_BIOME_BONUS_VALUE,
      staminaKnightMax: TROOP_STAMINA_MAX[ResourcesIds.Knight],
      staminaPaladinMax: TROOP_STAMINA_MAX[ResourcesIds.Paladin],
      staminaCrossbowmanMax: TROOP_STAMINA_MAX[ResourcesIds.Crossbowman],
      staminaAttackReq: TROOP_STAMINA_ATTACK_REQ,
      staminaAttackMax: TROOP_STAMINA_ATTACK_MAX,
      staminaExploreWheatCost: TROOP_EXPLORE_WHEAT_COST,
      staminaExploreFishCost: TROOP_EXPLORE_FISH_COST,
      staminaExploreStaminaCost: TROOP_EXPLORE_STAMINA_COST,
      staminaTravelWheatCost: TROOP_TRAVEL_WHEAT_COST,
      staminaTravelFishCost: TROOP_TRAVEL_FISH_COST,
      staminaTravelStaminaCost: TROOP_TRAVEL_STAMINA_COST,
    },
    limit: {
      explorerMaxPartyCount: TROOP_EXPLORER_MAX_PARTY_COUNT,
      explorerAndGuardMaxTroopCount: TROOP_EXPLORER_GUARD_MAX_TROOP_COUNT,
      guardResurrectionDelay: TROOP_GUARD_RESURRECTION_DELAY,
      mercenariesTroopLowerBound: TROOP_MERCENARIES_TROOP_LOWER_BOUND,
      mercenariesTroopUpperBound: TROOP_MERCENARIES_TROOP_UPPER_BOUND,
      agentTroopLowerBound: TROOP_AGENTS_TROOP_LOWER_BOUND,
      agentTroopUpperBound: TROOP_AGENTS_TROOP_UPPER_BOUND,
    },
  },
  settlement: {
    center: SETTLEMENT_CENTER,
    base_distance: SETTLEMENT_BASE_DISTANCE,
    subsequent_distance: SETTLEMENT_SUBSEQUENT_DISTANCE,
  },
  buildings: {
    buildingCapacity: BUILDING_CAPACITY,
    buildingPopulation: BUILDING_POPULATION,
    buildingResourceProduced: BUILDING_RESOURCE_PRODUCED,
    complexBuildingCosts: COMPLEX_BUILDING_COSTS,
    simpleBuildingCost: SIMPLE_BUILDING_COSTS,
    buildingFixedCostScalePercent: BUILDING_FIXED_COST_SCALE_PERCENT,
  },
  hyperstructures: {
    hyperstructureInitializationShardsCost: HYPERSTRUCTURE_SHARDS_COST,
    hyperstructureConstructionCost: HYPERSTRUCTURE_COSTS,
    hyperstructurePointsPerCycle: HYPERSTRUCTURE_POINTS_PER_CYCLE,
    hyperstructurePointsForWin: HYPERSTRUCTURE_POINTS_FOR_WIN,
  },
  season: {
    startSettlingAfterSeconds: SEASON_SETTLING_AFTER_SECONDS,
    startMainAfterSeconds: SEASON_START_AFTER_SECONDS,
    bridgeCloseAfterEndSeconds: SEASON_BRIDGE_CLOSE_AFTER_END_SECONDS,
    pointRegistrationCloseAfterEndSeconds: SEASON_POINT_REGISTRATION_CLOSE_AFTER_END_SECONDS,
  },
  bridge: {
    velords_fee_on_dpt_percent: VELORDS_FEE_ON_DEPOSIT,
    velords_fee_on_wtdr_percent: VELORDS_FEE_ON_WITHDRAWAL,
    season_pool_fee_on_dpt_percent: SEASON_POOL_FEE_ON_DEPOSIT,
    season_pool_fee_on_wtdr_percent: SEASON_POOL_FEE_ON_WITHDRAWAL,
    client_fee_on_dpt_percent: CLIENT_FEE_ON_DEPOSIT,
    client_fee_on_wtdr_percent: CLIENT_FEE_ON_WITHDRAWAL,
    velords_fee_recipient: VELORDS_FEE_RECIPIENT,
    season_pool_fee_recipient: SEASON_POOL_FEE_RECIPIENT,
    realm_fee_dpt_percent: REALM_FEE_ON_DEPOSIT,
    realm_fee_wtdr_percent: REALM_FEE_ON_WITHDRAWAL,
  },
  vrf: {
    vrfProviderAddress: process.env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS!,
  },
  wonderProductionBonus: {
    within_tile_distance: WONDER_PRODUCTION_BONUS_WITHIN_TILE_DISTANCE,
    bonus_percent_num: WONDER_PRODUCTION_BONUS_PERCENT_NUM,
  },
  startingResources: STARTING_RESOURCES,
  villageStartingResources: VILLAGE_STARTING_RESOURCES,
  realmUpgradeCosts: REALM_UPGRADE_COSTS,
  realmMaxLevel: REALM_MAX_LEVEL,
  villageMaxLevel: VILLAGE_MAX_LEVEL,
  setup: {
    chain: process.env.VITE_PUBLIC_CHAIN!,
    addresses: await getSeasonAddresses(process.env.VITE_PUBLIC_CHAIN! as Chain),
    manifest: manifest,
  },
};
