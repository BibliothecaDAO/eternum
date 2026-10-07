import {
  nativeResearchConstants,
  nativeRuleConstants as presetRule,
} from "../../../../contracts/l3/world-native/schema/client.gen";
import { nativePresetForId } from "../../../source/native";
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
import { villageResourcePool, withdrawalRetention } from "../../../source/common/native-data";

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

function buildRules(config: Config, preset: ReturnType<typeof nativePresetForId>) {
  const faith = config.faith;
  if (!faith) throw new Error("Native faith config is required");
  const cooldownSeconds = config.battle.cooldownSeconds;
  if (!Number.isSafeInteger(cooldownSeconds) || cooldownSeconds < 0 || cooldownSeconds > 0xffff_ffff)
    throw new Error("Native battle cooldownSeconds must be an explicit u32");
  const bitcoinEnabled = preset.bitcoinEnabled;
  return {
    battle_config: {
      regular_immunity_ticks: config.battle.regularImmunityTicks,
      village_immunity_ticks: config.battle.villageImmunityTicks,
      village_raid_immunity_ticks: config.battle.villageRaidImmunityTicks,
      cooldown_seconds: cooldownSeconds,
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
    command_mask: preset.commandMask,
    day_unit_seconds: preset.dayUnitSeconds,
    mode_rules: preset.modeRules,
    entry_rule: preset.entryRule,
    faith_enabled: faith.enabled,
    speed_config: {
      donkey_sec_per_km: config.speed.donkey_for_resources,
      donkey_sec_per_km_troops: config.speed.donkey_for_troops,
    },
  };
}

/**
 * A resource's labor-paid recipe. A mode whose sheet gives none (the arena modes) has no such path, and the chain refuses
 * a refill without inputs; where a recipe exists its output is required.
 */
function buildLaborPath(balances: Config["resources"], resource_type: number, precision: number) {
  const recipe = (balances.productionBySimpleRecipe as Record<number, Array<{ resource: number; amount: number }>>)[
    resource_type
  ];
  if (!recipe?.length) return { simple_output: 0n, simple_inputs: [] };
  return {
    simple_output: scaled(
      required(balances.productionBySimpleRecipeOutputs, resource_type, "simple output"),
      precision,
    ),
    simple_inputs: amounts(recipe, precision),
  };
}

function buildResources(config: Config) {
  const balances = config.resources;
  if (!config.mines) throw new Error("Mine balance config is required");
  const precision = balances.resourcePrecision;
  const resources = Array.from({ length: 58 }, (_, index) => {
    const resource_type = index + 1;
    // Relics and SAT have no production recipe or carried weight in the pinned rules.
    if (hasNoProduction(resource_type)) {
      return { resource_type, unit_weight: 0, realm_rate: 0n, village_rate: 0n };
    }
    const output = scaled(required(balances.productionByComplexRecipeOutputs, resource_type, "output"), precision);
    return {
      resource_type,
      unit_weight: required(balances.resourceWeightsGrams, resource_type, "resource weight"),
      realm_rate: output,
      village_rate: output / 2n,
    };
  });
  const production = resources.map(({ resource_type }) => ({
    resource_type,
    recipe: hasNoProduction(resource_type)
      ? { simple_output: 0n, complex_output: 0n, simple_inputs: [], complex_inputs: [] }
      : {
          ...buildLaborPath(balances, resource_type, precision),
          complex_output: scaled(
            required(balances.productionByComplexRecipeOutputs, resource_type, "complex output"),
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
  const mines = config.mines;
  if (!mines) throw new Error("Mine balance config is required");
  return {
    mine_kinds: Object.entries(mines.kinds).map(
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
    surface_mines: mines.surfacePool.map((entry) => ({ ...entry })),
  };
}

// The Hearth is the last building category: the four training buildings follow the forty older ones.
const buildingCategoryCount = nativeResearchConstants.HEARTH;

function buildStructures(config: Config, preset: ReturnType<typeof nativePresetForId>) {
  const faith = config.faith;
  if (!faith) throw new Error("Native faith config is required");
  const precision = config.resources.resourcePrecision;
  const board = preset.board;
  return {
    board:
      board === null
        ? new CairoOption(CairoOptionVariant.None)
        : new CairoOption(CairoOptionVariant.Some, {
            demolition_refund_bps: board.demolitionRefundBps,
            workshop_rate: scaled(board.workshopRate, precision),
            output_step_bps: board.outputStepBps,
            storage_step_bps: board.storageStepBps,
            population_step_bps: board.populationStepBps,
            ration_step: scaled(board.rationStep, precision),
            training_gate_tier: board.trainingGateTier,
            castle_store_deploys: board.castleStoreDeploys,
          }),
    research: preset.research.map(({ row, tier, essenceCost, laborCost }) => ({
      row,
      tier,
      price: { essence: scaled(essenceCost, precision), labor: scaled(laborCost, precision) },
    })),
    buildings: Array.from({ length: buildingCategoryCount }, (_, index) => {
      const category = index + 1;
      // Essence is mine-only, and only a realm board has training buildings; legacy presets have no storehouse recipe.
      const isNotBuilt = category === 39 || (category > 40 && board === null);
      const hasNoRecipe = isNotBuilt || (category === 2 && board === null);
      return {
        category,
        rule: {
          population_cost: isNotBuilt
            ? 0
            : required(config.buildings.buildingPopulation, category, "building population"),
          capacity_grant: isNotBuilt ? 0 : required(config.buildings.buildingCapacity, category, "building capacity"),
          simple_cost: hasNoRecipe
            ? []
            : amounts(required(config.buildings.simpleBuildingCost, category, "simple building cost"), precision),
          complex_cost: hasNoRecipe
            ? []
            : amounts(required(config.buildings.complexBuildingCosts, category, "complex building cost"), precision),
        },
      };
    }),
    camps: {
      resources: config.campStartingResources.map(({ resource, min_amount, max_amount }) => {
        if (min_amount !== max_amount) throw new Error("Native camp preset requires the pinned fixed grants");
        return { resource_type: resource, amount: scaled(min_amount, precision) };
      }),
      labor_rate: scaled(config.campLaborPerSecond, precision),
    },
    faith: {
      wonder_rate: faith.wonder_base_fp_per_sec,
      realm_rate: faith.realm_fp_per_sec,
      village_rate: faith.village_fp_per_sec,
      owner_share_bps: faith.owner_share_percent * 100,
    },
    upgrade_limits: { realm_max: config.realmMaxLevel - 1, village_max: config.villageMaxLevel - 1 },
    upgrades: Array.from({ length: Math.max(config.realmMaxLevel, config.villageMaxLevel) - 1 }, (_, index) => ({
      costs: amounts(required(config.realmUpgradeCosts, index + 1, "upgrade cost"), precision),
    })),
  };
}

function buildSettlement(config: Config, preset: ReturnType<typeof nativePresetForId>) {
  return {
    mode: new CairoCustomEnum({ [preset.settlementMode]: {} }),
    spacing: preset.spacing,
    depths: preset.depths.map((depth) => ({
      reveal_percent: depth.revealPercent,
      site_guard_lower: depth.siteGuardLower,
      site_guard_upper: depth.siteGuardUpper,
      reveal_site_neighbors: depth.revealSiteNeighbors,
      entry_stamina: depth.entryStamina,
      chest: depth.chest,
      ruin_guard_lower: depth.ruinGuardLower,
      ruin_guard_upper: depth.ruinGuardUpper,
      guard_step: depth.guardStep,
    })),
    realms: {
      resources: amounts(config.startingResources, config.resources.resourcePrecision),
      starting_troops: preset.startingTroops.map((name) => new CairoCustomEnum({ [name]: {} })),
      realm_resources: [...preset.realmResources],
    },
    villages: {
      troop_delay_ticks: config.battle.delaySeconds,
      resources: amounts(config.villageStartingResources, config.resources.resourcePrecision),
      resource_pool: villageResourcePool.map((choice) => ({ ...choice })),
    },
    spires: !(preset.modeRules & presetRule.SPIRES)
      ? new CairoOption(CairoOptionVariant.None)
      : new CairoOption(CairoOptionVariant.Some, {
          count: config.settlement.spires_max_count,
          base_distance: config.settlement.base_distance,
          layer_distance: config.settlement.spires_layer_distance,
          max_layer: config.settlement.layer_max,
        }),
  };
}

function buildEconomy(
  config: Config,
  preset: ReturnType<typeof nativePresetForId>,
  tokens: Array<{ resource_type: number; token: string }>,
) {
  const chests = preset.chests;
  if (chests === undefined || (chests !== null) !== (preset.dayUnitSeconds !== 0))
    throw new Error("Explicit chest rules are required for expedition presets only");
  if (chests !== null) {
    const shares = [
      chests.shares.common,
      chests.shares.uncommon,
      chests.shares.rare,
      chests.shares.epic,
      chests.shares.legendary,
    ];
    if (
      ![
        chests.pool,
        chests.priceCeiling,
        chests.surgeFactor,
        chests.surgeMinimumShares,
        chests.estimateDays,
        ...shares,
      ].every((value) => Number.isSafeInteger(value) && value > 0) ||
      [chests.surgeFactor, chests.estimateDays, ...shares].some((value) => value > 0xffff) ||
      shares.some((value, index) => value > (shares[index + 1] ?? value))
    )
      throw new Error("Invalid ruin chest rules");
  }
  const progression = preset.progression;
  if (progression === undefined || (progression !== null) !== (preset.dayUnitSeconds !== 0))
    throw new Error("Explicit progression rules are required for expedition presets only");
  if (
    progression &&
    Object.values(progression).some((value) => !Number.isSafeInteger(value) || value <= 0 || value > 0xffff_ffff)
  )
    throw new Error("Progression XP values must be positive u32 integers");
  return {
    discovery: buildDiscovery(preset),
    progression:
      progression === null
        ? new CairoOption(CairoOptionVariant.None)
        : new CairoOption(CairoOptionVariant.Some, {
            reveal_xp: progression.revealXp,
            fixed_xp: progression.fixedXp,
            uncommon_xp: progression.uncommonXp,
            rare_xp: progression.rareXp,
            epic_xp: progression.epicXp,
            legendary_xp: progression.legendaryXp,
          }),
    chests:
      chests === null
        ? new CairoOption(CairoOptionVariant.None)
        : new CairoOption(CairoOptionVariant.Some, {
            pool: BigInt(chests.pool),
            price_ceiling: BigInt(chests.priceCeiling),
            shares: chests.shares,
            surge_factor: chests.surgeFactor,
            surge_minimum_shares: chests.surgeMinimumShares,
            estimate_days: chests.estimateDays,
          }),
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
    relics: preset.relics.map((rule) => ({ ...rule })),
    research_cost: config.artificer!.research_cost_for_relic,
    withdrawals: new CairoOption<ReturnType<typeof buildWithdrawals>>(
      tokens.length === 0 ? CairoOptionVariant.None : CairoOptionVariant.Some,
      tokens.length === 0 ? undefined : buildWithdrawals(config, tokens),
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

export function buildNativePreset(config: Config, presetId: number) {
  const preset = nativePresetForId(presetId);
  validateRequiredNativeConfig(config);
  const bridgeTokens = resolveBridgeTokens(config, preset.bridgeResources);
  const definition = {
    rules: buildRules(config, preset),
    resources: buildResources(config),
    structures: buildStructures(config, preset),
    settlement: buildSettlement(config, preset),
    economy: buildEconomy(config, preset, bridgeTokens),

    exploration: preset.supplies.map((reward) => ({ ...reward })),
    season_win_points: config.victoryPoints.pointsForWin,
  };
  if (preset.clockScale) scaleSeasonClocks(definition, preset.clockScale);
  return definition;
}

/** A fixture preset plays its mode's season this many times faster: a shorter day, faster army ticks, more output. */
function scaleSeasonClocks(definition: ReturnType<typeof buildNativePreset>, scale: number): void {
  definition.rules.day_unit_seconds = clockScaled(definition.rules.day_unit_seconds, scale, "day_unit_seconds");
  definition.rules.tick_config.armies_tick_in_seconds = clockScaled(
    definition.rules.tick_config.armies_tick_in_seconds,
    scale,
    "armies_tick_in_seconds",
  );
  for (const resource of definition.resources.resources) {
    resource.realm_rate *= BigInt(scale);
    resource.village_rate *= BigInt(scale);
  }
  definition.structures.camps.labor_rate *= BigInt(scale);
  const board = definition.structures.board.unwrap();
  if (!board || typeof board !== "object" || !("workshop_rate" in board) || typeof board.workshop_rate !== "bigint")
    throw new Error("A scaled season requires a workshop rate");
  board.workshop_rate *= BigInt(scale);
  for (const mine of definition.resources.mine_kinds) mine.config.production_rate *= BigInt(scale);
}

/** A span of a scaled preset's season, in seconds: its mode's span divided by the clock scale, never rounded. */
export function clockScaled(seconds: number, scale: number, name: string): number {
  if (!Number.isInteger(seconds / scale)) throw new Error(`${name} ${seconds} does not divide by clock scale ${scale}`);
  return seconds / scale;
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

function resolveBridgeTokens(config: Config, resources: readonly number[]) {
  if (resources.length === 0) return [];
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
  return resources
    .map((resource_type) => {
      const token = tokens.find((entry) => entry.resource_type === resource_type)?.token;
      if (!token) throw new Error(`Missing bridge token for resource ${resource_type}`);
      return { resource_type, token };
    })
    .sort((a, b) => a.resource_type - b.resource_type);
}

function buildDiscovery(preset: ReturnType<typeof nativePresetForId>) {
  const rules = preset.discovery;
  if (rules === undefined || (rules !== null) !== (preset.dayUnitSeconds !== 0))
    throw new Error("Explicit discovery rules are required for expedition presets only");
  if (rules === null) return new CairoOption(CairoOptionVariant.None);
  if (
    Object.values(rules).some((value) => !Number.isSafeInteger(value) || value < 0 || value > 10000) ||
    rules.emptyRevealLimit < 1 ||
    rules.emptyRevealLimit > 255 ||
    rules.stragglersBps + rules.campBps + rules.riftBps === 0 ||
    rules.stragglersBps +
      rules.campBps +
      rules.riftBps +
      rules.ruinBps +
      rules.shrineBps +
      rules.wellBps +
      // Every Scouting tier on one kind doubles it: the larger of camp and rift is the most Scouting adds.
      Math.max(rules.campBps, rules.riftBps) >
      10000
  )
    throw new Error("Invalid categorical discovery rules");
  return new CairoOption(CairoOptionVariant.Some, {
    stragglers_bps: rules.stragglersBps,
    camp_bps: rules.campBps,
    rift_bps: rules.riftBps,
    ruin_bps: rules.ruinBps,
    shrine_bps: rules.shrineBps,
    well_bps: rules.wellBps,
    empty_reveal_limit: rules.emptyRevealLimit,
  });
}
