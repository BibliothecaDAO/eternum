import { resolveBlitzProfileId } from "../../../source/native";
import { RESOURCE_PRECISION, ResourcesIds, type Config } from "@bibliothecadao/types";
import { CairoCustomEnum, CairoOption, CairoOptionVariant } from "starknet";
import {
  buildBiomeClimateConfig,
  buildCapacityConfig,
  buildMapConfig,
  buildStructureCapacityConfig,
  buildTroopDamageConfig,
  buildTroopLimitConfig,
  buildTroopStaminaConfig,
} from "../registrar/preset";
import {
  blitzRealmResources,
  eternumExplorationRewards,
  relicRules,
  startingTroopsByBiome,
  villageResourcePool,
  withdrawalRetention,
} from "./native-preset-data";

function required<T>(values: Record<number, T> | Record<string, T>, key: number, name: string): T {
  const value = (values as Record<number, T | undefined>)[key];
  if (value === undefined) throw new Error(`Missing ${name} for ${key}`);
  return value;
}

function scaled(value: number, precision = RESOURCE_PRECISION): bigint {
  if (Number.isSafeInteger(value) && value >= 0) return BigInt(value) * BigInt(precision);
  const amount = Math.round(value * precision);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`Invalid resource amount ${value}`);
  return BigInt(amount);
}

function amounts(resources: Array<{ resource: number; amount: number }>, precision: number) {
  return resources.map(({ resource, amount }) => ({ resource_type: resource, amount: scaled(amount, precision) }));
}

function hasNoProduction(resource: number) {
  return (resource >= 39 && resource <= 56) || resource === 58;
}

function buildRules(config: Config) {
  const bitcoinEnabled = !config.blitz.mode.on && config.exploration.bitcoinMineWinProbability > 0;
  return {
    battle_config: {
      regular_immunity_ticks: config.battle.regularImmunityTicks,
      village_immunity_ticks: config.battle.villageImmunityTicks,
      village_raid_immunity_ticks: config.battle.villageRaidImmunityTicks,
    },
    map_config: buildMapConfig(config),
    biome_climate_config: buildBiomeClimateConfig(config),
    tick_config: {
      armies_tick_in_seconds: config.tick.armiesTickIntervalInSeconds,
      delivery_tick_in_seconds: config.tick.deliveryTickIntervalInSeconds,
      bitcoin_phase_in_seconds: config.tick.bitcoinPhaseInSeconds,
    },
    troop_damage_config: buildTroopDamageConfig(config),
    troop_stamina_config: buildTroopStaminaConfig(config),
    troop_limit_config: buildTroopLimitConfig(config),
    capacity_config: buildCapacityConfig(config),
    structure_capacity_config: buildStructureCapacityConfig(config),
    building_config: {
      base_population: config.populationCapacity.basePopulation,
      base_cost_percent_increase: config.buildings.buildingFixedCostScalePercent,
    },
    bitcoin_mine_config: {
      enabled: bitcoinEnabled,
      prize_per_phase: bitcoinEnabled ? scaled(config.bitcoin!.prizePerPhase) : 0n,
      min_labor_per_contribution: scaled(config.bitcoin!.minimumLabor),
      owner_cut_bps: config.bitcoin!.ownerCutBps,
    },
    victory_points_grant_config: {
      hyp_points_per_second: config.victoryPoints.hyperstructurePointsPerCycle,
      claim_hyperstructure_points: config.victoryPoints.pointsForHyperstructureClaimAgainstBandits,
      claim_otherstructure_points: config.victoryPoints.pointsForNonHyperstructureClaimAgainstBandits,
      explore_tiles_points: config.victoryPoints.pointsForTileExploration,
      relic_open_points: config.victoryPoints.pointsForRelicDiscovery,
    },
    map_center_offset: config.settlement.center,
    spire_travel_essence_cost: scaled(config.spireTravelEssenceCost),
    blitz_mode_on: config.blitz.mode.on,
    faith_enabled: config.faith!.enabled,
    speed_config: {
      donkey_sec_per_km: config.speed.donkey_for_resources,
      donkey_sec_per_km_troops: config.speed.donkey_for_troops,
    },
  };
}

function buildResources(config: Config) {
  const balances = config.resources;
  const precision = balances.resourcePrecision;
  const resources = Array.from({ length: 58 }, (_, index) => {
    const resource_type = index + 1;
    // Relics and SAT have no production recipe or carried weight in the pinned rules.
    if (hasNoProduction(resource_type)) {
      return { resource_type, unit_weight: 0, realm_rate: 0n, village_rate: 0n, labor_output_per_resource: 0n };
    }
    const output = scaled(required(balances.productionByComplexRecipeOutputs, resource_type, "output"), precision);
    return {
      resource_type,
      unit_weight: required(balances.resourceWeightsGrams, resource_type, "resource weight"),
      realm_rate: output,
      village_rate: output / 2n,
      labor_output_per_resource: scaled(
        required(balances.laborOutputPerResource, resource_type, "labor output"),
        precision,
      ),
    };
  });
  const production = resources.map(({ resource_type }) => ({
    resource_type,
    recipe: hasNoProduction(resource_type)
      ? { simple_output: 0n, complex_output: 0n, simple_inputs: [], complex_inputs: [] }
      : {
          simple_output: scaled(
            required(balances.productionBySimpleRecipeOutputs, resource_type, "simple output"),
            precision,
          ),
          complex_output: scaled(
            required(balances.productionByComplexRecipeOutputs, resource_type, "complex output"),
            precision,
          ),
          simple_inputs: amounts(
            required(balances.productionBySimpleRecipe, resource_type, "simple recipe"),
            precision,
          ),
          complex_inputs: amounts(
            required(balances.productionByComplexRecipe, resource_type, "complex recipe"),
            precision,
          ),
        },
  }));
  return { resources, production, ...buildMines(config) };
}

function buildMines(config: Config) {
  return {
    mine_kinds: Object.entries(config.mines!.kinds).map(
      ([kind, { resourceType, buildingCategory, productionRate, capMinimum, capSteps }]) => ({
        kind: Number(kind),
        config: {
          resource_type: resourceType,
          building_category: buildingCategory,
          production_rate: scaled(productionRate, config.resources.resourcePrecision),
          cap_min: scaled(capMinimum, config.resources.resourcePrecision),
          cap_steps: capSteps,
        },
      }),
    ),
    surface_mines: config.mines!.surfacePool.map((entry) => ({ ...entry })),
  };
}

function buildStructures(config: Config) {
  const precision = config.resources.resourcePrecision;
  return {
    buildings: Array.from({ length: 40 }, (_, index) => {
      const category = index + 1;
      // Storehouse and mine-only Essence have no erection recipe in the pinned preset.
      const hasNoRecipe = category === 2 || category === 39;
      return {
        category,
        rule: {
          population_cost:
            category === 39 ? 0 : required(config.buildings.buildingPopulation, category, "building population"),
          capacity_grant:
            category === 39 ? 0 : required(config.buildings.buildingCapacity, category, "building capacity"),
          simple_cost: hasNoRecipe
            ? []
            : amounts(required(config.buildings.simpleBuildingCost, category, "simple building cost"), precision),
          complex_cost: hasNoRecipe
            ? []
            : amounts(required(config.buildings.complexBuildingCosts, category, "complex building cost"), precision),
        },
      };
    }),
    camps: config.campStartingResources.map(({ resource, min_amount, max_amount }) => {
      if (min_amount !== max_amount) throw new Error("Native camp preset requires the pinned fixed grants");
      return { resource_type: resource, amount: scaled(min_amount, precision) };
    }),
    faith: {
      wonder_rate: config.faith!.wonder_base_fp_per_sec,
      realm_rate: config.faith!.realm_fp_per_sec,
      village_rate: config.faith!.village_fp_per_sec,
      owner_share_bps: config.faith!.owner_share_percent * 100,
    },
    upgrade_limits: { realm_max: config.realmMaxLevel - 1, village_max: config.villageMaxLevel - 1 },
    upgrades: Array.from({ length: Math.max(config.realmMaxLevel, config.villageMaxLevel) - 1 }, (_, index) => ({
      costs: amounts(required(config.realmUpgradeCosts, index + 1, "upgrade cost"), precision),
    })),
  };
}

function buildSettlement(config: Config) {
  return {
    reward_profile: resolveBlitzProfileId(config),
    realms: {
      resources: amounts(config.startingResources, config.resources.resourcePrecision),
      starting_troops: startingTroopsByBiome.map((name) => new CairoCustomEnum({ [name]: {} })),
      realm_resources: [...blitzRealmResources],
    },
    villages: {
      troop_delay_ticks: config.battle.delaySeconds,
      resources: amounts(config.villageStartingResources, config.resources.resourcePrecision),
      resource_pool: villageResourcePool.map((choice) => ({ ...choice })),
    },
    spires: config.blitz.mode.on
      ? new CairoOption(CairoOptionVariant.None)
      : new CairoOption(CairoOptionVariant.Some, {
          count: config.settlement.spires_max_count,
          base_distance: config.settlement.base_distance,
          layer_distance: config.settlement.spires_layer_distance,
          max_layer: config.settlement.layer_max,
        }),
  };
}

function buildEconomy(config: Config, tokens: Array<{ resource_type: number; token: string }>) {
  return {
    trade: { max_count: config.trade.maxCount },
    banks: {
      lp_fee_num: config.banks.lpFeesNumerator,
      lp_fee_denom: config.banks.lpFeesDenominator,
      owner_fee_num: config.banks.ownerFeesNumerator,
      owner_fee_denom: config.banks.ownerFeesDenominator,
    },
    hyperstructures: {
      initialize_shards: scaled(config.hyperstructures.hyperstructureInitializationShardsCost.amount),
      resources: config.hyperstructures.hyperstructureConstructionCost.map((resource) => ({
        resource_type: resource.resource_type,
        minimum: resource.min_amount,
        maximum: resource.max_amount,
        points: resource.resource_completion_points,
      })),
    },
    relics: relicRules.map((rule) => ({ ...rule })),
    research_cost: config.artificer!.research_cost_for_relic,
    withdrawals: new CairoOption<ReturnType<typeof buildWithdrawals>>(
      config.blitz.mode.on ? CairoOptionVariant.None : CairoOptionVariant.Some,
      config.blitz.mode.on ? undefined : buildWithdrawals(config, tokens),
    ),
  };
}

function buildWithdrawals(config: Config, tokens: Array<{ resource_type: number; token: string }>) {
  const bridge = config.bridge;
  return {
    deposits: {
      paused: false,
      realm_fee_bps: bridge.realm_fee_dpt_percent,
      velords_fee_bps: bridge.velords_fee_on_dpt_percent,
      season_fee_bps: bridge.season_pool_fee_on_dpt_percent,
      client_fee_bps: bridge.client_fee_on_dpt_percent,
    },
    rules: {
      paused: false,
      bank_fee_bps: bridge.realm_fee_wtdr_percent,
      velords_fee_bps: bridge.velords_fee_on_wtdr_percent,
      season_fee_bps: bridge.season_pool_fee_on_wtdr_percent,
      client_fee_bps: bridge.client_fee_on_wtdr_percent,
      velords_recipient: bridge.velords_fee_recipient,
      season_recipient: bridge.season_pool_fee_recipient,
      retention: withdrawalRetention.map((rule) => ({ ...rule })),
    },
    tokens,
  };
}

export function buildNativePreset(config: Config) {
  validateRequiredNativeConfig(config);
  const bridgeTokens = config.blitz.mode.on ? [] : resolveBridgeTokens(config);
  return {
    rules: buildRules(config),
    resources: buildResources(config),
    structures: buildStructures(config),
    settlement: buildSettlement(config),
    economy: buildEconomy(config, bridgeTokens),

    exploration: config.blitz.mode.on
      ? config.blitz.exploration.rewards.map(({ rewardId, amount, probabilityBps }) => ({
          resource_type: rewardId,
          amount,
          weight: probabilityBps,
        }))
      : eternumExplorationRewards(config.exploration.reward),
    season_win_points: config.victoryPoints.pointsForWin,
  };
}

function validateMineConfig(config: Config): void {
  if (
    !config.mines ||
    !config.mines.kinds ||
    typeof config.mines.kinds !== "object" ||
    Array.isArray(config.mines.kinds) ||
    !Array.isArray(config.mines.surfacePool)
  )
    throw new Error("Mine balance config is required");
  const kinds = new Set<number>();
  for (const [key, mine] of Object.entries(config.mines.kinds)) {
    const kind = Number(key);
    for (const [value, max] of [
      [kind, 255],
      [mine.resourceType, 58],
      [mine.buildingCategory, 40],
      [mine.capSteps, 0xffffffff],
    ]) {
      if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error("Invalid mine kind configuration");
    }
    if (kinds.has(kind)) throw new Error(`Duplicate mine kind ${kind}`);
    kinds.add(kind);
    scaled(mine.productionRate, config.resources.resourcePrecision);
    if (scaled(mine.capMinimum, config.resources.resourcePrecision) === 0n)
      throw new Error("Mine cap must be positive");
  }
  const pooled = new Set<number>();
  for (const { kind, weight } of config.mines.surfacePool) {
    if (!kinds.has(kind) || pooled.has(kind) || !Number.isSafeInteger(weight) || weight <= 0 || weight > 0xffffffff)
      throw new Error("Invalid mine pool entry");
    pooled.add(kind);
  }
  if (config.exploration.shardsMinesWinProbability > 0 && pooled.size === 0)
    throw new Error("Enabled mine discovery requires a pool");
}

function validateRequiredNativeConfig(config: Config): void {
  validateMineConfig(config);
  if (!config.bitcoin) throw new Error("Bitcoin balance config is required");
  for (const field of ["prizePerPhase", "minimumLabor", "ownerCutBps"] as const) {
    if (!Number.isSafeInteger(config.bitcoin[field]) || config.bitcoin[field] < 0)
      throw new Error(`Invalid Bitcoin ${field}`);
  }
  if (config.bitcoin.ownerCutBps > 10000) throw new Error("Invalid Bitcoin owner cut");
  if (!config.faith || typeof config.faith.enabled !== "boolean") throw new Error("Native faith config is required");
  for (const field of [
    "wonder_base_fp_per_sec",
    "realm_fp_per_sec",
    "village_fp_per_sec",
    "owner_share_percent",
  ] as const) {
    if (!Number.isSafeInteger(config.faith[field]) || config.faith[field] < 0)
      throw new Error(`Native faith ${field} is required and must be nonnegative`);
  }
  if (!Number.isSafeInteger(config.artificer?.research_cost_for_relic) || config.artificer!.research_cost_for_relic < 0)
    throw new Error("Native research cost is required and must be nonnegative");
}

function resolveBridgeTokens(config: Config) {
  const addresses = config.setup?.addresses;
  const configured = addresses?.resources;
  if (!configured || typeof configured !== "object" || Array.isArray(configured))
    throw new Error("Eternum bridge resource tokens are required");
  const tokens = [
    ...Object.values(configured!).map(([resource, token]) => ({
      resource_type: Number(resource),
      token: String(token),
    })),
    { resource_type: ResourcesIds.Lords, token: addresses!.lords },
  ];
  if (!tokens.length) throw new Error("Eternum bridge resource tokens are required");
  const seen = new Set<number>();
  for (const { resource_type, token } of tokens) {
    if (!Number.isSafeInteger(resource_type) || resource_type < 1 || resource_type > 58 || seen.has(resource_type))
      throw new Error(`Invalid or repeated bridge resource ${resource_type}`);
    if (!token || !/^0x[0-9a-f]+$/i.test(token) || BigInt(token) === 0n)
      throw new Error(`Missing bridge token for resource ${resource_type}`);
    seen.add(resource_type);
  }
  return tokens.map((entry) => ({ ...entry })).sort((a, b) => a.resource_type - b.resource_type);
}
