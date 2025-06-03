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
} as const;
