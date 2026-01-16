export const QUERIES = {
  // Query for token balances with marketplace order data (used for loot chests)
  TOKEN_BALANCES_WITH_MARKETPLACE: `
  WITH active_orders AS (
    SELECT
      printf("0x%064x", mo."order.token_id") AS token_id_hex,
      mo."order.price" AS price,
      mo."order.expiration" AS expiration,
      mo."order.owner" AS order_owner,
      mo.order_id
    FROM "marketplace-MarketOrderModel" AS mo
    WHERE mo."order.active" = 1
      AND mo."order.owner" = '{accountAddress}'
      AND  mo."order.expiration" > strftime('%s','now')
      AND  mo."order.collection_id" = {collectionId}
    GROUP BY token_id_hex
  )
  SELECT
    tb.token_id,
    tb.balance,
    tb.contract_address,
    tb.account_address as token_owner,
    t.name,
    t.symbol,
    t.metadata,
    ao.price as best_price_hex,
    ao.expiration,
    ao.order_owner,
    ao.order_id
  FROM token_balances tb
  LEFT JOIN tokens t
    ON t.token_id = substr(tb.token_id, instr(tb.token_id, ':') + 1)
    AND t.contract_address = '{contractAddress}'
  LEFT JOIN active_orders ao
    ON ao.token_id_hex = substr(tb.token_id, instr(tb.token_id, ':') + 1)
  WHERE tb.contract_address = '{contractAddress}'
  AND tb.balance != "0x0000000000000000000000000000000000000000000000000000000000000000"
  AND tb.account_address = '{trimmedAccountAddress}';
  `,

  // Grouped query for cosmetics - aggregates by attributes (not full metadata which has unique name)
  TOKEN_BALANCES_WITH_METADATA: `
  SELECT
    MIN(tb.token_id) as token_id,
    MIN(tb.balance) as balance,
    MIN(tb.contract_address) as contract_address,
    MIN(tb.account_address) as token_owner,
    MIN(t.name) as name,
    MIN(t.symbol) as symbol,
    MIN(t.metadata) as metadata,
    COUNT(*) as count
  FROM token_balances tb
  LEFT JOIN tokens t
    ON t.token_id = substr(tb.token_id, instr(tb.token_id, ':') + 1)
    AND t.contract_address = '{contractAddress}'
  WHERE tb.contract_address = '{contractAddress}'
  AND tb.balance != "0x0000000000000000000000000000000000000000000000000000000000000000"
  AND tb.account_address = '{accountAddress}'
  GROUP BY json_extract(t.metadata, '$.attributes');
  `,
  COLLECTIBLE_CLAIMED: `
    WITH recent_transfers AS (
      SELECT 
        tt.token_id,
        tt.executed_at,
        tt.contract_address,
        tt.from_address,
        tt.to_address
      FROM token_transfers tt
      WHERE tt.contract_address = '{contractAddress}'
        AND tt.from_address = '0x0000000000000000000000000000000000000000000000000000000000000000'
        AND tt.to_address = '{playerAddress}'
        AND tt.executed_at > {minTimestamp}
      ORDER BY tt.executed_at DESC
      LIMIT 10
    )
    SELECT 
      rt.token_id,
      rt.executed_at,
      rt.contract_address,
      rt.from_address,
      rt.to_address,
      t.metadata
    FROM recent_transfers rt
    LEFT JOIN tokens t ON t.token_id = rt.token_id 
      AND t.contract_address = rt.contract_address
    ORDER BY rt.executed_at DESC
  `,

  // Query for total unique cosmetic types across all users
  TOTAL_COSMETICS_SUPPLY: `
  SELECT COUNT(DISTINCT json_extract(t.metadata, '$.attributes')) as total
  FROM tokens t
  WHERE t.contract_address = '{contractAddress}'
    AND t.metadata IS NOT NULL;
  `,
};
