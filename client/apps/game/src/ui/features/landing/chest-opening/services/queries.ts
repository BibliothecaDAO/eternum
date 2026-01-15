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

  // Simpler query for token balances with metadata (used for cosmetics)
  TOKEN_BALANCES_WITH_METADATA: `
  SELECT
    tb.token_id,
    tb.balance,
    tb.contract_address,
    tb.account_address as token_owner,
    t.name,
    t.symbol,
    t.metadata
  FROM token_balances tb
  LEFT JOIN tokens t
    ON t.token_id = substr(tb.token_id, instr(tb.token_id, ':') + 1)
    AND t.contract_address = '{contractAddress}'
  WHERE tb.contract_address = '{contractAddress}'
  AND tb.balance != "0x0000000000000000000000000000000000000000000000000000000000000000"
  AND tb.account_address = '{accountAddress}';
  `,
  COLLECTIBLE_CLAIMED: `
    SELECT *
    FROM [events]
    WHERE keys LIKE '0x006d9857ff29ce02c8a34db3a4387b1438bd738b0b4c17679553432d8fc11ecb/{contractAddress}/%{playerAddress}/'
      AND created_at > {minTimestamp}
    ORDER BY created_at DESC
    limit 3
  `,
};
