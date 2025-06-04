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
    LEFT JOIN \`s1_eternum-Structure\` s ON se.entity_id = s.entity_id
    ORDER BY se.timestamp DESC;
  `,

  TOKEN_TRANSFERS: `
    WITH token_meta AS ( 
        SELECT contract_address,
               MIN(name) AS name,
               MIN(symbol) AS symbol
        FROM tokens
        GROUP BY contract_address
    )
    SELECT
        tt.to_address,
        tt.contract_address,
        tt.token_id,
        tt.amount,
        tt.executed_at,
        tt.from_address,
        tm.name,
        tm.symbol
    FROM token_transfers AS tt
    JOIN token_meta AS tm ON tm.contract_address = tt.contract_address
    WHERE tt.contract_address = '{contractAddress}'
      AND tt.to_address = '{recipientAddress}'
      -- veto any token_id that was EVER sent from the blacklist address
      AND NOT EXISTS (
              SELECT 1
              FROM token_transfers AS x
              WHERE x.contract_address = tt.contract_address
                AND x.token_id = tt.token_id  
                AND x.from_address = tt.to_address
          );
  `,
} as const;
