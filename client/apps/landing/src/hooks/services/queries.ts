export const QUERIES = {
  REALM_SETTLEMENTS: "SELECT `base.coord_x`, `base.coord_y`, owner FROM [s1_eternum-Structure] WHERE category == 1;",
  REALM_VILLAGE_SLOTS:
    "SELECT `connected_realm_coord.x`, `connected_realm_coord.y`, connected_realm_entity_id, connected_realm_id, directions_left FROM `s1_eternum-StructureVillageSlots`",
  ACTIVE_MARKET_ORDERS: `
    SELECT 
      mo.order_id AS order_id,
      mo."order.token_id" AS token_id, 
      mo."order.price" AS price,
      mo."order.owner" AS owner,
      mo."order.expiration" AS expiration,
      mo."order.collection_id" AS collection_id
    FROM "marketplace-MarketOrderModel" AS mo
    WHERE mo."order.active" = 1
      AND mo."order.collection_id" = 1  
      AND mo."order.token_id" = '{tokenId}'
    ORDER BY mo."order.price" ASC
  `,
  TOKEN_TRANSFERS: `
    WITH token_meta AS ( 
        SELECT contract_address,
               MIN(name)   AS name,
               MIN(symbol) AS symbol
        FROM   tokens
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
    FROM   token_transfers AS tt
    JOIN   token_meta      AS tm
           ON tm.contract_address = tt.contract_address
    WHERE  tt.contract_address = '{contractAddress}'
      AND  tt.to_address      = '{recipientAddress}'
      -- veto any token_id that was EVER sent from the blacklist address
      AND  NOT EXISTS (
              SELECT 1
              FROM   token_transfers AS x
              WHERE  x.contract_address = tt.contract_address
                AND  x.token_id        = tt.token_id  
                AND  x.from_address    = tt.to_address
          );
  `,
  ACTIVE_MARKET_ORDERS_TOTAL: `
      /* ────────────────────────────────────────────────────────────────────────────
      ❶  Count ACTIVE rows in marketplace‑MarketOrderModel
      ❷  Decode each 0x‑hex price in marketplace‑MarketOrderEvent → integer
      ❸  Return the two scalars as one record
      ────────────────────────────────────────────────────────────────────────── */
    WITH
    /* ❶ ----------------------------------------------------------------------- */
    total_active AS (
        SELECT COUNT(*) AS active_order_count
        FROM   "marketplace-MarketOrderModel" AS mo
         JOIN   token_balances tb
           ON  tb.contract_address = "{contractAddress}"
           AND substr(tb.token_id, instr(tb.token_id, ':') + 1) = printf("0x%064x", mo."order.token_id")
           /* normalise both addresses before comparing ---------- */
           AND ltrim(lower(replace(mo."order.owner" , "0x","")), "0")
               = ltrim(lower(replace(tb.account_address, "0x","")), "0")
           AND tb.balance != "0x0000000000000000000000000000000000000000000000000000000000000000"
   
        WHERE  mo."order.active" = 1
        AND    mo."order.collection_id" = {collectionId}
        AND    mo."order.expiration" > strftime('%s','now')
        ),

    /* ❷ ----------------------------------------------------------------------- */
    accepted AS (                           -- only "Accepted" events
        SELECT "market_order.price" AS hex_price
        FROM   "marketplace-MarketOrderEvent"
        WHERE  state = 'Accepted'           -- <- use single quotes for the literal
        AND    "market_order.collection_id" = {collectionId}

    ),

    -- recursive hex‑string → integer
    digits(hex, pos, len, val) AS (
        SELECT lower(substr(hex_price, 3)),      -- strip leading 0x
              1,
              length(substr(hex_price, 3)),
              0
        FROM   accepted
        UNION ALL
        SELECT hex,
              pos + 1,
              len,
              val * 16 +
              instr('0123456789abcdef', substr(hex, pos, 1)) - 1
        FROM   digits
        WHERE  pos <= len
    ),
    decoded AS (                                -- final value for each row
        SELECT val AS wei
        FROM   digits
        WHERE  pos = len + 1
    ),

    total_volume AS (
        SELECT SUM(wei) AS open_orders_total_wei
        FROM   decoded
    )

    /* ❸ ----------------------------------------------------------------------- */
    SELECT
        total_active.active_order_count,
        total_volume.open_orders_total_wei
    FROM   total_active
    CROSS  JOIN total_volume;
  `,
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
  MARKET_ORDER_EVENTS: `
    SELECT 
      moe.internal_event_id,
      moe.internal_executed_at AS executed_at,
      moe.state,
      moe."market_order.token_id" AS token_id,
      moe."market_order.price" AS price,
      moe."market_order.owner" AS owner,
      moe."market_order.expiration" AS expiration,
      t.name,
      t.symbol,
      t.metadata
    FROM "marketplace-MarketOrderEvent" AS moe
    JOIN tokens t
      ON t.token_id = printf("0x%064x", moe."market_order.token_id")  
      AND t.contract_address = '{contractAddress}'
    WHERE moe."market_order.collection_id" = '{collectionId}'
      AND (( '{type}' = 'all' OR '{type}' = '')
           OR ('{type}' = 'listings' AND moe.state <> 'Accepted')
           OR ('{type}' <> 'listings' AND moe.state = '{type}'))
    ORDER BY moe."internal_executed_at" DESC
    LIMIT {limit} OFFSET {offset}
  `,

  TOKEN_BALANCES_WITH_METADATA: `
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
  DONKEY_BURN: `
  SELECT amount
  FROM "s1_eternum-BurnDonkey"
  `,
  TOTAL_GUILDS: `SELECT
    COUNT(*) AS total_guilds
FROM
    "s1_eternum-Guild";`,
  TOTAL_STRUCTURES: `SELECT
    "base.category"  AS category,
    COUNT(*)         AS structure_count
FROM
    "s1_eternum-Structure"
GROUP BY
    "base.category"
ORDER BY
    category;`,
  TOTAL_TROOPS: `WITH RECURSIVE
  digits(d,v) AS (
    VALUES ('0',0),('1',1),('2',2),('3',3),('4',4),('5',5),('6',6),('7',7),
           ('8',8),('9',9),('a',10),('b',11),('c',12),('d',13),('e',14),('f',15)
  ),
  expanded AS (
    SELECT
        "troops.category"     AS category,
        "troops.tier"         AS tier,
        lower(substr("troops.count", 3)) AS hex        -- strip 0x
    FROM   "s1_eternum-ExplorerTroops"
  ),
  explode AS (
    SELECT category, tier, hex,
           length(hex) AS len, 0 AS pos, 0 AS val
    FROM   expanded
    UNION ALL
    SELECT e.category, e.tier, e.hex,
           e.len,
           pos + 1,
           val*16 + d.v
    FROM   explode e
    JOIN   digits  d ON d.d = substr(e.hex, pos+1, 1)
    WHERE  pos < len-1
  )
SELECT
    category,
    tier,
    SUM(val) AS total_troops
FROM   explode
WHERE  pos = len-1
GROUP BY
    category, tier
ORDER BY
    category, tier;
`,
  TOTAL_BATTLES: `-- Total number of battle events
SELECT
    COUNT(*) AS total_battles
FROM
    "s1_eternum-BattleEvent";`,
  TOTAL_ALIVE_AGENTS: `
  SELECT
    SUM("count") AS total_agents
  FROM
    "s1_eternum-AgentCount";`,

  TOTAL_CREATED_AGENTS: `SELECT
    COUNT(*) AS total_agent_created_events
FROM
    "s1_eternum-AgentCreatedEvent";`,
  TOTAL_PLAYERS: `SELECT COUNT(DISTINCT owner) AS unique_wallets
FROM   "s1_eternum-Structure";`,
  TOTAL_TRANSACTIONS: `SELECT COUNT(*) AS total_rows
FROM transactions;`,
};
