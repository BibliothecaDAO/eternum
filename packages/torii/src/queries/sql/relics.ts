export const RELICS_QUERIES = {
  /**
   * Fetch all chest tiles within a square radius of a given position
   * Chests have occupier_type = 39
   */
  CHESTS_NEAR_POSITION: `
    SELECT
      data
    FROM \`s1_eternum-TileOpt\`
    WHERE col >= {minX}
      AND col <= {maxX}
      AND row >= {minY}
      AND row <= {maxY};
  `,

  /**
   * Fetch all relics (resources with ID between 39 and 56) owned by a player's structures
   * Groups by entity to get all relics per structure
   */
  PLAYER_STRUCTURE_RELICS: `
    SELECT 
      s.entity_id,
      s.category AS entity_type,
      s.\`base.coord_x\` AS coord_x,
      s.\`base.coord_y\` AS coord_y,
      s.\`metadata.realm_id\` AS realm_id,
      r.*
    FROM \`s1_eternum-Structure\` s
    INNER JOIN \`s1_eternum-Resource\` r ON s.entity_id = r.entity_id
    WHERE s.owner = '{owner}'
      AND (
        (r.RELIC_E1_BALANCE > 0) OR (r.RELIC_E2_BALANCE > 0) OR (r.RELIC_E3_BALANCE > 0) OR
        (r.RELIC_E4_BALANCE > 0) OR (r.RELIC_E5_BALANCE > 0) OR (r.RELIC_E6_BALANCE > 0) OR
        (r.RELIC_E7_BALANCE > 0) OR (r.RELIC_E8_BALANCE > 0) OR (r.RELIC_E9_BALANCE > 0) OR
        (r.RELIC_E10_BALANCE > 0) OR (r.RELIC_E11_BALANCE > 0) OR (r.RELIC_E12_BALANCE > 0) OR
        (r.RELIC_E13_BALANCE > 0) OR (r.RELIC_E14_BALANCE > 0) OR (r.RELIC_E15_BALANCE > 0) OR
        (r.RELIC_E16_BALANCE > 0) OR (r.RELIC_E17_BALANCE > 0) OR (r.RELIC_E18_BALANCE > 0)
      )
    ORDER BY s.entity_id;
  `,

  /**
   * Fetch all relics owned by a player's armies (explorers)
   * Groups by entity to get all relics per army
   * Joins with Structure on structure.entity_id = explorer.owner and filters by structure.owner = {owner}
   */
  PLAYER_ARMY_RELICS: `
    SELECT 
      e.explorer_id AS entity_id,
      e.\`coord.x\` AS coord_x,
      e.\`coord.y\` AS coord_y,
      e.\`troops.category\` AS troop_category,
      e.\`troops.tier\` AS troop_tier,
      e.owner AS owner,
      r.*
    FROM \`s1_eternum-ExplorerTroops\` e
    INNER JOIN \`s1_eternum-Resource\` r ON e.explorer_id = r.entity_id
    INNER JOIN \`s1_eternum-Structure\` s ON s.entity_id = e.owner
    WHERE s.owner = '{owner}'
      AND (
        (r.RELIC_E1_BALANCE > 0) OR (r.RELIC_E2_BALANCE > 0) OR (r.RELIC_E3_BALANCE > 0) OR
        (r.RELIC_E4_BALANCE > 0) OR (r.RELIC_E5_BALANCE > 0) OR (r.RELIC_E6_BALANCE > 0) OR
        (r.RELIC_E7_BALANCE > 0) OR (r.RELIC_E8_BALANCE > 0) OR (r.RELIC_E9_BALANCE > 0) OR
        (r.RELIC_E10_BALANCE > 0) OR (r.RELIC_E11_BALANCE > 0) OR (r.RELIC_E12_BALANCE > 0) OR
        (r.RELIC_E13_BALANCE > 0) OR (r.RELIC_E14_BALANCE > 0) OR (r.RELIC_E15_BALANCE > 0) OR
        (r.RELIC_E16_BALANCE > 0) OR (r.RELIC_E17_BALANCE > 0) OR (r.RELIC_E18_BALANCE > 0)
      )
    ORDER BY e.explorer_id;
  `,

  ENTITY_RELIC_EFFECTS: `
    SELECT 
      entity_id,
      effect_resource_id,
      effect_rate,
      effect_start_tick,
      effect_end_tick,
      effect_usage_left
    FROM \`s1_eternum-RelicEffect\` WHERE entity_id = {entityId};
  `,
} as const;
