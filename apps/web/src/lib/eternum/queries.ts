export const QUERIES = {
  OPEN_ORDERS_BY_PRICE: `
      /* Paginated active orders query:
         1. Fetch X active orders from marketplace joined with token_balances, ordered by price.
         2. Join the resulting limited orders with the tokens table to retrieve token details.
      */
  WITH limited_active_orders AS (
      SELECT
          printf("0x%064x", mo."order.token_id")                              AS token_id_hex,  -- pad to 66 chars
          mo."order.price"                                                    AS price_hex,
          mo."order.expiration"                                               AS expiration,
          mo."order.owner"                                                    AS order_owner,
          mo.order_id,
          tb.account_address                                                 AS token_owner,
          tb.token_id,
          tb.balance
      FROM   "marketplace-MarketOrderModel"  AS mo
      /* join the current balances table to prove ownership --------- */
      JOIN   token_balances tb
             ON  tb.contract_address = "{contractAddress}"
             AND substr(tb.token_id, instr(tb.token_id, ':') + 1) = printf("0x%064x", mo."order.token_id")
             /* normalise both addresses before comparing ---------- */
             AND ltrim(lower(replace(mo."order.owner" , "0x","")), "0")
                 = ltrim(lower(replace(tb.account_address, "0x","")), "0")
             AND tb.balance != "0x0000000000000000000000000000000000000000000000000000000000000000"
             AND tb.contract_address = "{contractAddress}"
      WHERE  mo."order.active" = 1
        AND  mo."order.expiration" > strftime('%s','now')
        AND  mo."order.collection_id" = {collectionId}
        AND  ('{ownerAddress}' = '' OR mo."order.owner" = '{ownerAddress}')
      GROUP  BY token_id_hex
      )
  
  
      SELECT
          lao.token_id_hex AS token_id_hex,
          lao.token_id,
          t.name,
          t.symbol,
          t.metadata,
          t.contract_address,
          lao.token_owner AS account_address,
          lao.price_hex,
          lao.expiration,
          lao.order_owner,
          lao.order_id,
          lao.balance
      FROM limited_active_orders lao
      LEFT JOIN (SELECT id, token_id, name, symbol, contract_address, MAX(metadata) AS metadata FROM tokens GROUP BY id) t
        ON t.id = lao.token_id
        AND t.contract_address = "{contractAddress}"
      ORDER BY lao.price_hex IS NULL, lao.price_hex 
  
    `,
  SEASON_PASS_REALMS_BY_ADDRESS: `
      SELECT substr(r.token_id, instr(r.token_id, ':') + 1) AS token_id,
             r.balance,
             r.contract_address,
             r.account_address,
             sp.balance AS season_pass_balance,
             t.metadata as metadata
      FROM token_balances r
      LEFT JOIN token_balances sp
        ON sp.contract_address = '{seasonPassAddress}'
        AND sp.account_address = '{accountAddress}'
        AND substr(r.token_id, instr(r.token_id, ':') + 1) = substr(sp.token_id, instr(sp.token_id, ':') + 1)
      LEFT JOIN (SELECT token_id, MAX(metadata) AS metadata FROM tokens GROUP BY token_id) t
        ON t.token_id = substr(r.token_id, instr(r.token_id, ':') + 1)
      WHERE r.contract_address = '{realmsAddress}'
        AND r.account_address = '{accountAddress}'
    `,

  TOKEN_BALANCES_WITH_METADATA: `
    WITH params AS (
      SELECT
        ltrim(lower(replace('{contractAddress}', '0x', '')), '0') AS contract_address_norm,
        ltrim(lower(replace('{accountAddress}', '0x', '')), '0') AS account_address_norm
    ),
    scoped_balances AS (
      SELECT
        tb.token_id,
        tb.balance,
        tb.contract_address,
        tb.account_address
      FROM token_balances tb
      CROSS JOIN params p
      WHERE ltrim(lower(replace(tb.contract_address, '0x', '')), '0') = p.contract_address_norm
        AND ltrim(lower(replace(tb.account_address, '0x', '')), '0') = p.account_address_norm
        AND tb.balance != "0x0000000000000000000000000000000000000000000000000000000000000000"
    ),
    token_metadata AS (
      SELECT
        t.token_id,
        t.contract_address,
        MAX(t.name) AS name,
        MAX(t.symbol) AS symbol,
        MAX(t.metadata) AS metadata
      FROM tokens t
      CROSS JOIN params p
      WHERE ltrim(lower(replace(t.contract_address, '0x', '')), '0') = p.contract_address_norm
      GROUP BY t.token_id, t.contract_address
    ),
    active_orders AS (
      SELECT
        printf("0x%064x", mo."order.token_id") AS token_id_hex,
        mo."order.price" AS price,
        mo."order.expiration" AS expiration,
        mo."order.owner" AS order_owner,
        mo.order_id
      FROM "marketplace-MarketOrderModel" AS mo
      CROSS JOIN params p
      WHERE mo."order.active" = 1
        AND ltrim(lower(replace(mo."order.owner", '0x', '')), '0') = p.account_address_norm
        AND mo."order.expiration" > strftime('%s','now')
        AND mo."order.collection_id" = {collectionId}
      GROUP BY token_id_hex
    )
    SELECT
      sb.token_id,
      sb.balance,
      sb.contract_address,
      sb.account_address as token_owner,
      t.name,
      t.symbol,
      t.metadata,
      ao.price as best_price_hex,
      ao.expiration,
      ao.order_owner,
      ao.order_id
    FROM scoped_balances sb
    LEFT JOIN token_metadata t
      ON t.token_id = substr(sb.token_id, instr(sb.token_id, ':') + 1)
    LEFT JOIN active_orders ao
      ON ao.token_id_hex = substr(sb.token_id, instr(sb.token_id, ':') + 1);
    `,
};
