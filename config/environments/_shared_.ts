import { getContractByName, NAMESPACE } from "@bibliothecadao/provider";
import {
  CapacityConfig,
  RESOURCE_PRECISION,
  RESOURCE_RARITY,
  ResourcesIds,
  type Config,
} from "@bibliothecadao/types";
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
  HYPERSTRUCTURE_SHARDS_COST
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
export const SHARDS_MINES_WIN_PROBABILITY = 100; // 100 / 10_000 = 1%
export const SHARDS_MINES_FAIL_PROBABILITY = 9900; // 9900 / 10_000 = 99%
export const SHARDS_MINE_INITIAL_WHEAT_BALANCE = 1000;
export const SHARDS_MINE_INITIAL_FISH_BALANCE = 1000;

export const AGENT_FIND_PROBABILITY = 100; // 100/600 = 16.66%
export const AGENT_FIND_FAIL_PROBABILITY = 500; // 500/600 = 83.33%

export const HYPSTRUCTURE_WIN_PROBABILITY_AT_CENTER = 20_000; // 20_000 / 120_000 = 16.66%
export const HYPSTRUCTURE_FAIL_PROBABILITY_AT_CENTER = 100_000; // 100_000 / 120_000 = 83.33%

// by increasing this value, fail probability increases faster.
// i.e the farther away from the center, the less likely to find a hyperstructure
//
// Using the values above and below, if a troop is more than 25 hexes away from the center,
// the probability of finding a hyperstructure is essentially 0% i.e FLOOR(16.66/1.66) = 10
export const HYPSTRUCTURE_FAIL_PROB_INCREASE_PER_HEX_DISTANCE = 200; // 200 / 120_000 = 0.166%

// using the above and below values (without considering the hex distance),
// if there have been 2 hyperstructures found, the probability
// of finding a hyperstructure is 16.66 - (1.25 * 2) = 14.16%
export const HYPSTRUCTURE_FAIL_PROB_INCREASE_PER_HYPERSTRUCTURE_FOUND = 1500; // 1500 / 120_000 = 1.25%

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
export const BATTLE_GRACE_TICK_COUNT_HYPERSTRUCTURES = 1;
export const BATTLE_DELAY_SECONDS = 8 * 60 * 60;

// ----- Troops ----- //
export const TROOP_HEALTH = 1;
export const TROOP_KNIGHT_STRENGTH = 1;
export const TROOP_PALADIN_STRENGTH = 1;
export const TROOP_CROSSBOWMAN_STRENGTH = 1;
export const TROOP_ADVANTAGE_PERCENT = 1000;
export const TROOP_DISADVANTAGE_PERCENT = 1000;
export const TROOP_MAX_COUNT = 500_000;
export const TROOP_BASE_ARMY_NUMBER_FOR_STRUCTURE = 3;
export const TROOP_ARMY_EXTRA_PER_MILITARY_BUILDING = 1;
export const TROOP_MAX_ARMIES_PER_STRUCTURE = 7;
export const TROOP_PILLAGE_HEALTH_DIVISOR = 8;
export const TROOP_BATTLE_LEAVE_SLASH_NUM = 25;
export const TROOP_BATTLE_LEAVE_SLASH_DENOM = 100;
export const TROOP_BATTLE_TIME_REDUCTION_SCALE = 1_000;
export const TROOP_BATTLE_MAX_TIME_SECONDS = 2 * 86400; // 2 days

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

export const VELORDS_FEE_ON_DEPOSIT = 400; // 4%
export const VELORDS_FEE_ON_WITHDRAWAL = 400; // 4%
export const SEASON_POOL_FEE_ON_DEPOSIT = 400; // 4%
export const SEASON_POOL_FEE_ON_WITHDRAWAL = 400; // 4%
export const CLIENT_FEE_ON_DEPOSIT = 200; // 2%
export const CLIENT_FEE_ON_WITHDRAWAL = 200; // 2%
export const VELORDS_FEE_RECIPIENT = "0x045c587318c9ebcf2fbe21febf288ee2e3597a21cd48676005a5770a50d433c5";
export const SEASON_POOL_FEE_RECIPIENT = getContractByName(manifest, `${NAMESPACE}-season_systems`);
export const REALM_FEE_ON_DEPOSIT = 5; // 5%
export const REALM_FEE_ON_WITHDRAWAL = 5; // 5%
export const MAX_NUM_BANKS = 6;

const ONE_MINUTE_IN_SECONDS = 60;
const ONE_HOUR_IN_SECONDS = 60 * ONE_MINUTE_IN_SECONDS;
const ONE_DAY_IN_SECONDS = 24 * ONE_HOUR_IN_SECONDS;

export const SEASON_SETTLING_AFTER_SECONDS = ONE_DAY_IN_SECONDS; // 1 day
export const SEASON_START_AFTER_SECONDS = ONE_DAY_IN_SECONDS + ONE_HOUR_IN_SECONDS * 12; // 1 and half day
export const SEASON_BRIDGE_CLOSE_AFTER_END_SECONDS = ONE_DAY_IN_SECONDS * 2; // 2 days

export const TRADE_MAX_COUNT = 5;

export const AGENT_CONTROLLER_ADDRESS = "0x01BFC84464f990C09Cc0e5D64D18F54c3469fD5c467398BF31293051bAde1C39"; // set in indexer.sh

export const WONDER_PRODUCTION_BONUS_WITHIN_TILE_DISTANCE = 12;
export const WONDER_PRODUCTION_BONUS_PERCENT_NUM = 2000; // 20%

// catridge address should go here 
export const VILLAGE_TOKEN_MINT_RECIPIENT = "0x01BFC84464f990C09Cc0e5D64D18F54c3469fD5c467398BF31293051bAde1C39";
export const VILLAGE_TOKEN_NFT_CONTRACT = await getSeasonAddresses(process.env.VITE_PUBLIC_CHAIN! as Chain)!.villagePass!

export const EternumGlobalConfig: Config = {
  agent: {
    controller_address: AGENT_CONTROLLER_ADDRESS,
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
    hyperstructureFailProbIncreasePerHexDistance: HYPSTRUCTURE_FAIL_PROB_INCREASE_PER_HEX_DISTANCE,
    hyperstructureFailProbIncreasePerHyperstructureFound: HYPSTRUCTURE_FAIL_PROB_INCREASE_PER_HYPERSTRUCTURE_FOUND,
    shardsMineInitialWheatBalance: SHARDS_MINE_INITIAL_WHEAT_BALANCE,
    shardsMineInitialFishBalance: SHARDS_MINE_INITIAL_FISH_BALANCE,
  },
  tick: {
    defaultTickIntervalInSeconds: DEFAULT_TICK_INTERVAL_SECONDS,
    armiesTickIntervalInSeconds: ARMIES_TICK_INTERVAL_SECONDS,
  },
  carryCapacityGram: {
    [CapacityConfig.None]: 0,
    [CapacityConfig.Structure]: 400_000_000_000, // 400m kg
    [CapacityConfig.Donkey]: 500_000,
    // 10_000 gr per army
    [CapacityConfig.Army]: 10_000,
    [CapacityConfig.Storehouse]: 300_000_000,
  },
  speed: {
    donkey: DONKEY_SPEED,
    army: ARMY_SPEED,
  },
  battle: {
    graceTickCount: BATTLE_GRACE_TICK_COUNT,
    graceTickCountHyp: BATTLE_GRACE_TICK_COUNT_HYPERSTRUCTURES,
    delaySeconds: BATTLE_DELAY_SECONDS,
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
