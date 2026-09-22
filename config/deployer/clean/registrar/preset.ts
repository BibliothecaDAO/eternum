import { CapacityConfig, type Config } from "@bibliothecadao/types";
import { hash, shortString } from "starknet";
import { BLITZ_REGISTRATION_COUNT_CAP } from "../constants";

export interface CreateGamePayloadInput {
  gameName: string;
  presetId: number;
  startMainAt: number;
  chainTimestamp: number;
  durationSeconds: number;
  devModeOn: boolean;
  singleRealmMode: boolean;
  twoPlayerMode: boolean;
  useMapOverride: boolean;
}

function scaleAmount(amount: number, precision: number): number {
  return amount * precision;
}

export function buildMapConfig(config: Config) {
  return {
    reward_resource_amount: config.exploration.reward,
    shards_mines_win_probability: config.exploration.shardsMinesWinProbability,
    shards_mines_fail_probability: config.exploration.shardsMinesFailProbability,
    camp_win_probability: config.exploration.campFindProbability,
    camp_fail_probability: config.exploration.campFindFailProbability,
    // Reserved layout slots for existing games; standalone holy sites are retired.
    holysite_win_probability: 0,
    holysite_fail_probability: 0,
    bitcoin_mine_win_probability: config.exploration.bitcoinMineWinProbability,
    bitcoin_mine_fail_probability: config.exploration.bitcoinMineFailProbability,
    hyps_win_prob: config.exploration.hyperstructureWinProbAtCenter,
    hyps_fail_prob: config.exploration.hyperstructureFailProbAtCenter,
    hyps_fail_prob_increase_p_hex: config.exploration.hyperstructureFailProbIncreasePerHexDistance,
    hyps_fail_prob_increase_p_fnd: config.exploration.hyperstructureFailProbIncreasePerHyperstructureFound,
    relic_discovery_interval_sec: config.exploration.relicDiscoveryIntervalSeconds,
    relic_hex_dist_from_center: config.exploration.relicHexDistanceFromCenter,
    relic_chest_relics_per_chest: config.exploration.relicChestRelicsPerChest,
  };
}

export function buildTroopDamageConfig(config: Config) {
  return {
    damage_raid_percent_num: config.troop.damage.damageRaidPercentNum,
    damage_biome_bonus_num: config.troop.damage.damageBiomeBonusNum,
    damage_scaling_factor: config.troop.damage.damageScalingFactor,
    t1_damage_value: config.troop.damage.t1DamageValue,
    t2_damage_multiplier: config.troop.damage.t2DamageMultiplier,
    t3_damage_multiplier: config.troop.damage.t3DamageMultiplier,
  };
}

export function buildTroopStaminaConfig(config: Config) {
  const precision = config.resources.resourcePrecision;
  return {
    stamina_gain_per_tick: config.troop.stamina.staminaGainPerTick,
    stamina_initial: config.troop.stamina.staminaInitial,
    stamina_bonus_value: config.troop.stamina.staminaBonusValue,
    stamina_knight_max: config.troop.stamina.staminaKnightMax,
    stamina_paladin_max: config.troop.stamina.staminaPaladinMax,
    stamina_crossbowman_max: config.troop.stamina.staminaCrossbowmanMax,
    stamina_attack_req: config.troop.stamina.staminaAttackReq,
    stamina_defense_req: config.troop.stamina.staminaDefenseReq,
    stamina_explore_stamina_cost: config.troop.stamina.staminaExploreStaminaCost,
    stamina_travel_stamina_cost: config.troop.stamina.staminaTravelStaminaCost,
    stamina_explore_wheat_cost: scaleAmount(config.troop.stamina.staminaExploreWheatCost, precision),
    stamina_explore_fish_cost: scaleAmount(config.troop.stamina.staminaExploreFishCost, precision),
    stamina_travel_wheat_cost: scaleAmount(config.troop.stamina.staminaTravelWheatCost, precision),
    stamina_travel_fish_cost: scaleAmount(config.troop.stamina.staminaTravelFishCost, precision),
  };
}

export function buildTroopLimitConfig(config: Config) {
  return {
    guard_resurrection_delay: config.troop.limit.guardResurrectionDelay,
    settlement_armies: config.troop.limit.settlementArmies,
    city_armies: config.troop.limit.cityArmies,
    kingdom_armies: config.troop.limit.kingdomArmies,
    empire_armies: config.troop.limit.empireArmies,
    settlement_guard_slots: config.troop.limit.settlementGuardSlots,
    city_guard_slots: config.troop.limit.cityGuardSlots,
    kingdom_guard_slots: config.troop.limit.kingdomGuardSlots,
    empire_guard_slots: config.troop.limit.empireGuardSlots,
    starting_guard: config.troop.limit.startingGuard,

    mercenaries_troop_lower_bound: config.troop.limit.mercenariesTroopLowerBound,
    mercenaries_troop_upper_bound: config.troop.limit.mercenariesTroopUpperBound,
    settlement_deployment_cap: config.troop.limit.settlementDeploymentCap,
    city_deployment_cap: config.troop.limit.cityDeploymentCap,
    kingdom_deployment_cap: config.troop.limit.kingdomDeploymentCap,
    empire_deployment_cap: config.troop.limit.empireDeploymentCap,
    t1_tier_strength: config.troop.limit.t1TierStrength,
    t2_tier_strength: config.troop.limit.t2TierStrength,
    t3_tier_strength: config.troop.limit.t3TierStrength,
    t1_tier_modifier: config.troop.limit.t1TierModifier,
    t2_tier_modifier: config.troop.limit.t2TierModifier,
    t3_tier_modifier: config.troop.limit.t3TierModifier,
  };
}

export function buildCapacityConfig(config: Config) {
  return {
    troop_capacity: config.carryCapacityGram[CapacityConfig.Army],
    donkey_capacity: config.carryCapacityGram[CapacityConfig.Donkey],
    storehouse_boost_capacity: config.carryCapacityGram[CapacityConfig.Storehouse],
  };
}

export function buildStructureCapacityConfig(config: Config) {
  return {
    realm_capacity: config.carryCapacityGram[CapacityConfig.RealmStructure],
    village_capacity: config.carryCapacityGram[CapacityConfig.VillageStructure],
    hyperstructure_capacity: config.carryCapacityGram[CapacityConfig.HyperstructureStructure],
    fragment_mine_capacity: config.carryCapacityGram[CapacityConfig.FragmentMineStructure],
    bank_structure_capacity: config.carryCapacityGram[CapacityConfig.BankStructure],
    camp_capacity: config.carryCapacityGram[CapacityConfig.CampStructure],
    bitcoin_mine_capacity: config.carryCapacityGram[CapacityConfig.BitcoinMineStructure],
  };
}

export function buildBiomeClimateConfig(config: Config) {
  return {
    elevation_scale_bps: config.biomeClimate.elevationScaleBps,
    moisture_scale_bps: config.biomeClimate.moistureScaleBps,
    elevation_bias_bps: config.biomeClimate.elevationBiasBps,
    moisture_bias_bps: config.biomeClimate.moistureBiasBps,
    elevation_seed: config.biomeClimate.elevationSeed,
    moisture_seed: config.biomeClimate.moistureSeed,
  };
}

function resolveRegistrationSchedule(startMainAt: number, chainTimestamp: number) {
  if (!Number.isSafeInteger(chainTimestamp) || chainTimestamp < 1) {
    throw new Error("Game creation requires a positive chain timestamp");
  }
  const startSettlingAt = Math.min(chainTimestamp, startMainAt);
  return { registrationStartAt: startSettlingAt - 1, startSettlingAt };
}

function resolveRegistrationCountMax(config: Config, twoPlayerMode: boolean): number {
  if (!config.blitz.mode.on) {
    if (twoPlayerMode) {
      throw new Error("Eternum seasons do not support two-player mode");
    }
    return 0;
  }

  const registrationCountMax = twoPlayerMode ? 2 : config.blitz.registration.registration_count_max;
  if (registrationCountMax < 1 || registrationCountMax > BLITZ_REGISTRATION_COUNT_CAP) {
    throw new Error(`Blitz registration_count_max must be between 1 and ${BLITZ_REGISTRATION_COUNT_CAP}`);
  }
  return registrationCountMax;
}

function resolveEndGraceSeconds(config: Config): number {
  const endGraceSeconds = config.season.endGraceSeconds;
  if (
    typeof endGraceSeconds !== "number" ||
    !Number.isInteger(endGraceSeconds) ||
    endGraceSeconds < 0 ||
    endGraceSeconds > 0xffff_ffff
  ) {
    throw new Error("Season endGraceSeconds must be an integer between 0 and 4294967295");
  }
  return endGraceSeconds;
}

function deriveGameSeed(input: CreateGamePayloadInput): string {
  const seed = hash.computePoseidonHashOnElements([shortString.encodeShortString(input.gameName), input.startMainAt]);
  return BigInt(seed) === 0n ? "0x1" : seed;
}

export function buildCreateGameParams(config: Config, input: CreateGamePayloadInput): Record<string, unknown> {
  const { registrationStartAt, startSettlingAt } = resolveRegistrationSchedule(input.startMainAt, input.chainTimestamp);
  const registrationCountMax = resolveRegistrationCountMax(config, input.twoPlayerMode);

  return {
    name: shortString.encodeShortString(input.gameName),
    preset_id: input.presetId,
    start_settling_at: startSettlingAt,
    start_main_at: input.startMainAt,
    duration_seconds: input.durationSeconds,
    end_grace_seconds: resolveEndGraceSeconds(config),

    dev_mode_on: input.devModeOn,
    single_realm_mode: !config.blitz.mode.on || input.singleRealmMode,
    two_player_mode: input.twoPlayerMode,
    registration_count_max: registrationCountMax,
    registration_start_at: registrationStartAt,
    biome_climate_config: buildBiomeClimateConfig(config),
    use_map_override: input.useMapOverride,
    map_override: buildMapConfig(config),
    seed: deriveGameSeed(input),
  };
}
