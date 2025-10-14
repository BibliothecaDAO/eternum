export const QUERIES = {
  GAME_STATUS: `
    SELECT 
      "blitz_registration_config.registration_start_at" AS registration_start_at,
      "season_config.start_main_at" AS registration_end_at,
      "season_config.start_main_at" AS creation_start_at,
      "season_config.end_at" AS creation_end_at
    FROM "s1_eternum-WorldConfig"
  `,
  REALM_SETTLEMENTS: "SELECT `base.coord_x`, `base.coord_y`, owner FROM [s1_eternum-Structure] WHERE category == 1;",
  REALM_VILLAGE_SLOTS:
    "SELECT `connected_realm_coord.x`, `connected_realm_coord.y`, connected_realm_entity_id, connected_realm_id, directions_left FROM `s1_eternum-StructureVillageSlots`",
  SEASON_CONFIG: `
    SELECT 
      "season_config.start_settling_at" AS start_settling_at,
      "season_config.start_main_at" AS start_main_at,
      "season_config.end_at" AS end_at,
      "season_config.end_grace_seconds" AS end_grace_seconds,
      "season_config.registration_grace_seconds" AS registration_grace_seconds
    FROM "s1_eternum-WorldConfig"
  `,
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
      AND mo."order.collection_id" = {collectionId}  
      AND mo."order.token_id" IN ({tokenIds})
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
  COLLECTION_STATISTICS: `
      /* Fast collection stats: count active orders + get floor price.
         We avoid recursive hex decoding and heavy joins. The price column
         is stored as a fixed 0x-prefixed, zero-padded 64-hex string, so
         MIN(price) yields the numeric floor. */
      WITH active_orders AS (
        SELECT mo."order.price" AS price_hex
        FROM   "marketplace-MarketOrderModel" AS mo
        WHERE  mo."order.active" = 1
          AND  mo."order.collection_id" = {collectionId}
          AND  mo."order.expiration" > strftime('%s','now')
      )
      SELECT
        COUNT(*)               AS active_order_count,
        NULL                   AS open_orders_total_wei, -- computed client-side
        MIN(price_hex)         AS floor_price_wei
      FROM active_orders;
  `,
  /* Prices for Accepted events only; summed client-side as BigInt */
  COLLECTION_ACCEPTED_EVENT_PRICES: `
    SELECT "market_order.price" AS price_hex
    FROM   "marketplace-MarketOrderEvent"
    WHERE  state = 'Accepted'
      AND  "market_order.collection_id" = {collectionId}
  `,
  /* Fast active count + floor using a stricter ownership check via EXISTS.
     Keep around in case we want correctness over speed on some pages. */
  COLLECTION_ACTIVE_AND_FLOOR_WITH_OWNERSHIP: `
    WITH active_orders AS (
      SELECT mo."order.price" AS price_hex
      FROM   "marketplace-MarketOrderModel" AS mo
      WHERE  mo."order.active" = 1
        AND  mo."order.collection_id" = {collectionId}
        AND  mo."order.expiration" > strftime('%s','now')
        AND  EXISTS (
               SELECT 1
               FROM   token_balances tb
               WHERE  tb.contract_address = "{contractAddress}"
                 AND  tb.token_id = printf("{contractAddress}:%s", printf("0x%064x", mo."order.token_id"))
                 AND  lower(tb.account_address) = lower(mo."order.owner")
                 AND  tb.balance != "0x0000000000000000000000000000000000000000000000000000000000000000"
             )
    )
    SELECT
      COUNT(*)       AS active_order_count,
      MIN(price_hex) AS floor_price_wei
    FROM active_orders
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
  ALL_COLLECTION_TOKENS: `
    /* Deprecated: kept for reference. Use ALL_COLLECTION_TOKENS_LISTED or ALL_COLLECTION_TOKENS_FULL_PAGED. */
    SELECT 1 WHERE 0
  `,
  /* Listed-only, page first then hydrate metadata. Supports traitFilters (on tokens metadata) and ordering. */
  ALL_COLLECTION_TOKENS_LISTED: `
    WITH active_orders AS (
      SELECT
        printf('0x%064x', mo."order.token_id") AS token_id_hex,
        mo."order.price" AS price_hex,
        mo."order.expiration" AS expiration,
        mo."order.owner" AS order_owner,
        mo.order_id
      FROM "marketplace-MarketOrderModel" AS mo
      WHERE mo."order.active" = 1
        AND mo."order.collection_id" = {collectionId}
        AND mo."order.expiration" > strftime('%s','now')
        AND ('{ownerAddress}' = '' OR mo."order.owner" = '{ownerAddress}')
    ),
    paged AS (
      SELECT token_id_hex
      FROM active_orders
      {listedOrderByPaged}
      {limitOffsetClause}
    ),
    tokens_latest AS (
      SELECT token_id, name, symbol, contract_address, MAX(metadata) AS metadata
      FROM tokens
      WHERE contract_address = '{contractAddress}'
        AND token_id IN (SELECT token_id_hex FROM paged)
      GROUP BY token_id
    )
    SELECT
      a.token_id_hex,
      substr(a.token_id_hex, 3) AS token_id,
      1 AS is_listed,
      NULL AS token_owner,
      a.price_hex,
      a.expiration,
      a.order_owner,
      a.order_id,
      NULL AS balance,
      t.name,
      t.symbol,
      t.metadata,
      '{contractAddress}' AS contract_address
    FROM paged p
    JOIN active_orders a ON a.token_id_hex = p.token_id_hex
    LEFT JOIN tokens_latest t ON t.token_id = a.token_id_hex
    WHERE 1=1
      {traitFilters}
    {listedOrderByFinal}
  `,
  ALL_COLLECTION_TOKENS_LISTED_COUNT: `
    WITH active_orders AS (
      SELECT printf('0x%064x', mo."order.token_id") AS token_id_hex
      FROM "marketplace-MarketOrderModel" AS mo
      WHERE mo."order.active" = 1
        AND mo."order.collection_id" = {collectionId}
        AND mo."order.expiration" > strftime('%s','now')
        AND ('{ownerAddress}' = '' OR mo."order.owner" = '{ownerAddress}')
    ),
    tokens_latest AS (
      SELECT token_id, MAX(metadata) AS metadata
      FROM tokens
      WHERE contract_address = '{contractAddress}'
      GROUP BY token_id
    )
    SELECT COUNT(*) AS total_count
    FROM active_orders a
    LEFT JOIN tokens_latest t ON t.token_id = a.token_id_hex
    WHERE 1=1
      {traitFilters}
  `,
  /* Full view: union owned + listed, page first, then hydrate metadata. */
  ALL_COLLECTION_TOKENS_FULL_PAGED: `
    WITH active_orders AS (
      SELECT
        printf('0x%064x', mo."order.token_id") AS token_id_hex,
        mo."order.price" AS price_hex,
        mo."order.expiration" AS expiration,
        mo."order.owner" AS order_owner,
        mo.order_id
      FROM "marketplace-MarketOrderModel" AS mo
      WHERE mo."order.active" = 1
        AND mo."order.collection_id" = {collectionId}
        AND mo."order.expiration" > strftime('%s','now')
        AND ('{ownerAddress}' = '' OR mo."order.owner" = '{ownerAddress}')
    ),
    owned_tokens AS (
      SELECT DISTINCT
        substr(tb.token_id, instr(tb.token_id, ':') + 1) AS token_id_hex,
        tb.account_address AS token_owner,
        tb.balance
      FROM token_balances tb
      WHERE tb.contract_address = '{contractAddress}'
        AND tb.balance != '0x0000000000000000000000000000000000000000000000000000000000000000'
    ),
    collection_tokens AS (
      SELECT 
        ot.token_id_hex,
        ot.token_owner,
        ot.balance,
        ao.price_hex,
        ao.expiration,
        ao.order_owner,
        ao.order_id,
        CASE WHEN ao.order_id IS NOT NULL THEN 1 ELSE 0 END AS is_listed
      FROM owned_tokens ot
      LEFT JOIN active_orders ao ON ao.token_id_hex = ot.token_id_hex
      UNION ALL
      SELECT 
        ao.token_id_hex,
        NULL AS token_owner,
        NULL AS balance,
        ao.price_hex,
        ao.expiration,
        ao.order_owner,
        ao.order_id,
        1 AS is_listed
      FROM active_orders ao
      WHERE NOT EXISTS (
        SELECT 1 FROM owned_tokens ot WHERE ot.token_id_hex = ao.token_id_hex
      )
    ),
    paged AS (
      SELECT token_id_hex
      FROM collection_tokens
      {fullOrderByPaged}
      {limitOffsetClause}
    ),
    tokens_latest AS (
      SELECT token_id, name, symbol, contract_address, MAX(metadata) AS metadata
      FROM tokens
      WHERE contract_address = '{contractAddress}'
        AND token_id IN (SELECT token_id_hex FROM paged)
      GROUP BY token_id
    )
    SELECT
      ct.token_id_hex,
      substr(ct.token_id_hex, 3) AS token_id,
      ct.is_listed,
      ct.token_owner,
      ct.price_hex,
      ct.expiration,
      ct.order_owner,
      ct.order_id,
      ct.balance,
      t.name,
      t.symbol,
      t.metadata,
      '{contractAddress}' AS contract_address
    FROM paged p
    JOIN collection_tokens ct ON ct.token_id_hex = p.token_id_hex
    LEFT JOIN tokens_latest t ON t.token_id = ct.token_id_hex
    WHERE 1=1
      {traitFilters}
    {fullOrderByFinal}
  `,
  ALL_COLLECTION_TOKENS_FULL_COUNT: `
    WITH active_orders AS (
      SELECT printf('0x%064x', mo."order.token_id") AS token_id_hex
      FROM "marketplace-MarketOrderModel" AS mo
      WHERE mo."order.active" = 1
        AND mo."order.collection_id" = {collectionId}
        AND mo."order.expiration" > strftime('%s','now')
        AND ('{ownerAddress}' = '' OR mo."order.owner" = '{ownerAddress}')
    ),
    owned_tokens AS (
      SELECT DISTINCT substr(tb.token_id, instr(tb.token_id, ':') + 1) AS token_id_hex
      FROM token_balances tb
      WHERE tb.contract_address = '{contractAddress}'
        AND tb.balance != '0x0000000000000000000000000000000000000000000000000000000000000000'
    ),
    all_tokens AS (
      SELECT token_id_hex FROM owned_tokens
      UNION
      SELECT token_id_hex FROM active_orders
    ),
    tokens_latest AS (
      SELECT token_id, MAX(metadata) AS metadata
      FROM tokens
      WHERE contract_address = '{contractAddress}'
      GROUP BY token_id
    )
    SELECT COUNT(*) AS total_count
    FROM all_tokens at
    LEFT JOIN tokens_latest t ON t.token_id = at.token_id_hex
    WHERE 1=1
      {traitFilters}
  `,
  ALL_COLLECTION_TOKENS_COUNT: `
    /* Count total tokens matching filters for pagination */
    WITH active_orders AS (
      SELECT
        printf("0x%064x", mo."order.token_id") AS token_id_hex,
        mo."order.price" AS price_hex,
        mo."order.expiration" AS expiration,
        mo."order.owner" AS order_owner,
        mo.order_id
      FROM "marketplace-MarketOrderModel" AS mo
      WHERE mo."order.active" = 1
        AND mo."order.expiration" > strftime('%s','now')
        AND mo."order.collection_id" = {collectionId}
        AND ('{ownerAddress}' = '' OR mo."order.owner" = '{ownerAddress}')
    ),
    owned_tokens AS (
      SELECT DISTINCT
        substr(tb.token_id, instr(tb.token_id, ':') + 1) AS token_id_hex
      FROM token_balances tb
      WHERE tb.contract_address = '{contractAddress}'
        AND tb.balance != "0x0000000000000000000000000000000000000000000000000000000000000000"
    ),
    all_tokens AS (
      /* Combine owned and listed tokens - avoid full tokens table scan */
      SELECT token_id_hex FROM owned_tokens
      UNION
      SELECT token_id_hex FROM active_orders
    ),
    token_metadata AS (
      /* Only get metadata for tokens we care about */
      SELECT t.token_id AS token_id_hex
      FROM tokens t
      INNER JOIN all_tokens at ON at.token_id_hex = t.token_id
      WHERE t.contract_address = '{contractAddress}'
        AND t.token_id != '0x0000000000000000000000000000000000000000000000000000000000000000'
        {traitFilters}
    ),
    final_tokens AS (
      SELECT tm.token_id_hex
      FROM token_metadata tm
      INNER JOIN all_tokens at ON at.token_id_hex = tm.token_id_hex
      WHERE 1=1
        {listedOnlyFilter}
    )
    SELECT COUNT(*) as total_count FROM final_tokens
  `,
  COLLECTIBLE_CLAIMED: `
    SELECT *
    FROM [events]
    WHERE keys LIKE '0x6d9857ff29ce02c8a34db3a4387b1438bd738b0b4c17679553432d8fc11ecb/{contractAddress}/%{playerAddress}/'
      AND created_at > {minTimestamp}
    ORDER BY created_at DESC
  `,
  SINGLE_COLLECTION_TOKEN: `
    /* Fetch a single token by ID with listing status and current owner */
    WITH active_orders AS (
      SELECT
        printf("0x%064x", mo."order.token_id") AS token_id_hex,
        mo."order.price" AS price_hex,
        mo."order.expiration" AS expiration,
        mo."order.owner" AS order_owner,
        mo.order_id
      FROM "marketplace-MarketOrderModel" AS mo
      WHERE mo."order.active" = 1
        AND mo."order.expiration" > strftime('%s','now')
        AND mo."order.collection_id" = {collectionId}
        AND mo."order.token_id" = {tokenId}
    ),
    current_owner AS (
      SELECT
        tb.account_address AS token_owner,
        tb.balance,
        substr(tb.token_id, instr(tb.token_id, ':') + 1) AS token_id_hex
      FROM token_balances tb
      WHERE tb.contract_address = '{contractAddress}'
        AND substr(tb.token_id, instr(tb.token_id, ':') + 1) = printf("0x%064x", {tokenId})
        AND tb.balance != "0x0000000000000000000000000000000000000000000000000000000000000000"
      ORDER BY tb.balance DESC
      LIMIT 1
    )
    SELECT
      t.token_id AS token_id_hex,
      substr(t.token_id, 3) AS token_id,
      t.name,
      t.symbol,
      t.metadata,
      t.contract_address,
      CASE WHEN ao.order_id IS NOT NULL THEN 1 ELSE 0 END AS is_listed,
      co.token_owner,
      ao.price_hex,
      ao.expiration,
      ao.order_owner,
      ao.order_id,
      co.balance
    FROM tokens t
    LEFT JOIN active_orders ao
      ON ao.token_id_hex = t.token_id
    LEFT JOIN current_owner co
      ON co.token_id_hex = t.token_id
    WHERE t.contract_address = '{contractAddress}'
      AND t.token_id = printf("0x%064x", {tokenId})
  `,
  DONKEY_BURN: `
    SELECT 
        json_extract(data, '$.amount') as amount
    FROM 
        event_messages_historical 
    WHERE 
        model_id = '0x4a1aac57c8cb6ec732bd40283fd1a892987d708a6b8a7d3a4dd65da6f0e7700'
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
  HYPERSTRUCTURE_LEADERBOARD_CONFIG: `
    SELECT
      "victory_points_grant_config.hyp_points_per_second" AS points_per_second,
      "season_config.end_at" AS season_end,
      COALESCE("realm_count_config.count", 0) AS realm_count
    FROM "s1_eternum-WorldConfig";
  `,
  HYPERSTRUCTURE_SHAREHOLDERS: `
    SELECT
      hyperstructure_id,
      start_at,
      shareholders
    FROM "s1_eternum-HyperstructureShareholders";
  `,
  HYPERSTRUCTURES_WITH_REALM_COUNT: `
    SELECT 
        h.entity_id AS hyperstructure_entity_id,
        h."base.coord_x" AS hyperstructure_coord_x,
        h."base.coord_y" AS hyperstructure_coord_y,
        COUNT(
            CASE 
                WHEN r.category = 1 
                AND (
                    (r."base.coord_x" - h."base.coord_x") * (r."base.coord_x" - h."base.coord_x") +
                    (r."base.coord_y" - h."base.coord_y") * (r."base.coord_y" - h."base.coord_y")
                ) <= ({radius} * {radius})
                THEN 1 
                ELSE NULL 
            END
        ) AS realm_count_within_radius
    FROM "s1_eternum-Structure" AS h
    LEFT JOIN "s1_eternum-Structure" AS r ON r.category = 1
    WHERE h.category = 2
    GROUP BY h.entity_id, h."base.coord_x", h."base.coord_y"
    ORDER BY h.entity_id;
  `,
  HYPERSTRUCTURES_WITH_MULTIPLIER: `
    SELECT
      hyperstructure_id,
      points_multiplier
    FROM "s1_eternum-Hyperstructure";
  `,
  PLAYER_LEADERBOARD: `
    WITH RECURSIVE
      registered AS (
        SELECT
          lower(COALESCE(
            NULLIF("address", 'address'),
            NULLIF("player_registered_points.address", 'player_registered_points.address'),
            ''
          )) AS player_address,
          CASE
            WHEN lower(COALESCE(
              NULLIF("registered_points", 'registered_points'),
              NULLIF("player_registered_points.registered_points", 'player_registered_points.registered_points'),
              '0x0'
            )) LIKE '0x%'
            THEN substr(lower(COALESCE(
              NULLIF("registered_points", 'registered_points'),
              NULLIF("player_registered_points.registered_points", 'player_registered_points.registered_points'),
              '0x0'
            )), 3)
            ELSE lower(COALESCE(
              NULLIF("registered_points", 'registered_points'),
              NULLIF("player_registered_points.registered_points", 'player_registered_points.registered_points'),
              '0x0'
            ))
          END AS hex_points,
          COALESCE(
            NULLIF("prize_claimed", 'prize_claimed'),
            NULLIF("player_registered_points.prize_claimed", 'player_registered_points.prize_claimed'),
            0
          ) AS prize_claimed
        FROM "s1_eternum-PlayerRegisteredPoints"
      ),
      decoded AS (
        SELECT
          player_address,
          hex_points,
          prize_claimed,
          length(hex_points) AS hex_length,
          0 AS idx,
          0 AS points
        FROM registered
        UNION ALL
        SELECT
          d.player_address,
          d.hex_points,
          d.prize_claimed,
          d.hex_length,
          d.idx + 1,
          d.points * 16 + CASE
            WHEN instr('0123456789abcdef', substr(d.hex_points, d.idx + 1, 1)) = 0 THEN 0
            ELSE instr('0123456789abcdef', substr(d.hex_points, d.idx + 1, 1)) - 1
          END
        FROM decoded AS d
        WHERE d.idx < d.hex_length
      ),
      totals AS (
        SELECT
          player_address,
          prize_claimed,
          points AS registered_points
        FROM decoded
        WHERE idx = hex_length
      )
    SELECT
      totals.player_address,
      totals.registered_points,
      totals.prize_claimed,
      COALESCE(
        NULLIF("name", 'name'),
        NULLIF("address_name.name", 'address_name.name'),
        ''
      ) AS player_name
    FROM totals
    LEFT JOIN "s1_eternum-AddressName"
      ON lower(COALESCE(
        NULLIF("address", 'address'),
        NULLIF("address_name.address", 'address_name.address'),
        ''
      )) = totals.player_address
    ORDER BY registered_points DESC, totals.player_address
    LIMIT {limit}
    OFFSET {offset};
  `,
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
  COLLECTION_TRAITS: `
    /* Faster: de-dupe per token_id and use json_each(path); no ORDER BY */
    WITH token_meta AS (
      SELECT t.token_id, MAX(t.metadata) AS metadata
      FROM   tokens t
      WHERE  t.contract_address = '{contractAddress}'
        AND  t.metadata IS NOT NULL
        AND  t.metadata != ''
        AND  json_type(t.metadata, '$.attributes') = 'array'
      GROUP BY t.token_id
    ),
    attrs AS (
      SELECT je.value AS attr
      FROM   token_meta tm
      JOIN   json_each(tm.metadata, '$.attributes') AS je
    )
    SELECT DISTINCT
      COALESCE(
        json_extract(attr, '$.trait_type'),
        json_extract(attr, '$.trait')
      ) AS trait_type,
      json_extract(attr, '$.value') AS trait_value
    FROM attrs
    WHERE COALESCE(
            json_extract(attr, '$.trait_type'),
            json_extract(attr, '$.trait')
          ) IS NOT NULL
      AND json_extract(attr, '$.value') IS NOT NULL
  `,
  COLLECTION_TRAITS_LISTED: `
    /* Traits derived only from currently listed tokens (much faster) */
    WITH active_orders AS (
      SELECT printf('0x%064x', mo."order.token_id") AS token_id_hex
      FROM   "marketplace-MarketOrderModel" AS mo
      WHERE  mo."order.active" = 1
        AND  mo."order.expiration" > strftime('%s','now')
        AND  mo."order.collection_id" = {collectionId}
    ),
    token_meta AS (
      SELECT t.token_id, MAX(t.metadata) AS metadata
      FROM   tokens t
      JOIN   active_orders ao ON ao.token_id_hex = t.token_id
      WHERE  t.contract_address = '{contractAddress}'
        AND  t.metadata IS NOT NULL
        AND  t.metadata != ''
        AND  json_type(t.metadata, '$.attributes') = 'array'
      GROUP BY t.token_id
    ),
    attrs AS (
      SELECT je.value AS attr
      FROM   token_meta tm
      JOIN   json_each(tm.metadata, '$.attributes') AS je
    )
    SELECT DISTINCT
      COALESCE(
        json_extract(attr, '$.trait_type'),
        json_extract(attr, '$.trait')
      ) AS trait_type,
      json_extract(attr, '$.value') AS trait_value
    FROM attrs
    WHERE COALESCE(
            json_extract(attr, '$.trait_type'),
            json_extract(attr, '$.trait')
          ) IS NOT NULL
      AND json_extract(attr, '$.value') IS NOT NULL
  `,
};
