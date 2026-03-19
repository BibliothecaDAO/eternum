/**
 * Game config queries and parsing via Torii SQL.
 *
 * This is the SQL-only equivalent of packages/core ClientConfigManager,
 * which reads the same data from Dojo ECS components. This module exists
 * so the headless agent can load game config without a full Dojo client.
 */
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

// ── Raw row types ────────────────────────────────────────────────────

export interface BuildingCategoryConfigRow {
  category: number;
  complex_erection_cost_id: number;
  complex_erection_cost_count: number;
  simple_erection_cost_id: number;
  simple_erection_cost_count: number;
  population_cost: number;
  capacity_grant: number;
}

export interface ResourceFactoryConfigRow {
  resource_type: number;
  complex_input_list_id: number;
  complex_input_list_count: number;
  simple_input_list_id: number;
  simple_input_list_count: number;
  output_per_complex_input: string;
  output_per_simple_input: string;
  labor_output_per_resource: number;
  realm_output_per_second: number;
  village_output_per_second: number;
}

export interface ResourceListRow {
  entity_id: number;
  resource_type: number;
  amount: string;
  index: number;
}

export interface BuildingConfigRow {
  base_cost_percent_increase: number;
}

export interface StructureLevelConfigRow {
  level: number;
  required_resources_id: number;
  required_resource_count: number;
}

export interface StaminaConfigRow {
  travel_cost: number;
  explore_cost: number;
  bonus_value: number;
  gain_per_tick: number;
  knight_max: number;
  paladin_max: number;
  crossbowman_max: number;
  armies_tick_in_seconds: number;
}

// ── Parsed types ─────────────────────────────────────────────────────

export interface ResourceCost {
  resource: number;
  amount: number;
}

export interface BuildingCategoryConfig {
  category: number;
  complexCosts: ResourceCost[];
  simpleCosts: ResourceCost[];
  populationCost: number;
  capacityGrant: number;
}

export interface ResourceFactoryConfig {
  resourceType: number;
  complexInputs: ResourceCost[];
  simpleInputs: ResourceCost[];
  outputPerComplexInput: number;
  outputPerSimpleInput: number;
  laborOutputPerResource: number;
  realmOutputPerSecond: number;
  villageOutputPerSecond: number;
}

export interface StaminaConfig {
  travelCost: number;
  exploreCost: number;
  bonusValue: number;
  gainPerTick: number;
  knightMaxStamina: number;
  paladinMaxStamina: number;
  crossbowmanMaxStamina: number;
  armiesTickInSeconds: number;
}

export interface GameConfig {
  buildingCosts: Record<number, BuildingCategoryConfig>;
  resourceFactories: Record<number, ResourceFactoryConfig>;
  buildingBaseCostPercentIncrease: number;
  /** Upgrade costs per target level (e.g. key 2 = costs to upgrade from level 1 to 2). */
  realmUpgradeCosts: Record<number, ResourceCost[]>;
  /** Stamina costs for travel/explore and biome bonus. */
  stamina: StaminaConfig;
}

// ── Queries ──────────────────────────────────────────────────────────

export const CONFIG_QUERIES = {
  BUILDING_CATEGORY_CONFIGS: `
    SELECT category, complex_erection_cost_id, complex_erection_cost_count,
           simple_erection_cost_id, simple_erection_cost_count,
           population_cost, capacity_grant
    FROM \`s1_eternum-BuildingCategoryConfig\`
  `,

  RESOURCE_FACTORY_CONFIGS: `
    SELECT resource_type, complex_input_list_id, complex_input_list_count,
           simple_input_list_id, simple_input_list_count,
           output_per_complex_input, output_per_simple_input,
           labor_output_per_resource, realm_output_per_second, village_output_per_second
    FROM \`s1_eternum-ResourceFactoryConfig\`
  `,

  RESOURCE_LIST: `
    SELECT entity_id, resource_type, amount, \`index\`
    FROM \`s1_eternum-ResourceList\`
  `,

  BUILDING_CONFIG: `
    SELECT \`building_config.base_cost_percent_increase\` AS base_cost_percent_increase
    FROM \`s1_eternum-WorldConfig\`
    LIMIT 1
  `,

  STRUCTURE_LEVEL_CONFIGS: `
    SELECT level, required_resources_id, required_resource_count
    FROM \`s1_eternum-StructureLevelConfig\`
  `,

  STAMINA_CONFIG: `
    SELECT
      \`troop_stamina_config.stamina_travel_stamina_cost\` AS travel_cost,
      \`troop_stamina_config.stamina_explore_stamina_cost\` AS explore_cost,
      \`troop_stamina_config.stamina_bonus_value\` AS bonus_value,
      \`troop_stamina_config.stamina_gain_per_tick\` AS gain_per_tick,
      \`troop_stamina_config.stamina_knight_max\` AS knight_max,
      \`troop_stamina_config.stamina_paladin_max\` AS paladin_max,
      \`troop_stamina_config.stamina_crossbowman_max\` AS crossbowman_max,
      \`tick_config.armies_tick_in_seconds\` AS armies_tick_in_seconds
    FROM \`s1_eternum-WorldConfig\`
    LIMIT 1
  `,
};

// ── Helpers ──────────────────────────────────────────────────────────

function divideByPrecision(value: number): number {
  return value / RESOURCE_PRECISION;
}

/**
 * Build a lookup from (entity_id, index) → ResourceCost from raw ResourceList rows.
 */
function buildResourceListIndex(rows: ResourceListRow[]): Map<string, ResourceCost> {
  const index = new Map<string, ResourceCost>();
  for (const row of rows) {
    const key = `${row.entity_id},${row.index}`;
    index.set(key, {
      resource: row.resource_type,
      amount: divideByPrecision(Number(row.amount)),
    });
  }
  return index;
}

/**
 * Resolve a cost list from the ResourceList index given a list_id and count.
 */
function resolveCosts(resourceIndex: Map<string, ResourceCost>, listId: number, count: number): ResourceCost[] {
  const costs: ResourceCost[] = [];
  for (let i = 0; i < count; i++) {
    const entry = resourceIndex.get(`${listId},${i}`);
    if (entry) {
      costs.push(entry);
    }
  }
  return costs;
}

// ── Parser ───────────────────────────────────────────────────────────

/**
 * Assemble a GameConfig from the raw query results.
 * Call this after fetching all four queries in parallel.
 */
export function parseGameConfig(
  buildingRows: BuildingCategoryConfigRow[],
  factoryRows: ResourceFactoryConfigRow[],
  resourceListRows: ResourceListRow[],
  buildingConfigRow: BuildingConfigRow | null,
  levelConfigRows?: StructureLevelConfigRow[],
  staminaConfigRow?: StaminaConfigRow | null,
): GameConfig {
  const resourceIndex = buildResourceListIndex(resourceListRows);

  const buildingCosts: Record<number, BuildingCategoryConfig> = {};
  for (const row of buildingRows) {
    buildingCosts[row.category] = {
      category: row.category,
      complexCosts: resolveCosts(resourceIndex, row.complex_erection_cost_id, row.complex_erection_cost_count),
      simpleCosts: resolveCosts(resourceIndex, row.simple_erection_cost_id, row.simple_erection_cost_count),
      populationCost: row.population_cost,
      capacityGrant: row.capacity_grant,
    };
  }

  const resourceFactories: Record<number, ResourceFactoryConfig> = {};
  for (const row of factoryRows) {
    resourceFactories[row.resource_type] = {
      resourceType: row.resource_type,
      complexInputs: resolveCosts(resourceIndex, row.complex_input_list_id, row.complex_input_list_count),
      simpleInputs: resolveCosts(resourceIndex, row.simple_input_list_id, row.simple_input_list_count),
      outputPerComplexInput: divideByPrecision(Number(row.output_per_complex_input)),
      outputPerSimpleInput: divideByPrecision(Number(row.output_per_simple_input)),
      laborOutputPerResource: row.labor_output_per_resource,
      realmOutputPerSecond: divideByPrecision(Number(row.realm_output_per_second)),
      villageOutputPerSecond: divideByPrecision(Number(row.village_output_per_second)),
    };
  }

  const realmUpgradeCosts: Record<number, ResourceCost[]> = {};
  if (levelConfigRows) {
    for (const row of levelConfigRows) {
      realmUpgradeCosts[row.level] = resolveCosts(
        resourceIndex,
        row.required_resources_id,
        row.required_resource_count,
      );
    }
  }

  return {
    buildingCosts,
    resourceFactories,
    buildingBaseCostPercentIncrease: buildingConfigRow?.base_cost_percent_increase ?? 0,
    realmUpgradeCosts,
    stamina: {
      travelCost: staminaConfigRow?.travel_cost ?? 20,
      exploreCost: staminaConfigRow?.explore_cost ?? 30,
      bonusValue: staminaConfigRow?.bonus_value ?? 10,
      gainPerTick: staminaConfigRow?.gain_per_tick ?? 7,
      knightMaxStamina: staminaConfigRow?.knight_max ?? 160,
      paladinMaxStamina: staminaConfigRow?.paladin_max ?? 180,
      crossbowmanMaxStamina: staminaConfigRow?.crossbowman_max ?? 140,
      armiesTickInSeconds: staminaConfigRow?.armies_tick_in_seconds ?? 1,
    },
  };
}
