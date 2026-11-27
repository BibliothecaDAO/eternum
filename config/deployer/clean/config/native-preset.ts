import {
  nativeRaceConstants,
  nativeQuestConstants as quest,
} from "../../../../contracts/l3/world-native/schema/balance.gen";
import { DAYS_PER_BAG } from "@bibliothecadao/eternum/expeditions";
import { buildingIds } from "../../../source/frontier/native";
import { nativePresetForId, nativePresetIdFor } from "../../../source/native";
import { loadNativePresetConfiguration } from "../registrar/native-preset";
import { RELIC_SECONDS_PER_RANK } from "../../../source/common/season-clock";
import { RESOURCE_PRECISION, ResourcesIds, deepSites, type Config } from "@bibliothecadao/types";
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
  const cooldownSeconds = config.battle.cooldownSeconds;
  if (!Number.isSafeInteger(cooldownSeconds) || cooldownSeconds < 0 || cooldownSeconds > 0xffff_ffff)
    throw new Error("Native battle cooldownSeconds must be an explicit u32");
  return {
    battle_config: {
      regular_immunity_ticks: config.battle.regularImmunityTicks,
      village_immunity_ticks: config.battle.villageImmunityTicks,
      cooldown_seconds: cooldownSeconds,
    },
    map_config: buildMapConfig(config),
    biome_climate_config: buildBiomeClimateConfig(config),
    tick_config: {
      armies_tick_in_seconds: config.tick.armiesTickIntervalInSeconds,
      delivery_tick_in_seconds: config.tick.deliveryTickIntervalInSeconds,
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
    map_center_offset: config.settlement.center,
    spire_travel_essence_cost: scaled(config.spireTravelEssenceCost),
    command_mask: preset.commandMask,
    day_unit_seconds: preset.dayUnitSeconds,
    mode_rules: preset.modeRules,
    entry_rule: preset.entryRule,
    speed_config: {
      donkey_sec_per_km: config.speed.donkey_for_resources,
      donkey_sec_per_km_troops: config.speed.donkey_for_troops,
    },
    relic_seconds_per_rank: RELIC_SECONDS_PER_RANK,
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

function buildStructures(config: Config, preset: ReturnType<typeof nativePresetForId>) {
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
            ration_step: scaled(board.rationStep, precision),
            troop_store_deploys: board.troopStoreDeploys,
            settlement_resource_cap: board.resourceStoreCaps[0],
            city_resource_cap: board.resourceStoreCaps[1],
            kingdom_resource_cap: board.resourceStoreCaps[2],
            empire_resource_cap: board.resourceStoreCaps[3],
          }),
    research: preset.research.map(({ row, tier, essenceCost, laborCost }) => ({
      row,
      tier,
      price: { essence: scaled(essenceCost, precision), labor: scaled(laborCost, precision) },
    })),
    buildings: buildingIds.map((category: number) => {
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
    order_aspects: [...preset.orderAspects],
    depths: preset.depths.map((depth) => ({
      reveal_percent: depth.revealPercent,
      reveal_cap: depth.revealCap,
      rift_essence_bps: depth.riftEssenceBps,
      site_guard_lower: depth.siteGuardLower,
      site_guard_upper: depth.siteGuardUpper,
      rift_guard_lower: depth.riftGuardLower,
      rift_guard_upper: depth.riftGuardUpper,
      reveal_site_neighbors: depth.revealSiteNeighbors,
      chest: depth.chest,
      guard_step: depth.guardStep,
      beast_weak_lower: depth.beastWeakLower,
      beast_weak_upper: depth.beastWeakUpper,
      beast_strong_lower: depth.beastStrongLower,
      beast_strong_upper: depth.beastStrongUpper,
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
    spires: new CairoOption(CairoOptionVariant.None),
  };
}

function buildEconomy(
  config: Config,
  preset: ReturnType<typeof nativePresetForId>,
  tokens: Array<{ resource_type: number; token: string }>,
) {
  const labor = preset.labor;
  if (
    (labor !== null || preset.dailyQuest !== null) !== (preset.dayUnitSeconds !== 0) ||
    (labor !== null &&
      (!Number.isSafeInteger(labor.amount) ||
        labor.amount <= 0 ||
        !Number.isSafeInteger(labor.goldenAmount) ||
        labor.goldenAmount <= 0 ||
        [labor.campaignEssence, labor.goldenEssence].some((amount) => !Number.isSafeInteger(amount) || amount < 0)))
  )
    throw new Error("Invalid Realm labor rules");
  return {
    labor:
      preset.labor === null
        ? new CairoOption(CairoOptionVariant.None)
        : new CairoOption(CairoOptionVariant.Some, {
            amount: BigInt(preset.labor.amount),
            campaign_essence: BigInt(preset.labor.campaignEssence),
            golden_amount: BigInt(preset.labor.goldenAmount),
            golden_essence: BigInt(preset.labor.goldenEssence),
          }),
    deep: buildDeep(preset),
    discovery: buildDiscovery(preset),
    quests: buildQuests(preset),
    banes: buildBanes(preset),
    race: buildRace(preset),
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

export function seasonOneReleaseDefinition() {
  const presetId = nativePresetIdFor("frontier");
  return buildNativePreset(loadNativePresetConfiguration("madara.frontier", presetId), presetId);
}

export function blitzReleaseDefinition() {
  const presetId = nativePresetIdFor("blitz");
  return buildNativePreset(loadNativePresetConfiguration("madara.blitz", presetId), presetId);
}

export function blitzPointRules() {
  const { victoryPoints } = loadNativePresetConfiguration("madara.blitz", nativePresetIdFor("blitz"));
  return {
    explore_points: BigInt(victoryPoints.pointsForTileExploration),
    capture_points: BigInt(victoryPoints.pointsForNonHyperstructureClaimAgainstBandits),
    hyperstructure_capture_points: BigInt(victoryPoints.pointsForHyperstructureClaimAgainstBandits),
    hold_points_per_second: BigInt(victoryPoints.hyperstructurePointsPerCycle),
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
  };
  return definition;
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
}

function resolveBridgeTokens(config: Config, resources: readonly number[]) {
  if (resources.length === 0) return [];
  const addresses = config.setup?.addresses;
  const configured = addresses?.resources;
  if (!configured || typeof configured !== "object" || Array.isArray(configured))
    throw new Error("Bridge resource tokens are required");
  const tokens = [
    ...Object.values(configured!).map(([resource, token]) => ({
      resource_type: Number(resource),
      token: String(token),
    })),
    { resource_type: ResourcesIds.Lords, token: addresses!.lords },
  ];
  if (!tokens.length) throw new Error("Bridge resource tokens are required");
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

function buildDeep(preset: ReturnType<typeof nativePresetForId>) {
  const deep = preset.deep;
  if (deep === null) return new CairoOption(CairoOptionVariant.None);
  if (!deep || preset.dayUnitSeconds === 0 || preset.orderAspects.length === 0)
    throw new Error("Deep requires explicit Aspect expedition rules");
  validateDeep(deep);
  return new CairoOption(CairoOptionVariant.Some, {
    gate_distance: deep.gateDistance,
    rings: deep.rings.map(({ radius, realms }) => ({ radius, realms })),
    beasts: deepBeasts(deep).map(({ count, bow }) => ({ count: scaled(count), bow })),
    loss_per_tick: scaled(deep.lossPerTick),
    core_per_tick: scaled(deep.corePerTick),
    mine_per_tick: scaled(deep.minePerTick),
    building_pay: deep.buildingPay,
    altar_threshold: deep.altarThreshold,
  });
}

type DeepPreset = NonNullable<ReturnType<typeof nativePresetForId>["deep"]>;

function deepBeasts(deep: DeepPreset) {
  return [...deepSites].sort((left, right) => left.id - right.id).map(({ key }) => deep.beasts[key]);
}

function validateDeep(deep: DeepPreset) {
  const amounts = [
    ...deepBeasts(deep).map(({ count }) => count),
    deep.lossPerTick,
    deep.corePerTick,
    deep.minePerTick,
    deep.buildingPay.alone,
    deep.buildingPay.pair,
    deep.buildingPay.crowd,
    deep.altarThreshold,
    deep.gateDistance,
    ...deep.rings.map(({ radius }) => radius),
  ];
  if (
    amounts.some((value) => !Number.isSafeInteger(value) || value <= 0) ||
    deep.altarThreshold > 0xffff_ffff ||
    deep.buildingPay.alone > 0xffff_ffff ||
    deep.buildingPay.pair > deep.buildingPay.alone ||
    deep.buildingPay.crowd > deep.buildingPay.pair
  )
    throw new Error("Invalid Deep tick amounts");
}

function buildRace(preset: ReturnType<typeof nativePresetForId>) {
  const race = preset.race;
  if (race === null) return new CairoOption(CairoOptionVariant.None);
  if (!race || !preset.deep) throw new Error("Race requires the Deep");
  validateRace(race);
  if (race.stageHeight < preset.deep.buildingPay.alone) throw new Error("A tick's height passes a whole stage");
  return new CairoOption(CairoOptionVariant.Some, {
    season_days: BigInt(race.seasonDays),
    stage_height: race.stageHeight,
    clear_mist_percent: race.clearMistPercent,
    second_wind_percent: race.secondWindPercent,
    pale_moon_percent: race.paleMoonPercent,
    spoils_percent: race.spoilsPercent,
  });
}

function validateRace(race: NonNullable<ReturnType<typeof nativePresetForId>["race"]>) {
  const amounts = [race.seasonDays, race.stageHeight];
  if (
    amounts.some((value) => !Number.isSafeInteger(value) || value <= 0) ||
    race.seasonDays % DAYS_PER_BAG !== 0 ||
    race.stageHeight > Math.floor(0xffff_ffff / nativeRaceConstants.STAGE_COUNT)
  )
    throw new Error("Invalid race amounts");
  const boosts = [race.clearMistPercent, race.secondWindPercent, race.spoilsPercent];
  if (
    boosts.some((value) => !Number.isSafeInteger(value) || value < 100 || value > 200) ||
    !Number.isSafeInteger(race.paleMoonPercent) ||
    race.paleMoonPercent <= 0 ||
    race.paleMoonPercent > 100
  )
    throw new Error("Invalid Triumph rates");
}

function buildBanes(preset: ReturnType<typeof nativePresetForId>) {
  const rules = preset.banes;
  if (rules === null) return new CairoOption(CairoOptionVariant.None);
  if (!rules || preset.dailyQuest === null) throw new Error("Banes require daily quests");
  const percentages = [
    rules.chanceStep,
    rules.quorumPercent,
    rules.beastPercent,
    rules.staminaPercent,
    rules.productionPercent,
  ];
  if (
    percentages.some((value) => !Number.isSafeInteger(value) || value <= 0 || value > 0xffff) ||
    rules.chanceStep > 100 ||
    rules.quorumPercent > 100 ||
    rules.beastPercent < 100 ||
    rules.staminaPercent > 100 ||
    rules.productionPercent > 100
  )
    throw new Error("Invalid bane percentages");
  if (rules.questCounts.length !== 12 || rules.questCounts.some((value) => !Number.isSafeInteger(value) || value <= 0))
    throw new Error("Invalid bane quest counts");
  return new CairoOption(CairoOptionVariant.Some, {
    chance_step: rules.chanceStep,
    quorum_percent: rules.quorumPercent,
    beast_percent: rules.beastPercent,
    stamina_percent: rules.staminaPercent,
    production_percent: rules.productionPercent,
    quest_counts: rules.questCounts.map(BigInt),
  });
}

function buildQuests(preset: ReturnType<typeof nativePresetForId>) {
  const rules = preset.dailyQuest;
  if (rules === null) return new CairoOption(CairoOptionVariant.None);
  if (!rules || preset.dayUnitSeconds === 0 || preset.orderAspects.length === 0 || preset.labor !== null)
    throw new Error("Daily quests require Aspect expeditions and replace labor claims");
  if (
    rules.baseCounts.length !== quest.QUEST_COUNT ||
    rules.baseCounts.some((count) => !Number.isSafeInteger(count) || count <= 0 || count > 0xffff_ffff)
  )
    throw new Error("Invalid daily quest counts");
  if (
    [rules.labor, rules.essence, rules.bonusPercent].some((value) => !Number.isSafeInteger(value) || value <= 0) ||
    rules.bonusPercent < 100 ||
    rules.bonusPercent > 0xffff
  )
    throw new Error("Invalid daily quest reward");
  return new CairoOption(CairoOptionVariant.Some, {
    base_counts: rules.baseCounts,
    labor: BigInt(rules.labor),
    essence: BigInt(rules.essence),
    bonus_percent: rules.bonusPercent,
  });
}

function buildDiscovery(preset: ReturnType<typeof nativePresetForId>) {
  const rules = preset.discovery;
  if (rules === undefined || (rules !== null) !== (preset.dayUnitSeconds !== 0))
    throw new Error("Explicit discovery rules are required for expedition presets only");
  if (rules === null) return new CairoOption(CairoOptionVariant.None);
  return new CairoOption(CairoOptionVariant.Some, {
    beasts_bps: rules.beastsBps,
    camp_bps: rules.campBps,
    rift_bps: rules.riftBps,
    ruin_bps: rules.ruinBps,
    shrine_bps: rules.shrineBps,
    well_bps: rules.wellBps,
    empty_reveal_limit: rules.emptyRevealLimit,
  });
}
