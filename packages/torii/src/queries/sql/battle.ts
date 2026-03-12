export const BATTLE_QUERIES = {
  EXPLORER_ADDRESS_OWNER: `
    SELECT s.owner as address_owner
    FROM \`s1_eternum-ExplorerTroops\` e
    JOIN \`s1_eternum-Structure\` s ON e.owner = s.entity_id
    WHERE e.explorer_id = {entityId};
  `,

  EXPLORER_BY_ID: `
    SELECT
      e.explorer_id,
      e.owner,
      e.\`troops.category\` AS troop_category,
      e.\`troops.tier\` AS troop_tier,
      e.\`troops.count\` AS troop_count,
      e.\`troops.stamina.amount\` AS max_stamina,
      e.\`troops.stamina.updated_tick\` AS last_refill_tick,
      e.\`coord.x\` AS coord_x,
      e.\`coord.y\` AS coord_y,
      s.owner AS owner_address,
      sos.name AS owner_name
    FROM \`s1_eternum-ExplorerTroops\` e
    LEFT JOIN \`s1_eternum-Structure\` s ON s.entity_id = e.owner
    LEFT JOIN \`s1_eternum-StructureOwnerStats\` sos ON sos.owner = s.owner
    WHERE e.explorer_id = {entityId};
  `,

  EXPLORERS_BY_IDS: `
    SELECT
      e.explorer_id,
      e.owner,
      e.\`troops.category\` AS troop_category,
      e.\`troops.tier\` AS troop_tier,
      e.\`troops.count\` AS troop_count,
      e.\`troops.stamina.amount\` AS max_stamina,
      e.\`troops.stamina.updated_tick\` AS last_refill_tick,
      e.\`coord.x\` AS coord_x,
      e.\`coord.y\` AS coord_y,
      s.owner AS owner_address,
      sos.name AS owner_name
    FROM \`s1_eternum-ExplorerTroops\` e
    LEFT JOIN \`s1_eternum-Structure\` s ON s.entity_id = e.owner
    LEFT JOIN \`s1_eternum-StructureOwnerStats\` sos ON sos.owner = s.owner
    WHERE e.explorer_id IN ({explorerIds});
  `,

  BATTLE_LOGS: `
    SELECT 
        'ExplorerNewRaidEvent' as event_type,
        explorer_id as attacker_id,
        structure_id as defender_id,
        explorer_owner_id as attacker_owner_id,
        NULL as defender_owner_id,
        NULL as winner_id,
        NULL as max_reward,
        success,
        timestamp
    FROM [s1_eternum-ExplorerNewRaidEvent]
    {whereClause}
    UNION ALL
    SELECT 
        'BattleEvent' as event_type,
        attacker_id,
        defender_id,
        attacker_owner as attacker_owner_id,
        defender_owner as defender_owner_id,
        winner_id,
        max_reward,
        NULL as success,
        timestamp
    FROM [s1_eternum-BattleEvent]
    {whereClause}
    ORDER BY timestamp DESC
  `,
} as const;
