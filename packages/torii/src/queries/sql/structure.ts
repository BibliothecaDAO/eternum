export const STRUCTURE_QUERIES = {
  STRUCTURES_BY_OWNER: `
    SELECT \`base.coord_x\` AS coord_x, \`base.coord_y\` AS coord_y, entity_id, owner 
    FROM [s1_eternum-Structure] 
    WHERE owner == '{owner}';
  `,

  OTHER_STRUCTURES: `
    SELECT entity_id AS entityId, \`metadata.realm_id\` AS realmId, owner, category 
    FROM [s1_eternum-Structure] 
    WHERE owner != '{owner}';
  `,

  REALM_SETTLEMENTS: `
    SELECT \`base.coord_x\` AS coord_x, \`base.coord_y\` AS coord_y, entity_id, owner 
    FROM [s1_eternum-Structure] 
    WHERE category == 1;
  `,

  STRUCTURE_BY_COORD: `
    SELECT
        internal_id,
        entity_id,
        owner AS occupier_id,
        \`base.category\` AS structure_category,
        \`base.level\` AS structure_level,
        \`base.coord_x\` AS coord_x,
        \`base.coord_y\` AS coord_y,
        \`base.created_at\` AS created_tick,
        \`metadata.realm_id\` AS realm_id,
        category AS top_level_category,
        internal_created_at,
        internal_updated_at,
        resources_packed
    FROM \`s1_eternum-Structure\`
    WHERE \`base.coord_x\` = {coord_x} AND \`base.coord_y\` = {coord_y};
    LIMIT 1;
  `,

  PLAYER_STRUCTURES: `
    SELECT 
        \`base.coord_x\` as coord_x,
        \`base.coord_y\` as coord_y,
        category,
        resources_packed,
        entity_id,
        \`metadata.realm_id\` as realm_id,
        \`metadata.has_wonder\` as has_wonder,
        \`base.level\` as level
    FROM \`s1_eternum-Structure\`
    WHERE owner = '{owner}'
    ORDER BY category, entity_id;
  `,

  FIRST_STRUCTURE: `
    SELECT 
        entity_id,
        owner,
        \`base.coord_x\` as coord_x,
        \`base.coord_y\` as coord_y
    FROM \`s1_eternum-Structure\`
    LIMIT 1;
  `,

  SURROUNDING_WONDER_BONUS: `
    SELECT entity_id
    FROM \`s1_eternum-Structure\`
    WHERE \`base.coord_x\` >= {minX} 
      AND \`base.coord_x\` <= {maxX}
      AND \`base.coord_y\` >= {minY} 
      AND \`base.coord_y\` <= {maxY}
      AND \`metadata.has_wonder\` = true
    LIMIT 1;
  `,

  HYPERSTRUCTURES: `
    SELECT hyperstructure_id
    FROM \`s1_eternum-Hyperstructure\`;
  `,

  REALM_VILLAGE_SLOTS: `
    SELECT 
        \`connected_realm_coord.x\`, 
        \`connected_realm_coord.y\`, 
        connected_realm_entity_id, 
        connected_realm_id, 
        directions_left 
    FROM \`s1_eternum-StructureVillageSlots\`
  `,

  STRUCTURE_AND_EXPLORER_DETAILS: `
    SELECT
        s.owner AS owner_address,
        GROUP_CONCAT(DISTINCT s.entity_id || ':' || s.\`metadata.realm_id\`|| ':' || s.\`category\`) AS structure_ids,
        GROUP_CONCAT(
            CASE 
                WHEN et.explorer_id IS NOT NULL 
                THEN et.explorer_id || ':' || s.entity_id 
                ELSE NULL 
            END
        ) AS explorer_ids,
        COUNT(DISTINCT CASE WHEN s.category = 1 THEN s.entity_id END) as realms_count,
        COUNT(DISTINCT CASE WHEN s.category = 2 THEN s.entity_id END) as hyperstructures_count,
        COUNT(DISTINCT CASE WHEN s.category = 3 THEN s.entity_id END) as bank_count,
        COUNT(DISTINCT CASE WHEN s.category = 4 THEN s.entity_id END) as mine_count,
        COUNT(DISTINCT CASE WHEN s.category = 5 THEN s.entity_id END) as village_count,
        gm.guild_id,
        g.name AS guild_name,
        sos.name AS player_name
    FROM [s1_eternum-Structure] s
    LEFT JOIN [s1_eternum-ExplorerTroops] et ON et.owner = s.entity_id
    LEFT JOIN [s1_eternum-GuildMember] gm ON gm.member = s.owner
    LEFT JOIN [s1_eternum-Guild] g ON g.guild_id = gm.guild_id
    LEFT JOIN [s1_eternum-StructureOwnerStats] sos ON sos.owner = s.owner
    GROUP BY s.owner
  `,

  GUARDS_BY_STRUCTURE: `
    SELECT 
        entity_id,
        \`troop_guards.delta.category\` as delta_category,
        \`troop_guards.delta.tier\` as delta_tier,
        \`troop_guards.delta.count\` as delta_count,
        \`troop_guards.delta.stamina.amount\` as delta_stamina_amount,
        \`troop_guards.delta.stamina.updated_tick\` as delta_stamina_updated_tick,
        \`troop_guards.charlie.category\` as charlie_category,
        \`troop_guards.charlie.tier\` as charlie_tier,
        \`troop_guards.charlie.count\` as charlie_count,
        \`troop_guards.charlie.stamina.amount\` as charlie_stamina_amount,
        \`troop_guards.charlie.stamina.updated_tick\` as charlie_stamina_updated_tick,
        \`troop_guards.bravo.category\` as bravo_category,
        \`troop_guards.bravo.tier\` as bravo_tier,
        \`troop_guards.bravo.count\` as bravo_count,
        \`troop_guards.bravo.stamina.amount\` as bravo_stamina_amount,
        \`troop_guards.bravo.stamina.updated_tick\` as bravo_stamina_updated_tick,
        \`troop_guards.alpha.category\` as alpha_category,
        \`troop_guards.alpha.tier\` as alpha_tier,
        \`troop_guards.alpha.count\` as alpha_count,
        \`troop_guards.alpha.stamina.amount\` as alpha_stamina_amount,
        \`troop_guards.alpha.stamina.updated_tick\` as alpha_stamina_updated_tick,
        \`troop_guards.delta_destroyed_tick\` as delta_destroyed_tick,
        \`troop_guards.charlie_destroyed_tick\` as charlie_destroyed_tick,
        \`troop_guards.bravo_destroyed_tick\` as bravo_destroyed_tick,
        \`troop_guards.alpha_destroyed_tick\` as alpha_destroyed_tick
    FROM \`s1_eternum-Structure\`
    WHERE entity_id = {entityId};
  `,

  ALL_STRUCTURES_MAP_DATA: `
       WITH latest_battles AS (
        -- Get latest battles where this structure was the defender
        SELECT DISTINCT
            defender_id,
            FIRST_VALUE(attacker_id) OVER (
                PARTITION BY defender_id 
                ORDER BY timestamp DESC
            ) as latest_attacker_id,
            FIRST_VALUE(timestamp) OVER (
                PARTITION BY defender_id 
                ORDER BY timestamp DESC
            ) as latest_attack_timestamp
        FROM [s1_eternum-BattleEvent]
        -- WHERE timestamp > 1757487964
    ),
    latest_defenses AS (
        -- Get latest battles where this structure was the attacker
        SELECT DISTINCT
            attacker_id,
            FIRST_VALUE(defender_id) OVER (
                PARTITION BY attacker_id 
                ORDER BY timestamp DESC
            ) as latest_defender_id,
            FIRST_VALUE(timestamp) OVER (
                PARTITION BY attacker_id 
                ORDER BY timestamp DESC
            ) as latest_defense_timestamp
        FROM [s1_eternum-BattleEvent]
        -- WHERE timestamp > 1757487964
    )
    SELECT 
        s.entity_id,
        s.\`base.coord_x\` as coord_x,
        s.\`base.coord_y\` as coord_y,
        s.category as structure_type,
        s.\`base.level\` as level,
        s.owner as owner_address,
        s.\`metadata.realm_id\` as realm_id,
        s.resources_packed,
        sos.name as owner_name,
    
        -- Guard army data
        s.\`troop_guards.delta.category\` as delta_category,
        s.\`troop_guards.delta.tier\` as delta_tier,
        s.\`troop_guards.delta.count\` as delta_count,
        s.\`troop_guards.delta.stamina.amount\` as delta_stamina_amount,
        s.\`troop_guards.charlie.category\` as charlie_category,
        s.\`troop_guards.charlie.tier\` as charlie_tier,
        s.\`troop_guards.charlie.count\` as charlie_count,
        s.\`troop_guards.charlie.stamina.amount\` as charlie_stamina_amount,
        s.\`troop_guards.bravo.category\` as bravo_category,
        s.\`troop_guards.bravo.tier\` as bravo_tier,
        s.\`troop_guards.bravo.count\` as bravo_count,
        s.\`troop_guards.bravo.stamina.amount\` as bravo_stamina_amount,
        s.\`troop_guards.alpha.category\` as alpha_category,
        s.\`troop_guards.alpha.tier\` as alpha_tier,
        s.\`troop_guards.alpha.count\` as alpha_count,
        s.\`troop_guards.alpha.stamina.amount\` as alpha_stamina_amount,
        s.\`troop_guards.delta.battle_cooldown_end\` as delta_battle_cooldown_end,
        s.\`troop_guards.charlie.battle_cooldown_end\` as charlie_battle_cooldown_end,
        s.\`troop_guards.bravo.battle_cooldown_end\` as bravo_battle_cooldown_end,
        s.\`troop_guards.alpha.battle_cooldown_end\` as alpha_battle_cooldown_end,
    
        -- Building production data from StructureBuildings packed counts
        sb.packed_counts_1,
        sb.packed_counts_2,
        sb.packed_counts_3,
    
        -- Battle data with coordinates
        lb.latest_attacker_id,
        lb.latest_attack_timestamp,
        COALESCE(attacker_struct.\`base.coord_x\`, attacker_explorer.\`coord.x\`) as latest_attacker_coord_x,
        COALESCE(attacker_struct.\`base.coord_y\`, attacker_explorer.\`coord.y\`) as latest_attacker_coord_y,
    
        ld.latest_defender_id,
        ld.latest_defense_timestamp,
        COALESCE(defender_struct.\`base.coord_x\`, defender_explorer.\`coord.x\`) as latest_defender_coord_x,
        COALESCE(defender_struct.\`base.coord_y\`, defender_explorer.\`coord.y\`) as latest_defender_coord_y

    FROM [s1_eternum-Structure] s
    LEFT JOIN [s1_eternum-StructureOwnerStats] sos ON sos.owner = s.owner
    LEFT JOIN [s1_eternum-StructureBuildings] sb ON sb.entity_id = s.entity_id
    LEFT JOIN latest_battles lb ON lb.defender_id = s.entity_id
    LEFT JOIN latest_defenses ld ON ld.attacker_id = s.entity_id

    -- Get coordinates for latest attacker (could be structure or explorer troops)
    LEFT JOIN [s1_eternum-Structure] attacker_struct ON attacker_struct.entity_id = lb.latest_attacker_id
    LEFT JOIN [s1_eternum-ExplorerTroops] attacker_explorer ON attacker_explorer.explorer_id = lb.latest_attacker_id

    -- Get coordinates for latest defender (could be structure or explorer troops)
    LEFT JOIN [s1_eternum-Structure] defender_struct ON defender_struct.entity_id = ld.latest_defender_id
    LEFT JOIN [s1_eternum-ExplorerTroops] defender_explorer ON defender_explorer.explorer_id = ld.latest_defender_id

    ORDER BY s.entity_id;
  `,

  ALL_ARMIES_MAP_DATA: `
  WITH latest_battles AS (
      -- Get latest battles where this army was the defender
      SELECT DISTINCT
          defender_id,
          FIRST_VALUE(attacker_id) OVER (
              PARTITION BY defender_id 
              ORDER BY timestamp DESC
          ) as latest_attacker_id,
          FIRST_VALUE(timestamp) OVER (
              PARTITION BY defender_id 
              ORDER BY timestamp DESC
          ) as latest_attack_timestamp
      FROM [s1_eternum-BattleEvent]
      WHERE timestamp > 1757487964
  ),
  latest_defenses AS (
      -- Get latest battles where this army was the attacker
      SELECT DISTINCT
          attacker_id,
          FIRST_VALUE(defender_id) OVER (
              PARTITION BY attacker_id 
              ORDER BY timestamp DESC
          ) as latest_defender_id,
          FIRST_VALUE(timestamp) OVER (
              PARTITION BY attacker_id 
              ORDER BY timestamp DESC
          ) as latest_defense_timestamp
      FROM [s1_eternum-BattleEvent]
      WHERE timestamp > 1757487964
  )
  SELECT 
      et.explorer_id as entity_id,
      et.\`coord.x\` as coord_x,
      et.\`coord.y\` as coord_y,
      et.\`troops.category\` as category,
      et.\`troops.tier\` as tier,
      et.\`troops.count\` as count,
      et.\`troops.stamina.amount\` as stamina_amount,
      et.\`troops.stamina.updated_tick\` as stamina_updated_tick,
      et.\`troops.battle_cooldown_end\` as battle_cooldown_end,
      s.owner as owner_address,
      sos.name as owner_name,
    
      -- Battle data
      lb.latest_attacker_id,
      lb.latest_attack_timestamp,
      ld.latest_defender_id,
      ld.latest_defense_timestamp
    
  FROM [s1_eternum-ExplorerTroops] et
  LEFT JOIN [s1_eternum-Structure] s ON s.entity_id = et.owner
  LEFT JOIN [s1_eternum-StructureOwnerStats] sos ON sos.owner = s.owner
  LEFT JOIN latest_battles lb ON lb.defender_id = et.explorer_id
  LEFT JOIN latest_defenses ld ON ld.attacker_id = et.explorer_id
  ORDER BY et.explorer_id;
  `,
} as const;
