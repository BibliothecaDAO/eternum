import { getContractByName, NAMESPACE, type EternumProvider } from "@bibliothecadao/provider";
import {
  CapacityConfig,
  MERCENARIES_NAME_FELT,
  RESOURCE_PRECISION,
  scaleResourceInputs,
  scaleResourceOutputs,
} from "@bibliothecadao/types";
import { byteArray } from "starknet";
import type { CleanConfigContext } from "../types";

type NativeConfigProvider = Pick<
  EternumProvider,
  | "manifest"
  | "set_starting_resources_config"
  | "set_world_config"
  | "set_mercenaries_name_config"
  | "set_resource_factory_config"
  | "set_building_config"
  | "set_building_category_config"
  | "set_structure_level_config"
  | "set_structure_max_level_config"
  | "set_resource_weight_config"
  | "set_battle_config"
  | "set_troop_config"
  | "set_bank_config"
  | "set_tick_config"
  | "set_map_config"
  | "set_quest_config"
  | "set_agent_config"
  | "set_village_token_config"
  | "set_capacity_config"
  | "set_trade_config"
  | "set_season_config"
  | "set_vrf_config"
  | "set_resource_bridge_fees_config"
  | "set_donkey_speed_config"
  | "set_hyperstructure_config"
  | "set_settlement_config"
  | "set_faith_config"
  | "set_game_mode_config"
  | "set_factory_address"
  | "set_mmr_config"
  | "set_victory_points_config"
  | "set_discoverable_village_starting_resources_config"
  | "set_blitz_exploration_config"
  | "set_blitz_registration_config"
>;

type NativeConfigContext = CleanConfigContext<NativeConfigProvider>;
type NativeConfig = NativeConfigContext["config"];
type NativeStep = (context: NativeConfigContext) => Promise<void>;
type NativeSigner = Parameters<NativeConfigProvider["set_world_config"]>[0]["signer"];
const BLITZ_REGISTRATION_WINDOW = Symbol("blitzRegistrationWindow");

interface OptionalMmrConfig {
  enabled?: boolean;
  mmr_token_address?: string;
  distribution_mean?: number;
  spread_factor?: number;
  max_delta?: number;
  k_factor?: number;
  lobby_split_weight_scaled?: number;
  mean_regression_scaled?: number;
  min_players?: number;
}

interface ExtendedDeploymentConfig {
  factory_address?: string;
  mmr?: OptionalMmrConfig;
}

interface BlitzRegistrationWindow {
  registrationStartAt: number;
  registrationEndAt: number;
}

type InternalNativeConfig = NativeConfig &
  ExtendedDeploymentConfig & {
    [BLITZ_REGISTRATION_WINDOW]?: BlitzRegistrationWindow;
  };

function getInternalConfig(config: NativeConfig): InternalNativeConfig {
  return config as InternalNativeConfig;
}

// Many config maps are stored as records keyed by numeric enums in JSON.
// Converting them once keeps the step bodies predictable and avoids ad hoc casts.
function numericEntries<Value>(record: Record<number, Value> | Record<string, Value>): Array<[number, Value]> {
  return Object.entries(record).map(([key, value]) => [Number(key), value]);
}

function getNumericRecordValue<Value>(record: Record<number, Value> | Record<string, Value>, key: number): Value {
  return (record as Record<number, Value>)[key];
}

function getOptionalNumericRecordValue<Value>(
  record: Partial<Record<number, Value>> | Record<string, Value>,
  key: number,
): Value | undefined {
  return (record as Record<number, Value | undefined>)[key];
}

function withSigner<Call extends object>(
  account: NativeConfigContext["account"],
  call: Call,
): Call & { signer: NativeSigner } {
  return {
    signer: account as unknown as NativeSigner,
    ...call,
  };
}

function getSetupAddresses(config: NativeConfig) {
  const addresses = config.setup?.addresses;
  if (!addresses) {
    throw new Error("Configuration is missing setup.addresses");
  }
  return addresses;
}

function scaleAmount(amount: number, precision: number): number {
  return amount * precision;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function resolveSeasonTiming(config: NativeConfig) {
  const currentTime = nowSeconds();
  const startMainAt =
    config.season.startMainAt && config.season.startMainAt > 0
      ? config.season.startMainAt
      : currentTime + config.season.startMainAfterSeconds;
  const startSettlingAt =
    config.season.startSettlingAt && config.season.startSettlingAt > 0
      ? config.season.startSettlingAt
      : currentTime + config.season.startSettlingAfterSeconds;

  return { startMainAt, startSettlingAt };
}

function resolveBlitzRegistrationWindow(config: NativeConfig) {
  const registrationPeriodSeconds = config.blitz.registration.registration_period_seconds;
  let registrationStartAt = nowSeconds() + config.blitz.registration.registration_delay_seconds;
  let registrationEndAt = registrationStartAt + registrationPeriodSeconds;

  // When a launch pins startMainAt, registration must close immediately before it.
  if (config.season.startMainAt && config.season.startMainAt > 0) {
    registrationEndAt = config.season.startMainAt - 1;
    registrationStartAt = registrationEndAt - registrationPeriodSeconds;
  }

  return { registrationStartAt, registrationEndAt };
}

function getBlitzRegistrationWindow(config: NativeConfig): BlitzRegistrationWindow {
  const internalConfig = getInternalConfig(config);
  if (!internalConfig[BLITZ_REGISTRATION_WINDOW]) {
    internalConfig[BLITZ_REGISTRATION_WINDOW] = resolveBlitzRegistrationWindow(config);
  }
  return internalConfig[BLITZ_REGISTRATION_WINDOW]!;
}

function buildBlitzEntryTokenDeployCalldata(provider: NativeConfigProvider): string[] {
  // This mirrors the existing collectible deployment payload. Keeping it isolated
  // makes the dependency obvious until the factory path has a typed constructor helper.
  return [
    "0x0",
    "0x5265616c6d733a204c6f6f74204368657374",
    "0x12",
    "0x0",
    "0x524c43",
    "0x3",
    "0x0",
    "0x0",
    "0x0",
    "0x0",
    "0x4c6f6f7420436865737420666f72205265616c6d73",
    "0x15",
    "0x992acf50dba66f87d8cafffbbc3cdbbec5f8f514b5014f6d4d75e6b8789153",
    getContractByName(provider.manifest, `${NAMESPACE}-blitz_realm_systems`),
    "0x992acf50dba66f87d8cafffbbc3cdbbec5f8f514b5014f6d4d75e6b8789153",
    getContractByName(provider.manifest, `${NAMESPACE}-config_systems`),
    getContractByName(provider.manifest, `${NAMESPACE}-config_systems`),
    "0x992acf50dba66f87d8cafffbbc3cdbbec5f8f514b5014f6d4d75e6b8789153",
    "0x1f4",
  ];
}

export const setStartingResourcesConfig: NativeStep = async ({ account, provider, config }) => {
  const precision = config.resources.resourcePrecision;
  const realmStartingResources = Object.values(config.startingResources).map((resource) => ({
    resource: resource.resource,
    amount: scaleAmount(resource.amount, precision),
  }));
  const villageStartingResources = Object.values(config.villageStartingResources).map((resource) => ({
    resource: resource.resource,
    amount: scaleAmount(resource.amount, precision),
  }));

  await provider.set_starting_resources_config(
    withSigner(account, {
      realmStartingResources,
      villageStartingResources,
    }),
  );
};

export const setWorldAdminConfig: NativeStep = async ({ account, provider }) => {
  await provider.set_world_config(
    withSigner(account, {
      admin_address: account.address,
    }),
  );
};

export const setMercenariesNameConfig: NativeStep = async ({ account, provider }) => {
  await provider.set_mercenaries_name_config(
    withSigner(account, {
      name: MERCENARIES_NAME_FELT,
    }),
  );
};

export const setWorldConfig: NativeStep = async (context) => {
  await setWorldAdminConfig(context);
  await setMercenariesNameConfig(context);
};

function buildResourceFactoryCalls(config: NativeConfig) {
  const precision = config.resources.resourcePrecision;
  const complexInputsByResource = scaleResourceInputs(config.resources.productionByComplexRecipe, precision);
  const complexOutputsByResource = scaleResourceOutputs(config.resources.productionByComplexRecipeOutputs, precision);
  const simpleInputsByResource = scaleResourceInputs(config.resources.productionBySimpleRecipe, precision);
  const simpleOutputsByResource = scaleResourceOutputs(config.resources.productionBySimpleRecipeOutputs, precision);
  const laborOutputsByResource = scaleResourceOutputs(config.resources.laborOutputPerResource, precision);

  return numericEntries(complexInputsByResource).map(([resourceType, complexInputResourcesList]) => ({
    resource_type: resourceType,
    realm_output_per_second: getNumericRecordValue(complexOutputsByResource, resourceType),
    village_output_per_second: getNumericRecordValue(complexOutputsByResource, resourceType) / 2,
    labor_output_per_resource: getNumericRecordValue(laborOutputsByResource, resourceType),
    resource_output_per_simple_input: getNumericRecordValue(simpleOutputsByResource, resourceType),
    simple_input_resources_list: getNumericRecordValue(simpleInputsByResource, resourceType),
    resource_output_per_complex_input: getNumericRecordValue(complexOutputsByResource, resourceType),
    complex_input_resources_list: complexInputResourcesList,
  }));
}

export const setResourceFactoryConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_resource_factory_config(
    withSigner(account, {
      calls: buildResourceFactoryCalls(config),
    }),
  );
};

function getScaledBuildingInputs(config: NativeConfig) {
  const precision = config.resources.resourcePrecision;
  return {
    scaledComplexBuildingCosts: scaleResourceInputs(config.buildings.complexBuildingCosts, precision),
    scaledSimpleBuildingCosts: scaleResourceInputs(config.buildings.simpleBuildingCost, precision),
  };
}

export const setBaseBuildingConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_building_config(
    withSigner(account, {
      base_population: config.populationCapacity.basePopulation,
      base_cost_percent_increase: config.buildings.buildingFixedCostScalePercent,
    }),
  );
};

function buildBuildingCategoryCalls(config: NativeConfig) {
  const { scaledComplexBuildingCosts, scaledSimpleBuildingCosts } = getScaledBuildingInputs(config);

  return numericEntries(scaledComplexBuildingCosts).map(([buildingCategory, complexBuildingCost]) => ({
    building_category: buildingCategory,
    complex_building_cost: complexBuildingCost,
    simple_building_cost: getNumericRecordValue(scaledSimpleBuildingCosts, buildingCategory),
    population_cost: getOptionalNumericRecordValue(config.buildings.buildingPopulation, buildingCategory) ?? 0,
    capacity_grant: getOptionalNumericRecordValue(config.buildings.buildingCapacity, buildingCategory) ?? 0,
  }));
}

export const setBuildingCategoryConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_building_category_config(
    withSigner(account, {
      calls: buildBuildingCategoryCalls(config),
    }),
  );
};

export const setBuildingConfig: NativeStep = async (context) => {
  await setBaseBuildingConfig(context);
  await setBuildingCategoryConfig(context);
};

function buildRealmUpgradeCalls(config: NativeConfig) {
  const scaledRealmUpgradeCosts = scaleResourceInputs(config.realmUpgradeCosts, config.resources.resourcePrecision);

  return numericEntries(scaledRealmUpgradeCosts)
    .filter(([, costs]) => costs.length > 0)
    .map(([level, costOfLevel]) => ({
      level,
      cost_of_level: costOfLevel.map((cost) => ({
        ...cost,
        amount: cost.amount,
      })),
    }));
}

export const setRealmUpgradeConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_structure_level_config(
    withSigner(account, {
      calls: buildRealmUpgradeCalls(config),
    }),
  );
};

export const setStructureMaxLevelConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_structure_max_level_config(
    withSigner(account, {
      realm_max_level: config.realmMaxLevel - 1,
      village_max_level: config.villageMaxLevel - 1,
    }),
  );
};

function buildResourceWeightCalls(config: NativeConfig) {
  return numericEntries(config.resources.resourceWeightsGrams).map(([entityType, weightNanogram]) => ({
    entity_type: entityType,
    weight_nanogram: weightNanogram,
  }));
}

export const setWeightConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_resource_weight_config(
    withSigner(account, {
      calls: buildResourceWeightCalls(config),
    }),
  );
};

export const setBattleConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_battle_config(
    withSigner(account, {
      regular_immunity_ticks: config.battle.regularImmunityTicks,
      village_immunity_ticks: config.battle.villageImmunityTicks,
      village_raid_immunity_ticks: config.battle.villageRaidImmunityTicks,
    }),
  );
};

function buildTroopDamageConfig(config: NativeConfig) {
  return {
    t1_damage_value: config.troop.damage.t1DamageValue,
    t2_damage_multiplier: config.troop.damage.t2DamageMultiplier,
    t3_damage_multiplier: config.troop.damage.t3DamageMultiplier,
    damage_raid_percent_num: config.troop.damage.damageRaidPercentNum,
    damage_biome_bonus_num: config.troop.damage.damageBiomeBonusNum,
    damage_scaling_factor: config.troop.damage.damageScalingFactor,
    damage_beta_small: config.troop.damage.damageBetaSmall,
    damage_beta_large: config.troop.damage.damageBetaLarge,
    damage_c0: config.troop.damage.damageC0,
    damage_delta: config.troop.damage.damageDelta,
  };
}

function buildTroopStaminaConfig(config: NativeConfig) {
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
    stamina_explore_wheat_cost: scaleAmount(config.troop.stamina.staminaExploreWheatCost, precision),
    stamina_explore_fish_cost: scaleAmount(config.troop.stamina.staminaExploreFishCost, precision),
    stamina_explore_stamina_cost: config.troop.stamina.staminaExploreStaminaCost,
    stamina_travel_wheat_cost: scaleAmount(config.troop.stamina.staminaTravelWheatCost, precision),
    stamina_travel_fish_cost: scaleAmount(config.troop.stamina.staminaTravelFishCost, precision),
    stamina_travel_stamina_cost: config.troop.stamina.staminaTravelStaminaCost,
  };
}

function buildTroopLimitConfig(config: NativeConfig) {
  return {
    guard_resurrection_delay: config.troop.limit.guardResurrectionDelay,
    mercenaries_troop_lower_bound: config.troop.limit.mercenariesTroopLowerBound,
    mercenaries_troop_upper_bound: config.troop.limit.mercenariesTroopUpperBound,
    agent_troop_lower_bound: config.troop.limit.agentTroopLowerBound,
    agent_troop_upper_bound: config.troop.limit.agentTroopUpperBound,
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

function buildTroopConfigPayload(config: NativeConfig) {
  return {
    damage_config: buildTroopDamageConfig(config),
    stamina_config: buildTroopStaminaConfig(config),
    limit_config: buildTroopLimitConfig(config),
  };
}

export const setTroopConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_troop_config(withSigner(account, buildTroopConfigPayload(config)));
};

export const setBankConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_bank_config(
    withSigner(account, {
      owner_fee_num: config.banks.ownerFeesNumerator,
      owner_fee_denom: config.banks.ownerFeesDenominator,
      lp_fee_num: config.banks.lpFeesNumerator,
      lp_fee_denom: config.banks.lpFeesDenominator,
    }),
  );
};

export const setTickConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_tick_config(
    withSigner(account, {
      tick_interval_in_seconds: config.tick.armiesTickIntervalInSeconds,
      delivery_tick_interval_in_seconds: config.tick.deliveryTickIntervalInSeconds,
      bitcoin_phase_in_seconds: config.tick.bitcoinPhaseInSeconds,
    }),
  );
};

export const setMapConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_map_config(
    withSigner(account, {
      reward_amount: config.exploration.reward,
      shards_mines_win_probability: config.exploration.shardsMinesWinProbability,
      shards_mines_fail_probability: config.exploration.shardsMinesFailProbability,
      agent_find_probability: config.exploration.agentFindProbability,
      agent_find_fail_probability: config.exploration.agentFindFailProbability,
      camp_find_probability: config.exploration.campFindProbability,
      camp_find_fail_probability: config.exploration.campFindFailProbability,
      holysite_find_probability: config.exploration.holysiteFindProbability,
      bitcoin_mine_win_probability: config.exploration.bitcoinMineWinProbability,
      bitcoin_mine_fail_probability: config.exploration.bitcoinMineFailProbability,
      holysite_find_fail_probability: config.exploration.holysiteFindFailProbability,
      hyps_win_prob: config.exploration.hyperstructureWinProbAtCenter,
      hyps_fail_prob: config.exploration.hyperstructureFailProbAtCenter,
      hyps_fail_prob_increase_p_hex: config.exploration.hyperstructureFailProbIncreasePerHexDistance,
      hyps_fail_prob_increase_p_fnd: config.exploration.hyperstructureFailProbIncreasePerHyperstructureFound,
      relic_discovery_interval_sec: config.exploration.relicDiscoveryIntervalSeconds,
      relic_hex_dist_from_center: config.exploration.relicHexDistanceFromCenter,
      relic_chest_relics_per_chest: config.exploration.relicChestRelicsPerChest,
    }),
  );
};

export const setQuestConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_quest_config(
    withSigner(account, {
      quest_find_probability: config.exploration.questFindProbability,
      quest_find_fail_probability: config.exploration.questFindFailProbability,
    }),
  );
};

export const setupGlobals: NativeStep = async (context) => {
  await setBankConfig(context);
  await setTickConfig(context);
  await setMapConfig(context);
  await setQuestConfig(context);
};

export const setAgentConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_agent_config(
    withSigner(account, {
      agent_controller: config.agent.controller_address,
      max_lifetime_count: config.agent.max_lifetime_count,
      max_current_count: config.agent.max_current_count,
      min_spawn_lords_amount: config.agent.min_spawn_lords_amount,
      max_spawn_lords_amount: config.agent.max_spawn_lords_amount,
    }),
  );
};

export const setVillageControllersConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_village_token_config(
    withSigner(account, {
      village_pass_nft_address: config.village.village_pass_nft_address,
      village_mint_initial_recipient: config.village.village_mint_initial_recipient,
    }),
  );
};

function buildCapacityConfigPayload(config: NativeConfig) {
  return {
    realm_capacity: config.carryCapacityGram[CapacityConfig.RealmStructure],
    village_capacity: config.carryCapacityGram[CapacityConfig.VillageStructure],
    hyperstructure_capacity: config.carryCapacityGram[CapacityConfig.HyperstructureStructure],
    fragment_mine_capacity: config.carryCapacityGram[CapacityConfig.FragmentMineStructure],
    bank_structure_capacity: config.carryCapacityGram[CapacityConfig.BankStructure],
    holysite_capacity: config.carryCapacityGram[CapacityConfig.HolySiteStructure],
    camp_capacity: config.carryCapacityGram[CapacityConfig.CampStructure],
    bitcoin_mine_capacity: config.carryCapacityGram[CapacityConfig.BitcoinMineStructure],
    troop_capacity: config.carryCapacityGram[CapacityConfig.Army],
    donkey_capacity: config.carryCapacityGram[CapacityConfig.Donkey],
    storehouse_boost_capacity: config.carryCapacityGram[CapacityConfig.Storehouse],
  };
}

export const setCapacityConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_capacity_config(withSigner(account, buildCapacityConfigPayload(config)));
};

export const setTradeConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_trade_config(
    withSigner(account, {
      max_count: config.trade.maxCount,
    }),
  );
};

function buildBlitzSeasonConfigPayload(config: NativeConfig) {
  const addresses = getSetupAddresses(config);
  const { registrationStartAt, registrationEndAt } = getBlitzRegistrationWindow(config);

  return {
    dev_mode_on: config.dev.mode.on,
    season_pass_address: "0x0",
    realms_address: "0x0",
    lords_address: addresses.lords,
    start_settling_at: registrationStartAt,
    start_main_at: registrationEndAt,
    end_at: registrationEndAt + config.season.durationSeconds,
    bridge_close_end_grace_seconds: 0,
    point_registration_grace_seconds: config.season.pointRegistrationCloseAfterEndSeconds,
  };
}

function buildStandardSeasonConfigPayload(config: NativeConfig) {
  const addresses = getSetupAddresses(config);
  const { startMainAt, startSettlingAt } = resolveSeasonTiming(config);

  return {
    dev_mode_on: config.dev.mode.on,
    season_pass_address: addresses.seasonPass,
    realms_address: addresses.realms,
    lords_address: addresses.lords,
    start_settling_at: startSettlingAt,
    start_main_at: startMainAt,
    end_at: 0,
    bridge_close_end_grace_seconds: config.season.bridgeCloseAfterEndSeconds,
    point_registration_grace_seconds: config.season.pointRegistrationCloseAfterEndSeconds,
  };
}

function buildSeasonConfigPayload(config: NativeConfig) {
  if (config.blitz.mode.on) {
    return buildBlitzSeasonConfigPayload(config);
  }

  return buildStandardSeasonConfigPayload(config);
}

export const setSeasonConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_season_config(withSigner(account, buildSeasonConfigPayload(config)));
};

function shouldConfigureVRF(config: NativeConfig): boolean {
  return (
    (config.setup?.chain === "mainnet" || config.setup?.chain === "sepolia" || config.setup?.chain === "slot") &&
    BigInt(config.vrf.vrfProviderAddress) !== 0n
  );
}

function buildVRFConfigPayload(config: NativeConfig) {
  return {
    vrf_provider_address: config.vrf.vrfProviderAddress,
  };
}

export const setVRFConfig: NativeStep = async ({ account, provider, config }) => {
  if (!shouldConfigureVRF(config)) {
    return;
  }

  await provider.set_vrf_config(withSigner(account, buildVRFConfigPayload(config)));
};

export const setResourceBridgeFeesConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_resource_bridge_fees_config(
    withSigner(account, {
      velords_fee_on_dpt_percent: config.bridge.velords_fee_on_dpt_percent,
      velords_fee_on_wtdr_percent: config.bridge.velords_fee_on_wtdr_percent,
      season_pool_fee_on_dpt_percent: config.bridge.season_pool_fee_on_dpt_percent,
      season_pool_fee_on_wtdr_percent: config.bridge.season_pool_fee_on_wtdr_percent,
      client_fee_on_dpt_percent: config.bridge.client_fee_on_dpt_percent,
      client_fee_on_wtdr_percent: config.bridge.client_fee_on_wtdr_percent,
      velords_fee_recipient: config.bridge.velords_fee_recipient,
      season_pool_fee_recipient: config.bridge.season_pool_fee_recipient,
      realm_fee_dpt_percent: config.bridge.realm_fee_dpt_percent,
      realm_fee_wtdr_percent: config.bridge.realm_fee_wtdr_percent,
    }),
  );
};

export const setSpeedConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_donkey_speed_config(
    withSigner(account, {
      sec_per_km: config.speed.donkey,
    }),
  );
};

export const setHyperstructureConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_hyperstructure_config(
    withSigner(account, {
      initialize_shards_amount: scaleAmount(
        config.hyperstructures.hyperstructureInitializationShardsCost.amount,
        config.resources.resourcePrecision,
      ),
      construction_resources: config.hyperstructures.hyperstructureConstructionCost,
    }),
  );
};

export const setSettlementConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_settlement_config(
    withSigner(account, {
      center: config.settlement.center,
      base_distance: config.settlement.base_distance,
      layers_skipped: config.settlement.layers_skipped,
      layer_max: config.settlement.layer_max,
      layer_capacity_increment: config.settlement.layer_capacity_increment,
      layer_capacity_bps: config.settlement.layer_capacity_bps,
      spires_layer_distance: config.settlement.spires_layer_distance,
      spires_max_count: config.settlement.spires_max_count,
      spires_settled_count: config.settlement.spires_settled_count,
      single_realm_mode: config.settlement.single_realm_mode,
      two_player_mode: config.settlement.two_player_mode ?? false,
    }),
  );
};

function buildFaithConfigPayload(config: NativeConfig) {
  if (!config.faith) {
    return null;
  }

  return {
    enabled: config.faith.enabled,
    wonder_base_fp_per_sec: config.faith.wonder_base_fp_per_sec,
    holy_site_fp_per_sec: config.faith.holy_site_fp_per_sec,
    realm_fp_per_sec: config.faith.realm_fp_per_sec,
    village_fp_per_sec: config.faith.village_fp_per_sec,
    owner_share_percent: config.faith.owner_share_percent * 100,
    reward_token: config.faith.reward_token,
  };
}

export const setFaithConfig: NativeStep = async ({ account, provider, config }) => {
  const payload = buildFaithConfigPayload(config);
  if (!payload) {
    return;
  }

  await provider.set_faith_config(withSigner(account, payload));
};

export const setGameModeConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_game_mode_config(
    withSigner(account, {
      blitz_mode_on: config.blitz.mode.on,
    }),
  );
};

export const setFactoryAddress: NativeStep = async ({ account, provider, config }) => {
  const factoryAddress = getInternalConfig(config).factory_address;
  if (!factoryAddress) {
    return;
  }

  await provider.set_factory_address(
    withSigner(account, {
      factory_address: factoryAddress,
    }),
  );
};

function buildMMRConfigPayload(config: NativeConfig) {
  // MMR exists in the live JSON configuration but is not represented in the generated type.
  const mmrConfig = getInternalConfig(config).mmr;
  if (!mmrConfig) {
    return null;
  }

  return {
    enabled: mmrConfig.enabled ?? false,
    mmr_token_address: mmrConfig.mmr_token_address ?? "0x0",
    distribution_mean: mmrConfig.distribution_mean ?? 1500,
    spread_factor: mmrConfig.spread_factor ?? 450,
    max_delta: mmrConfig.max_delta ?? 45,
    k_factor: mmrConfig.k_factor ?? 50,
    lobby_split_weight_scaled: mmrConfig.lobby_split_weight_scaled ?? 2500,
    mean_regression_scaled: mmrConfig.mean_regression_scaled ?? 150,
    min_players: mmrConfig.min_players ?? 6,
  };
}

export const setMMRConfig: NativeStep = async ({ account, provider, config }) => {
  const payload = buildMMRConfigPayload(config);
  if (!payload) {
    return;
  }

  await provider.set_mmr_config(withSigner(account, payload));
};

export const setVictoryPointsConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_victory_points_config(
    withSigner(account, {
      points_for_win: config.victoryPoints.pointsForWin,
      hyperstructure_points_per_second: config.victoryPoints.hyperstructurePointsPerCycle,
      points_for_hyperstructure_claim_against_bandits: config.victoryPoints.pointsForHyperstructureClaimAgainstBandits,
      points_for_non_hyperstructure_claim_against_bandits:
        config.victoryPoints.pointsForNonHyperstructureClaimAgainstBandits,
      points_for_tile_exploration: config.victoryPoints.pointsForTileExploration,
      points_for_relic_open: config.victoryPoints.pointsForRelicDiscovery,
    }),
  );
};

function buildDiscoverableVillageSpawnResourcesPayload(config: NativeConfig) {
  return {
    resources: config.discoverableVillageStartingResources.map((resource) => ({
      resource: resource.resource,
      min_amount: resource.min_amount * RESOURCE_PRECISION,
      max_amount: resource.max_amount * RESOURCE_PRECISION,
    })),
  };
}

export const setDiscoverableVillageSpawnResourcesConfig: NativeStep = async ({ account, provider, config }) => {
  await provider.set_discoverable_village_starting_resources_config(
    withSigner(account, buildDiscoverableVillageSpawnResourcesPayload(config)),
  );
};

const BLITZ_EXPLORATION_REWARD_PROFILE_IDS = {
  "official-60": 1,
  "official-90": 2,
} as const;

function resolveBlitzExplorationRewardProfileId(config: NativeConfig) {
  return BLITZ_EXPLORATION_REWARD_PROFILE_IDS[config.blitz.exploration.rewardProfileId];
}

function buildBlitzExplorationConfigPayload(config: NativeConfig) {
  if (!config.blitz.mode.on) {
    return null;
  }

  return {
    reward_profile_id: resolveBlitzExplorationRewardProfileId(config),
  };
}

export const setBlitzExplorationConfig: NativeStep = async ({ account, provider, config }) => {
  const payload = buildBlitzExplorationConfigPayload(config);
  if (!payload) {
    return;
  }

  await provider.set_blitz_exploration_config(withSigner(account, payload));
};

function buildBlitzRegistrationConfigPayload(provider: NativeConfigProvider, config: NativeConfig) {
  if (!config.blitz.mode.on) {
    return null;
  }

  const { registrationStartAt } = getBlitzRegistrationWindow(config);

  return {
    fee_token: config.blitz.registration.fee_token,
    fee_recipient: config.blitz.registration.fee_recipient,
    fee_amount: config.blitz.registration.fee_amount,
    registration_count_max: config.blitz.registration.registration_count_max,
    registration_start_at: registrationStartAt,
    entry_token_class_hash: config.blitz.registration.entry_token_class_hash,
    entry_token_ipfs_cid: byteArray.byteArrayFromString(config.blitz.registration.entry_token_ipfs_cid),
    entry_token_deploy_calldata: buildBlitzEntryTokenDeployCalldata(provider),
    collectibles_cosmetics_max: config.blitz.registration.collectible_cosmetics_max_items,
    collectibles_cosmetics_address: config.blitz.registration.collectible_cosmetics_address,
    collectibles_timelock_address: config.blitz.registration.collectible_timelock_address,
    collectibles_lootchest_address: config.blitz.registration.collectibles_lootchest_address,
    collectibles_elitenft_address: config.blitz.registration.collectibles_elitenft_address,
  };
}

export const setBlitzRegistrationParametersConfig: NativeStep = async ({ account, provider, config }) => {
  const payload = buildBlitzRegistrationConfigPayload(provider, config);
  if (!payload) {
    return;
  }

  await provider.set_blitz_registration_config(withSigner(account, payload));
};

export const setBlitzSeasonConfig: NativeStep = async ({ account, provider, config }) => {
  if (!config.blitz.mode.on) {
    return;
  }

  await setSeasonConfig({ account, provider, config });
};

export const setBlitzRegistrationConfig: NativeStep = async (context) => {
  await setBlitzRegistrationParametersConfig(context);
  await setBlitzSeasonConfig(context);
};

export const NATIVE_FACTORY_WORLD_CONFIG_IMPLEMENTATIONS = {
  setStartingResourcesConfig,
  setWorldAdminConfig,
  setMercenariesNameConfig,
  setWorldConfig,
  setResourceFactoryConfig,
  setBaseBuildingConfig,
  setBuildingCategoryConfig,
  setBuildingConfig,
  setRealmUpgradeConfig,
  setStructureMaxLevelConfig,
  setWeightConfig,
  setBattleConfig,
  setTroopConfig,
  setBankConfig,
  setTickConfig,
  setMapConfig,
  setQuestConfig,
  setupGlobals,
  setAgentConfig,
  setVillageControllersConfig,
  setCapacityConfig,
  setTradeConfig,
  setSeasonConfig,
  setVRFConfig,
  setResourceBridgeFeesConfig,
  setSpeedConfig,
  setHyperstructureConfig,
  setSettlementConfig,
  setFaithConfig,
  setGameModeConfig,
  setFactoryAddress,
  setMMRConfig,
  setVictoryPointsConfig,
  setDiscoverableVillageSpawnResourcesConfig,
  setBlitzExplorationConfig,
  setBlitzRegistrationParametersConfig,
  setBlitzSeasonConfig,
  setBlitzRegistrationConfig,
} as const;

export type { NativeConfigProvider };
