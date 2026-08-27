// {GF:alias} markers resolve to the active game filter (see applySqlGameScope).
export const BATTLE_QUERIES = {
  EXPLORER_ADDRESS_OWNER: `
    SELECT s.owner as address_owner
    FROM \`s1_eternum-ExplorerTroops\` e
    JOIN \`s1_eternum-Structure\` s ON e.owner = s.entity_id
    WHERE {GF:e} AND {GF:s} AND e.explorer_id = {entityId};
  `,
} as const;
