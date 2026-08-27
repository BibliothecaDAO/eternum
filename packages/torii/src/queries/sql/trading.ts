export const TRADING_QUERIES = {
  SWAP_EVENTS: `
    SELECT 
      se.entity_id,
      se.resource_type,
      se.lords_amount,
      se.resource_amount,
      se.resource_price,
      se.buy,
      se.timestamp,
      s.owner
    FROM \`s1_eternum-SwapEvent\` se
    LEFT JOIN \`s1_eternum-Structure\` s ON se.entity_id = s.entity_id AND {GF:s}
    WHERE {GF:se}
    ORDER BY se.timestamp DESC;
  `,
} as const;
