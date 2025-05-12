import { trimAddress } from "@/lib/utils";
import { ContractAddress, HexPosition, ID } from "@bibliothecadao/types";
import { env } from "../../../env";

const API_BASE_URL = env.VITE_PUBLIC_TORII + "/sql";

// Define SQL queries separately for better maintainability
const QUERIES = {
  REALM_SETTLEMENTS: "SELECT `base.coord_x`, `base.coord_y`, owner FROM [s1_eternum-Structure] WHERE category == 1;",
  REALM_VILLAGE_SLOTS:
    "SELECT `connected_realm_coord.x`, `connected_realm_coord.y`, connected_realm_entity_id, connected_realm_id, directions_left FROM `s1_eternum-StructureVillageSlots`",
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
        FROM   "marketplace-MarketOrderModel"
        WHERE  "order.active" = 1
    ),

    /* ❷ ----------------------------------------------------------------------- */
    accepted AS (                           -- only "Accepted" events
        SELECT "market_order.price" AS hex_price
        FROM   "marketplace-MarketOrderEvent"
        WHERE  state = 'Accepted'           -- <- use single quotes for the literal
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
    WHERE  mo."order.active" = 1
      AND  mo."order.expiration" > strftime('%s','now')
      AND  ('{ownerAddress}' = '' OR mo."order.owner" = '{ownerAddress}')
    GROUP  BY token_id_hex
    )



    SELECT
        lao.token_id_hex AS token_id_hex,
        lao.token_id,
        t.name,
        t.symbol,
        t.metadata,
        lao.token_owner,
        lao.price_hex,
        lao.expiration,
        lao.order_owner,
        lao.order_id,
        lao.balance
    FROM limited_active_orders lao
    LEFT JOIN (SELECT token_id, name, symbol, contract_address, MAX(metadata) AS metadata FROM tokens GROUP BY token_id) t
      ON t.token_id = substr(lao.token_id, instr(lao.token_id, ':') + 1)
        AND t.contract_address = "{contractAddress}"
    ORDER BY lao.price_hex IS NULL, lao.price_hex;
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
  AND tb.account_address = '{trimmedAccountAddress}';
  `,
};

// API response types
export interface StructureLocation {
  "base.coord_x": number;
  "base.coord_y": number;
  owner: ContractAddress;
}

type DirectionString = "East" | "NorthEast" | "NorthWest" | "West" | "SouthWest" | "SouthEast";

export interface RealmVillageSlot {
  connected_realm_coord: HexPosition;
  connected_realm_entity_id: ID;
  connected_realm_id: ID;
  /** Parsed JSON array indicating available directions. Each object has a DirectionString key and an empty array value. */
  directions_left: Array<Partial<Record<DirectionString, []>>>;
}

// Define the response type for the new query
export interface TokenTransfer {
  to_address: ContractAddress;
  contract_address: ContractAddress;
  token_id: string; // Assuming token_id might be large or non-numeric
  amount: string; // Assuming amount might be large
  executed_at: string; // ISO date string or similar
  from_address: ContractAddress; // Added field
  name: string;
  symbol: string;
}

export interface ActiveMarketOrdersTotal {
  active_order_count: number;
  open_orders_total_wei: bigint | null; // SUM can return null if there are no rows
}

// Define the response type for the new query
export interface OpenOrderByPrice {
  token_id: number;
  order_id: number;
  name: string | null;
  symbol: string | null;
  metadata: string | null;
  best_price_hex: bigint | null;
  expiration: number | null;
  token_owner: string | null;
  order_owner: string | null;
  balance: string | null;
}

export interface TokenBalance {
  token_id: string;
  balance: string;
  contract_address: string;
}

export interface SeasonPassRealm {
  token_id: string;
  balance: string;
  contract_address: string;
  season_pass_balance: string | null;
  metadata: string | null;
  account_address: string;
}

/**
 * Fetch settlement structures from the API
 */
export async function fetchRealmSettlements(): Promise<StructureLocation[]> {
  const url = `${API_BASE_URL}?query=${encodeURIComponent(QUERIES.REALM_SETTLEMENTS)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch settlements: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Fetch village slots from the API
 */
export async function fetchRealmVillageSlots(): Promise<RealmVillageSlot[]> {
  const url = `${API_BASE_URL}?query=${encodeURIComponent(QUERIES.REALM_VILLAGE_SLOTS)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch village slots: ${response.statusText}`);
  }

  // Fetch the raw data
  const rawData: Array<{
    "connected_realm_coord.x": number;
    "connected_realm_coord.y": number;
    connected_realm_entity_id: ID;
    connected_realm_id: ID;
    directions_left: string; // Expecting a JSON string here
  }> = await response.json();

  // Parse the directions_left string for each item
  return rawData.map((item) => ({
    connected_realm_coord: { col: item["connected_realm_coord.x"], row: item["connected_realm_coord.y"] }, // Map x/y to col/row
    connected_realm_entity_id: item.connected_realm_entity_id,
    connected_realm_id: item.connected_realm_id,
    directions_left: JSON.parse(item.directions_left || "[]"),
  }));
}

/**
 * Fetch token transfers for a specific contract and recipient from the API
 */
export async function fetchTokenTransfers(contractAddress: string, recipientAddress: string): Promise<TokenTransfer[]> {
  // Construct the query by replacing placeholders
  const query = QUERIES.TOKEN_TRANSFERS.replace("{contractAddress}", contractAddress.toString()).replace(
    "{recipientAddress}",
    recipientAddress.toString(),
  );

  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch token transfers: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Fetch totals for active market orders from the API
 */
export async function fetchActiveMarketOrdersTotal(): Promise<ActiveMarketOrdersTotal[]> {
  const url = `${API_BASE_URL}?query=${encodeURIComponent(QUERIES.ACTIVE_MARKET_ORDERS_TOTAL)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch active market orders total: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Fetch open orders by price from the API
 */
export async function fetchOpenOrdersByPrice(
  contractAddress: string,
  ownerAddress?: string,
  limit?: number,
  offset?: number,
): Promise<OpenOrderByPrice[]> {
  const query = QUERIES.OPEN_ORDERS_BY_PRICE.replaceAll("{contractAddress}", contractAddress)
    .replace("{limit}", limit?.toString() ?? "20")
    .replace("{offset}", offset?.toString() ?? "0")
    .replace("{ownerAddress}", ownerAddress?.toString() ?? "");
  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch open orders by price: ${response.statusText}`);
  }

  // Define the type for the raw API response
  type RawOpenOrderByPrice = {
    token_id: number;
    name: string | null;
    symbol: string | null;
    metadata: string | null;
    price_hex: string | null;
    best_price_hex: string | null;
    token_id_hex: string | null;
    expiration: number | null;
    token_owner: ContractAddress | null;
    order_owner: ContractAddress | null;
    balance: string | null;
    order_id: string;
  };

  const rawData: RawOpenOrderByPrice[] = await response.json();

  // Parse hex strings to bigint
  return rawData.map((item) => ({
    ...item,
    token_id: parseInt(item.token_id_hex ?? "0", 16),
    order_id: parseInt(item.order_id, 16),
    best_price_hex: item.price_hex ? BigInt(item.price_hex) : null,
    token_owner: item.token_owner?.toString() ?? null,
    order_owner: item.order_owner?.toString() ?? null,
  }));
}

/**
 * Fetch season pass realms by address from the API
 */
export async function fetchSeasonPassRealmsByAddress(
  realmsAddress: string,
  seasonPassAddress: string,
  accountAddress: string,
): Promise<SeasonPassRealm[]> {
  const query = QUERIES.SEASON_PASS_REALMS_BY_ADDRESS.replace("{realmsAddress}", realmsAddress)
    .replace("{seasonPassAddress}", seasonPassAddress)
    .replace(/{accountAddress}/g, accountAddress);

  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch season pass realms: ${response.statusText}`);
  }

  return await response.json();
}

export interface TokenBalanceWithToken {
  token_id: string;
  balance: string;
  contract_address: string;
  account_address: string;
  name: string | null;
  symbol: string | null;
  expiration: number | null;
  best_price_hex: bigint | null;
  metadata: string | null;
}

export async function fetchTokenBalancesWithMetadata(
  contractAddress: string,
  accountAddress: string,
): Promise<TokenBalanceWithToken[]> {
  const query = QUERIES.TOKEN_BALANCES_WITH_METADATA.replaceAll("{contractAddress}", contractAddress)
    .replace("{accountAddress}", accountAddress)
    .replace("{trimmedAccountAddress}", trimAddress(accountAddress));
  console.log(query);
  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch token balances with tokens: ${response.statusText}`);
  }
  const rawData = await response.json();
  return rawData.map((item: TokenBalanceWithToken) => ({
    ...item,
    token_id: parseInt(item.token_id?.split(":")[1] ?? "0", 16),
    best_price_hex: item.best_price_hex ? BigInt(item.best_price_hex) : null,
  }));
}
