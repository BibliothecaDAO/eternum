export const CONFIG_QUERIES = {
  WORLD_CONFIG: `
    SELECT
      [troop_stamina_config.stamina_explore_stamina_cost],
      [troop_stamina_config.stamina_travel_stamina_cost],
      [troop_stamina_config.stamina_gain_per_tick],
      [troop_stamina_config.stamina_bonus_value],
      [troop_stamina_config.stamina_knight_max],
      [troop_stamina_config.stamina_paladin_max],
      [troop_stamina_config.stamina_crossbowman_max],
      [troop_stamina_config.stamina_attack_req],
      [troop_stamina_config.stamina_defense_req],
      [troop_stamina_config.stamina_explore_wheat_cost],
      [troop_stamina_config.stamina_explore_fish_cost],
      [troop_stamina_config.stamina_travel_wheat_cost],
      [troop_stamina_config.stamina_travel_fish_cost],
      [troop_damage_config.damage_biome_bonus_num],
      [structure_max_level_config.realm_max],
      [building_config.base_cost_percent_increase],
      [building_config.base_population],
      [tick_config.armies_tick_in_seconds]
    FROM [s1_eternum-WorldConfig]
    LIMIT 1;
  `,

  STRUCTURE_LEVEL_CONFIG: `
    SELECT level, required_resource_count, required_resources_id
    FROM [s1_eternum-StructureLevelConfig]
    ORDER BY level;
  `,

  RESOURCE_LIST_BY_IDS: `
    SELECT entity_id, [index], resource_type, amount
    FROM [s1_eternum-ResourceList]
    WHERE entity_id IN ({ids})
    ORDER BY entity_id, [index];
  `,

  BUILDING_CATEGORY_CONFIG: `
    SELECT category, population_cost, capacity_grant,
           simple_erection_cost_id, simple_erection_cost_count,
           complex_erection_cost_id, complex_erection_cost_count
    FROM [s1_eternum-BuildingCategoryConfig]
    ORDER BY category;
  `,

  RESOURCE_FACTORY_CONFIG: `
    SELECT resource_type, realm_output_per_second, village_output_per_second,
           simple_input_list_count, complex_input_list_count
    FROM [s1_eternum-ResourceFactoryConfig]
    ORDER BY resource_type;
  `,
} as const;
