import { CapacityConfig } from "@bibliothecadao/types";
import type { ConfigPatch } from "./merge-config";

const ONE_MINUTE_IN_SECONDS = 60;
const ONE_HOUR_IN_SECONDS = 60 * ONE_MINUTE_IN_SECONDS;
const ONE_DAY_IN_SECONDS = 24 * ONE_HOUR_IN_SECONDS;

const BASE_POPULATION_CAPACITY = 6;
const DEFAULT_TICK_INTERVAL_SECONDS = 1;
const ARMIES_TICK_INTERVAL_SECONDS = ONE_MINUTE_IN_SECONDS;
const DELIVERY_TICK_INTERVAL_SECONDS = ONE_MINUTE_IN_SECONDS * 3;
const BITCOIN_PHASE_SECONDS = ONE_MINUTE_IN_SECONDS * 10;
const DONKEY_SPEED = 9;
const ARMY_SPEED = 1;
const BATTLE_GRACE_TICK_COUNT = 24;
const VILLAGE_RAID_IMMUNITY_TICKS = 24;
const SETTLEMENT_CENTER = 2147483646;
const SETTLEMENT_BASE_DISTANCE = 8;
const SETTLEMENT_LAYERS_SKIPPED = 2;
const SETTLEMENT_LAYER_MAX = 6;
const SETTLEMENT_LAYER_CAPACITY_BPS = 8000;
const SETTLEMENT_LAYER_CAPACITY_INCREMENT = 6;
const VELORDS_FEE_ON_DEPOSIT = 250;
const SEASON_POOL_FEE_ON_DEPOSIT = 250;
const CLIENT_FEE_ON_DEPOSIT = 250;
const REALM_FEE_ON_DEPOSIT = 500;
const VELORDS_FEE_ON_WITHDRAWAL = 250;
const SEASON_POOL_FEE_ON_WITHDRAWAL = 250;
const CLIENT_FEE_ON_WITHDRAWAL = 250;
const REALM_FEE_ON_WITHDRAWAL = 500;
const VELORDS_FEE_RECIPIENT = "0x045c587318c9ebcf2fbe21febf288ee2e3597a21cd48676005a5770a50d433c5";
const SEASON_POOL_FEE_RECIPIENT = "0x04CD21aA3E634E36d6379bdbB3FeF78F7E0A882Eb8a048624c4b02eeAD1bC553";
const SEASON_SETTLING_AFTER_SECONDS = ONE_DAY_IN_SECONDS;
const SEASON_START_AFTER_SECONDS = ONE_DAY_IN_SECONDS + ONE_HOUR_IN_SECONDS * 12;
const SEASON_DURATION_SECONDS = ONE_HOUR_IN_SECONDS * 1.5;
const SEASON_BRIDGE_CLOSE_AFTER_END_SECONDS = ONE_DAY_IN_SECONDS * 7;
const SEASON_POINT_REGISTRATION_CLOSE_AFTER_END_SECONDS = ONE_DAY_IN_SECONDS * 7;
const AGENT_CONTROLLER_ADDRESS = "0x0277eE04e3f82D4E805Ab0e2044C53fB6d61ABd00a2a7f44B78410e9b43E1344";
const AGENT_MAX_LIFETIME_COUNT = 10_000;
const AGENT_MAX_CURRENT_COUNT = 1_000;
const AGENT_MIN_SPAWN_LORDS_AMOUNT = 10;
const AGENT_MAX_SPAWN_LORDS_AMOUNT = 35;
const WONDER_PRODUCTION_BONUS_WITHIN_TILE_DISTANCE = 12;
const WONDER_PRODUCTION_BONUS_PERCENT_NUM = 0;
const VILLAGE_TOKEN_MINT_RECIPIENT = "0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec";

export function buildCommonBaseConfig(): ConfigPatch {
  return {
    agent: {
      controller_address: AGENT_CONTROLLER_ADDRESS,
      max_lifetime_count: AGENT_MAX_LIFETIME_COUNT,
      max_current_count: AGENT_MAX_CURRENT_COUNT,
      min_spawn_lords_amount: AGENT_MIN_SPAWN_LORDS_AMOUNT,
      max_spawn_lords_amount: AGENT_MAX_SPAWN_LORDS_AMOUNT,
    },
    village: {
      village_mint_initial_recipient: VILLAGE_TOKEN_MINT_RECIPIENT,
    },
    populationCapacity: {
      basePopulation: BASE_POPULATION_CAPACITY,
    },
    tick: {
      defaultTickIntervalInSeconds: DEFAULT_TICK_INTERVAL_SECONDS,
      armiesTickIntervalInSeconds: ARMIES_TICK_INTERVAL_SECONDS,
      deliveryTickIntervalInSeconds: DELIVERY_TICK_INTERVAL_SECONDS,
      bitcoinPhaseInSeconds: BITCOIN_PHASE_SECONDS,
    },
    carryCapacityGram: {
      [CapacityConfig.None]: 0,
      [CapacityConfig.RealmStructure]: 18446744073709551615n,
      [CapacityConfig.VillageStructure]: 18446744073709551615n,
      [CapacityConfig.HyperstructureStructure]: 18446744073709551615n,
      [CapacityConfig.BankStructure]: 18446744073709551615n,
      [CapacityConfig.FragmentMineStructure]: 18446744073709551615n,
      [CapacityConfig.HolySiteStructure]: 18446744073709551615n,
      [CapacityConfig.CampStructure]: 18446744073709551615n,
      [CapacityConfig.BitcoinMineStructure]: 18446744073709551615n,
      [CapacityConfig.Donkey]: 50 * 1000,
      [CapacityConfig.Army]: 10 * 1000,
      [CapacityConfig.Storehouse]: 0,
    },
    speed: {
      donkey: DONKEY_SPEED,
      army: ARMY_SPEED,
    },
    battle: {
      regularImmunityTicks: BATTLE_GRACE_TICK_COUNT,
      villageImmunityTicks: 0,
      delaySeconds: 0,
      villageRaidImmunityTicks: VILLAGE_RAID_IMMUNITY_TICKS,
    },
    settlement: {
      center: SETTLEMENT_CENTER,
      base_distance: SETTLEMENT_BASE_DISTANCE,
      layers_skipped: SETTLEMENT_LAYERS_SKIPPED,
      layer_max: SETTLEMENT_LAYER_MAX,
      layer_capacity_increment: SETTLEMENT_LAYER_CAPACITY_INCREMENT,
      layer_capacity_bps: SETTLEMENT_LAYER_CAPACITY_BPS,
      single_realm_mode: false,
      two_player_mode: false,
    },
    season: {
      startSettlingAfterSeconds: SEASON_SETTLING_AFTER_SECONDS,
      startMainAfterSeconds: SEASON_START_AFTER_SECONDS,
      durationSeconds: SEASON_DURATION_SECONDS,
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
    wonderProductionBonus: {
      within_tile_distance: WONDER_PRODUCTION_BONUS_WITHIN_TILE_DISTANCE,
      bonus_percent_num: WONDER_PRODUCTION_BONUS_PERCENT_NUM,
    },
    questGames: [
      {
        address: "0x01e1c477f2ef896fd638b50caa31e3aa8f504d5c6cb3c09c99cd0b72523f07f7",
        levels: [
          { target_score: 26, settings_id: 3, time_limit: 86400 },
          { target_score: 26, settings_id: 6, time_limit: 86400 },
          { target_score: 26, settings_id: 4, time_limit: 86400 },
          { target_score: 51, settings_id: 1, time_limit: 86400 },
          { target_score: 101, settings_id: 5, time_limit: 86400 },
        ],
        overwrite: true,
      },
    ],
    dev: {
      mode: {
        on: false,
      },
    },
    factory: {
      address: "0",
    },
  };
}
