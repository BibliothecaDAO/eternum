import {
  CapacityConfig,
  MERCENARIES_NAME_FELT,
  RESOURCE_PRECISION,
  scaleResourceInputs,
  scaleResourceOutputs,
  type Config,
} from "@bibliothecadao/types";
import { hash, shortString } from "starknet";
import { BLITZ_REGISTRATION_COUNT_CAP } from "../constants";

type ConfigRecord<Value> = Record<number, Value> | Record<string, Value>;
type ResourceAmount = { resource: number; amount: number };

interface ResourceListReference {
  id: number;
  count: number;
}

interface PresetSideTables {
  weights: unknown[];
  resource_factories: unknown[];
  building_categories: unknown[];
  structure_levels: unknown[];
  hyperstructure_construction: unknown[];
  resource_lists: unknown[];
  resource_min_max_lists: unknown[];
}

export interface PresetRegistrationPayload {
  presetConfig: Record<string, unknown>;
  gameConfig: Record<string, unknown>;
  sideTables: PresetSideTables;
}

export interface ChainConfigOverrides {
  adminAddress: string;
  ledgerOperatorAddress: string;
  playerRegistryAddress: string;
  vrfProviderAddress?: string;
  agentControllerAddress?: string;
  cosmeticsAddress?: string;
  timelockAddress?: string;
  lootChestAddress?: string;
  eliteNftAddress?: string;
}

export interface CreateGamePayloadInput {
  gameName: string;
  presetId: number;
  seriesName?: string;
  seriesGameNumber?: number;
  startMainAt: number;
  durationSeconds: number;
  devModeOn: boolean;
  singleRealmMode: boolean;
  twoPlayerMode: boolean;
  useMapOverride: boolean;
}

const BLITZ_PROFILE_IDS = {
  "official-60": 1,
  "official-90": 2,
} as const;

const DISABLED_CONTRACT_ADDRESS = "0x0";

function resolveFeatureAddress(name: string, enabled: boolean, address: string | undefined): string {
  if (!enabled) return DISABLED_CONTRACT_ADDRESS;
  if (address === undefined) {
    throw new Error(`${name} address must be explicit when the feature is enabled`);
  }
  return address;
}

function numericEntries<Value>(record: ConfigRecord<Value>): Array<[number, Value]> {
  return Object.entries(record)
    .map(([key, value]) => [Number(key), value] as [number, Value])
    .sort(([left], [right]) => left - right);
}

function recordValue<Value>(record: ConfigRecord<Value>, key: number): Value {
  return (record as Record<number, Value>)[key];
}

function optionalRecordValue<Value>(record: ConfigRecord<Value>, key: number): Value | undefined {
  return (record as Record<number, Value | undefined>)[key];
}

function scaleAmount(amount: number, precision: number): number {
  return amount * precision;
}

function createResourceListAllocator(resourceLists: unknown[]) {
  let nextListId = 1;

  return (resources: ResourceAmount[]): ResourceListReference => {
    const id = nextListId;
    nextListId += 1;
    resources.forEach(({ resource, amount }, index) => {
      resourceLists.push({ preset_id: 0, entity_id: id, index, resource_type: resource, amount });
    });
    return { id, count: resources.length };
  };
}

function buildMapConfig(config: Config) {
  return {
    reward_resource_amount: config.exploration.reward,
    shards_mines_win_probability: config.exploration.shardsMinesWinProbability,
    shards_mines_fail_probability: config.exploration.shardsMinesFailProbability,
    agent_discovery_prob: config.exploration.agentFindProbability,
    agent_discovery_fail_prob: config.exploration.agentFindFailProbability,
    camp_win_probability: config.exploration.campFindProbability,
    camp_fail_probability: config.exploration.campFindFailProbability,
    holysite_win_probability: config.exploration.holysiteFindProbability,
    holysite_fail_probability: config.exploration.holysiteFindFailProbability,
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

function buildTroopDamageConfig(config: Config) {
  return {
    damage_raid_percent_num: config.troop.damage.damageRaidPercentNum,
    damage_biome_bonus_num: config.troop.damage.damageBiomeBonusNum,
    damage_beta_small: config.troop.damage.damageBetaSmall,
    damage_beta_large: config.troop.damage.damageBetaLarge,
    damage_scaling_factor: config.troop.damage.damageScalingFactor,
    damage_c0: config.troop.damage.damageC0,
    damage_delta: config.troop.damage.damageDelta,
    t1_damage_value: config.troop.damage.t1DamageValue,
    t2_damage_multiplier: config.troop.damage.t2DamageMultiplier,
    t3_damage_multiplier: config.troop.damage.t3DamageMultiplier,
  };
}

function buildTroopStaminaConfig(config: Config) {
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

function buildTroopLimitConfig(config: Config) {
  return {
    guard_resurrection_delay: config.troop.limit.guardResurrectionDelay,
    mercenaries_troop_lower_bound: config.troop.limit.mercenariesTroopLowerBound,
    mercenaries_troop_upper_bound: config.troop.limit.mercenariesTroopUpperBound,
    agents_troop_lower_bound: config.troop.limit.agentTroopLowerBound,
    agents_troop_upper_bound: config.troop.limit.agentTroopUpperBound,
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

function buildCapacityConfig(config: Config) {
  return {
    structure_capacity: 0,
    troop_capacity: config.carryCapacityGram[CapacityConfig.Army],
    donkey_capacity: config.carryCapacityGram[CapacityConfig.Donkey],
    storehouse_boost_capacity: config.carryCapacityGram[CapacityConfig.Storehouse],
  };
}

function buildStructureCapacityConfig(config: Config) {
  return {
    realm_capacity: config.carryCapacityGram[CapacityConfig.RealmStructure],
    village_capacity: config.carryCapacityGram[CapacityConfig.VillageStructure],
    hyperstructure_capacity: config.carryCapacityGram[CapacityConfig.HyperstructureStructure],
    fragment_mine_capacity: config.carryCapacityGram[CapacityConfig.FragmentMineStructure],
    bank_structure_capacity: config.carryCapacityGram[CapacityConfig.BankStructure],
    holysite_capacity: config.carryCapacityGram[CapacityConfig.HolySiteStructure],
    camp_capacity: config.carryCapacityGram[CapacityConfig.CampStructure],
    bitcoin_mine_capacity: config.carryCapacityGram[CapacityConfig.BitcoinMineStructure],
  };
}

function buildBiomeClimateConfig(config: Config) {
  return {
    elevation_scale_bps: config.biomeClimate.elevationScaleBps,
    moisture_scale_bps: config.biomeClimate.moistureScaleBps,
    elevation_bias_bps: config.biomeClimate.elevationBiasBps,
    moisture_bias_bps: config.biomeClimate.moistureBiasBps,
    elevation_seed: config.biomeClimate.elevationSeed,
    moisture_seed: config.biomeClimate.moistureSeed,
  };
}

function buildSettlementConfig(config: Config) {
  return {
    center: config.settlement.center,
    base_distance: config.settlement.base_distance,
    layers_skipped: config.settlement.layers_skipped,
    layer_max: config.settlement.layer_max,
    layer_capacity_increment: config.settlement.layer_capacity_increment,
    layer_capacity_bps: config.settlement.layer_capacity_bps,
    spires_layer_distance: config.settlement.spires_layer_distance,
    spires_max_count: config.settlement.spires_max_count,
    spires_settled_count: config.settlement.spires_settled_count,
  };
}

function resolveBlitzProfileId(config: Config): number {
  const profileId = BLITZ_PROFILE_IDS[config.blitz.exploration.rewardProfileId];
  if (!profileId) {
    throw new Error(`Unsupported Blitz reward profile "${config.blitz.exploration.rewardProfileId}"`);
  }
  return profileId;
}

function buildBlitzSettlementConfig(config: Config) {
  return {
    base_distance: resolveBlitzProfileId(config) === 1 ? 6 : 8,
    side: 0,
    step: 1,
    point: 1,
    open_settlement_count: 0,
    single_realm_mode: false,
    two_player_mode: false,
  };
}

function addStartingResourceLists(config: Config, addResourceList: (rows: ResourceAmount[]) => ResourceListReference) {
  const precision = config.resources.resourcePrecision;
  const realm = addResourceList(
    config.startingResources.map(({ resource, amount }) => ({ resource, amount: scaleAmount(amount, precision) })),
  );
  const village = addResourceList(
    config.villageStartingResources.map(({ resource, amount }) => ({
      resource,
      amount: scaleAmount(amount, precision),
    })),
  );
  return { realm, village };
}

function addVillageFoundResourceList(config: Config, resourceMinMaxLists: unknown[]): ResourceListReference {
  const entityId = 1;
  config.campStartingResources.forEach((resource, index) => {
    resourceMinMaxLists.push({
      preset_id: 0,
      entity_id: entityId,
      index,
      resource_type: resource.resource,
      min_amount: scaleAmount(resource.min_amount, RESOURCE_PRECISION),
      max_amount: scaleAmount(resource.max_amount, RESOURCE_PRECISION),
    });
  });
  return { id: entityId, count: config.campStartingResources.length };
}

function addResourceFactories(
  config: Config,
  addResourceList: (rows: ResourceAmount[]) => ResourceListReference,
): unknown[] {
  const precision = config.resources.resourcePrecision;
  const complexInputs = scaleResourceInputs(config.resources.productionByComplexRecipe, precision);
  const complexOutputs = scaleResourceOutputs(config.resources.productionByComplexRecipeOutputs, precision);
  const simpleInputs = scaleResourceInputs(config.resources.productionBySimpleRecipe, precision);
  const simpleOutputs = scaleResourceOutputs(config.resources.productionBySimpleRecipeOutputs, precision);
  const laborOutputs = scaleResourceOutputs(config.resources.laborOutputPerResource, precision);

  return numericEntries(complexInputs).map(([resourceType, complexInput]) => {
    const simpleInput = recordValue(simpleInputs, resourceType);
    const simpleList = addResourceList(simpleInput);
    const complexList = addResourceList(complexInput);
    const complexOutput = recordValue(complexOutputs, resourceType);
    return {
      preset_id: 0,
      resource_type: resourceType,
      realm_output_per_second: complexOutput,
      village_output_per_second: complexOutput / 2,
      labor_output_per_resource: recordValue(laborOutputs, resourceType),
      output_per_simple_input: optionalRecordValue(simpleOutputs, resourceType) ?? 0,
      output_per_complex_input: complexOutput,
      simple_input_list_id: simpleList.id,
      complex_input_list_id: complexList.id,
      simple_input_list_count: simpleList.count,
      complex_input_list_count: complexList.count,
    };
  });
}

function addBuildingCategories(
  config: Config,
  addResourceList: (rows: ResourceAmount[]) => ResourceListReference,
): unknown[] {
  const precision = config.resources.resourcePrecision;
  const complexCosts = scaleResourceInputs(config.buildings.complexBuildingCosts, precision);
  const simpleCosts = scaleResourceInputs(config.buildings.simpleBuildingCost, precision);

  return numericEntries(complexCosts).map(([category, complexCost]) => {
    const complexList = addResourceList(complexCost);
    const simpleList = addResourceList(recordValue(simpleCosts, category));
    return {
      preset_id: 0,
      category,
      complex_erection_cost_id: complexList.id,
      complex_erection_cost_count: complexList.count,
      simple_erection_cost_id: simpleList.id,
      simple_erection_cost_count: simpleList.count,
      population_cost: optionalRecordValue(config.buildings.buildingPopulation, category) ?? 0,
      capacity_grant: optionalRecordValue(config.buildings.buildingCapacity, category) ?? 0,
    };
  });
}

function addStructureLevels(
  config: Config,
  addResourceList: (rows: ResourceAmount[]) => ResourceListReference,
): unknown[] {
  const costs = scaleResourceInputs(config.realmUpgradeCosts, config.resources.resourcePrecision);
  return numericEntries(costs)
    .filter(([, resources]) => resources.length > 0)
    .map(([level, resources]) => {
      const list = addResourceList(resources);
      return {
        preset_id: 0,
        level,
        required_resources_id: list.id,
        required_resource_count: list.count,
      };
    });
}

function buildPresetSideTables(config: Config): {
  sideTables: PresetSideTables;
  realmStart: ResourceListReference;
  villageStart: ResourceListReference;
  villageFound: ResourceListReference;
} {
  const resourceLists: unknown[] = [];
  const resourceMinMaxLists: unknown[] = [];
  const addResourceList = createResourceListAllocator(resourceLists);
  const { realm, village } = addStartingResourceLists(config, addResourceList);
  const villageFound = addVillageFoundResourceList(config, resourceMinMaxLists);

  return {
    realmStart: realm,
    villageStart: village,
    villageFound,
    sideTables: {
      weights: numericEntries(config.resources.resourceWeightsGrams).map(([resourceType, weight]) => ({
        preset_id: 0,
        resource_type: resourceType,
        weight_gram: weight,
      })),
      resource_factories: addResourceFactories(config, addResourceList),
      building_categories: addBuildingCategories(config, addResourceList),
      structure_levels: addStructureLevels(config, addResourceList),
      hyperstructure_construction: config.hyperstructures.hyperstructureConstructionCost.map((resource) => ({
        preset_id: 0,
        resource_type: resource.resource_type,
        resource_contribution_points: resource.resource_completion_points,
        min_amount: resource.min_amount,
        max_amount: resource.max_amount,
      })),
      resource_lists: resourceLists,
      resource_min_max_lists: resourceMinMaxLists,
    },
  };
}

function buildSeasonAddressesConfig(config: Config) {
  const addresses = config.setup?.addresses;
  const enabled = !config.blitz.mode.on;
  return {
    season_pass_address: resolveFeatureAddress("season pass", enabled, addresses?.seasonPass),
    realms_address: resolveFeatureAddress("realms", enabled, addresses?.realms),
    lords_address: resolveFeatureAddress("lords", enabled, addresses?.lords),
  };
}

function buildFaithConfig(config: Config) {
  const enabled = config.faith?.enabled ?? false;
  return {
    enabled,
    wonder_base_fp_per_sec: config.faith?.wonder_base_fp_per_sec ?? 0,
    holy_site_fp_per_sec: config.faith?.holy_site_fp_per_sec ?? 0,
    realm_fp_per_sec: config.faith?.realm_fp_per_sec ?? 0,
    village_fp_per_sec: config.faith?.village_fp_per_sec ?? 0,
    owner_share_percent: (config.faith?.owner_share_percent ?? 0) * 100,
    reward_token: resolveFeatureAddress("faith reward token", enabled, config.faith?.reward_token),
  };
}

function buildBitcoinMineConfig(config: Config) {
  const enabled = !config.blitz.mode.on && config.exploration.bitcoinMineWinProbability > 0;
  return {
    enabled,
    prize_per_phase: enabled ? RESOURCE_PRECISION : 0,
    min_labor_per_contribution: enabled ? 100 * RESOURCE_PRECISION : 1,
  };
}

function buildQuestGames(config: Config) {
  return config.questGames.map((game) => ({ address: game.address, levels: game.levels }));
}

export function buildPresetRegistration(config: Config, presetId: number): PresetRegistrationPayload {
  if (!Number.isInteger(presetId) || presetId <= 0 || presetId > 0xffff_ffff) {
    throw new Error("presetId must be an integer between 1 and 4294967295");
  }

  const { sideTables, realmStart, villageStart, villageFound } = buildPresetSideTables(config);
  return {
    presetConfig: {
      preset_id: presetId,
      hyperstructure_config: {
        initialize_shards_amount: scaleAmount(
          config.hyperstructures.hyperstructureInitializationShardsCost.amount,
          config.resources.resourcePrecision,
        ),
      },
      hyperstructure_cost_config: {
        construction_resources_ids: config.hyperstructures.hyperstructureConstructionCost.map(
          (resource) => resource.resource_type,
        ),
      },
      speed_config: {
        donkey_sec_per_km: config.speed.donkey_for_resources,
        donkey_sec_per_km_troops: config.speed.donkey_for_troops,
      },
      map_config: buildMapConfig(config),
      tick_config: {
        armies_tick_in_seconds: config.tick.armiesTickIntervalInSeconds,
        delivery_tick_in_seconds: config.tick.deliveryTickIntervalInSeconds,
        bitcoin_phase_in_seconds: config.tick.bitcoinPhaseInSeconds,
      },
      structure_max_level_config: {
        realm_max: config.realmMaxLevel - 1,
        village_max: config.villageMaxLevel - 1,
      },
      building_config: {
        base_population: config.populationCapacity.basePopulation,
        base_cost_percent_increase: config.buildings.buildingFixedCostScalePercent,
      },
      troop_damage_config: buildTroopDamageConfig(config),
      troop_stamina_config: buildTroopStaminaConfig(config),
      troop_limit_config: buildTroopLimitConfig(config),
      capacity_config: buildCapacityConfig(config),
      battle_config: {
        regular_immunity_ticks: config.battle.regularImmunityTicks,
        village_immunity_ticks: config.battle.villageImmunityTicks,
        village_raid_immunity_ticks: config.battle.villageRaidImmunityTicks,
      },
      bank_config: {
        lp_fee_num: config.banks.lpFeesNumerator,
        lp_fee_denom: config.banks.lpFeesDenominator,
        owner_fee_num: config.banks.ownerFeesNumerator,
        owner_fee_denom: config.banks.ownerFeesDenominator,
      },
      trade_config: { max_count: config.trade.maxCount },
      quest_config: {
        quest_discovery_prob: config.exploration.questFindProbability,
        quest_discovery_fail_prob: config.exploration.questFindFailProbability,
      },
      faith_config: buildFaithConfig(config),
      bitcoin_mine_config: buildBitcoinMineConfig(config),
      resource_bridge_config: { deposit_paused: false, withdraw_paused: false },
      res_bridge_fee_split_config: {
        velords_fee_on_dpt_percent: config.bridge.velords_fee_on_dpt_percent,
        velords_fee_on_wtdr_percent: config.bridge.velords_fee_on_wtdr_percent,
        season_pool_fee_on_dpt_percent: config.bridge.season_pool_fee_on_dpt_percent,
        season_pool_fee_on_wtdr_percent: config.bridge.season_pool_fee_on_wtdr_percent,
        client_fee_on_dpt_percent: config.bridge.client_fee_on_dpt_percent,
        client_fee_on_wtdr_percent: config.bridge.client_fee_on_wtdr_percent,
        realm_fee_dpt_percent: config.bridge.realm_fee_dpt_percent,
        realm_fee_wtdr_percent: config.bridge.realm_fee_wtdr_percent,
        velords_fee_recipient: config.bridge.velords_fee_recipient,
        season_pool_fee_recipient: config.bridge.season_pool_fee_recipient,
      },
      village_token_config: {
        token_address: config.village.village_pass_nft_address,
        mint_recipient_address: config.village.village_mint_initial_recipient,
      },
      village_troop_config: { troop_delay_ticks: config.battle.delaySeconds },
      season_addresses_config: buildSeasonAddressesConfig(config),
      quest_games: buildQuestGames(config),
      realm_start_resources_config: {
        resources_list_id: realmStart.id,
        resources_list_count: realmStart.count,
      },
      village_start_resources_config: {
        resources_list_id: villageStart.id,
        resources_list_count: villageStart.count,
      },
      village_find_resources_config: {
        resources_mm_list_id: villageFound.id,
        resources_mm_list_count: villageFound.count,
      },
      structure_capacity_config: buildStructureCapacityConfig(config),
      victory_points_grant_config: {
        hyp_points_per_second: config.victoryPoints.hyperstructurePointsPerCycle,
        claim_hyperstructure_points: config.victoryPoints.pointsForHyperstructureClaimAgainstBandits,
        claim_otherstructure_points: config.victoryPoints.pointsForNonHyperstructureClaimAgainstBandits,
        explore_tiles_points: config.victoryPoints.pointsForTileExploration,
        relic_open_points: config.victoryPoints.pointsForRelicDiscovery,
      },
      victory_points_win_config: { points_for_win: config.victoryPoints.pointsForWin },
      blitz_exploration_config: { reward_profile_id: resolveBlitzProfileId(config) },
      artificer_config: { research_cost_for_relic: config.artificer?.research_cost_for_relic ?? 0 },
      blitz_registration_rules_config: {
        collectibles_cosmetics_max: config.blitz.registration.collectible_cosmetics_max_items,
      },
      mercenaries_name: MERCENARIES_NAME_FELT,
    },
    gameConfig: {
      preset_id: presetId,
      blitz_mode_on: config.blitz.mode.on,
      settlement_config: buildSettlementConfig(config),
      blitz_settlement_config: buildBlitzSettlementConfig(config),
      blitz_registration_config: {
        registration_count: 0,
        registration_count_max: config.blitz.registration.registration_count_max,
        registration_start_at: 0,
      },
      agent_max_lifetime_count: config.agent.max_lifetime_count,
      agent_max_current_count: config.agent.max_current_count,
      agent_min_spawn_lords_amount: config.agent.min_spawn_lords_amount,
      agent_max_spawn_lords_amount: config.agent.max_spawn_lords_amount,
    },
    sideTables,
  };
}

export function buildChainConfig(config: Config, overrides: ChainConfigOverrides): Record<string, unknown> {
  return {
    config_id: 0,
    admin_address: overrides.adminAddress,
    ledger_operator_address: overrides.ledgerOperatorAddress,
    player_registry_address: overrides.playerRegistryAddress,
    vrf_provider_address: overrides.vrfProviderAddress ?? config.vrf.vrfProviderAddress,
    agent_controller_config: { address: overrides.agentControllerAddress ?? config.agent.controller_address },
    collectibles_cosmetics_address:
      overrides.cosmeticsAddress ?? config.blitz.registration.collectible_cosmetics_address,
    collectibles_timelock_address: overrides.timelockAddress ?? config.blitz.registration.collectible_timelock_address,
    collectibles_lootchest_address:
      overrides.lootChestAddress ?? config.blitz.registration.collectibles_lootchest_address,
    collectibles_elitenft_address: overrides.eliteNftAddress ?? config.blitz.registration.collectibles_elitenft_address,
  };
}

// Settling and registration open the moment the game row lands on-chain
// (owner ruling, Aug 2026): a deployed game is a settleable game. The clamp
// keeps the contract's `registration < settling <= main` ordering assert
// green when a game is created at or after its scheduled start time.
function resolveRegistrationSchedule(startMainAt: number) {
  const startSettlingAt = Math.min(Math.floor(Date.now() / 1000), startMainAt);
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
  const seriesId = input.seriesName ? shortString.encodeShortString(input.seriesName) : "0x0";
  const seed = hash.computePoseidonHashOnElements([
    shortString.encodeShortString(input.gameName),
    input.startMainAt,
    seriesId,
    input.seriesGameNumber ?? 0,
  ]);
  return BigInt(seed) === 0n ? "0x1" : seed;
}

export function buildCreateGameParams(config: Config, input: CreateGamePayloadInput): Record<string, unknown> {
  const { registrationStartAt, startSettlingAt } = resolveRegistrationSchedule(input.startMainAt);
  const registrationCountMax = resolveRegistrationCountMax(config, input.twoPlayerMode);

  return {
    name: shortString.encodeShortString(input.gameName),
    preset_id: input.presetId,
    series_id: input.seriesName ? shortString.encodeShortString(input.seriesName) : "0x0",
    game_number_in_series: input.seriesGameNumber ?? 0,
    start_settling_at: startSettlingAt,
    start_main_at: input.startMainAt,
    duration_seconds: input.durationSeconds,
    end_grace_seconds: resolveEndGraceSeconds(config),
    registration_grace_seconds: config.season.pointRegistrationCloseAfterEndSeconds,
    dev_mode_on: input.devModeOn,
    single_realm_mode: input.singleRealmMode,
    two_player_mode: input.twoPlayerMode,
    registration_count_max: registrationCountMax,
    registration_start_at: registrationStartAt,
    biome_climate_config: buildBiomeClimateConfig(config),
    use_map_override: input.useMapOverride,
    map_override: buildMapConfig(config),
    seed: deriveGameSeed(input),
  };
}

export function summarizePresetSideTables(payload: PresetRegistrationPayload) {
  return {
    weights: payload.sideTables.weights.length,
    resourceFactories: payload.sideTables.resource_factories.length,
    buildingCategories: payload.sideTables.building_categories.length,
    structureLevels: payload.sideTables.structure_levels.length,
    hyperstructureConstruction: payload.sideTables.hyperstructure_construction.length,
    resourceLists: payload.sideTables.resource_lists.length,
    resourceMinMaxLists: payload.sideTables.resource_min_max_lists.length,
  };
}
