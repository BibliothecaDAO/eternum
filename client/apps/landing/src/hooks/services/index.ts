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
    /* ─────────────────────────────────────────────────────────────────────
      All tokens of one contract
      + their lowest‑price ACTIVE listing
      + metadata (tokens)   + expiration (order)
      ─────────────────────────────────────────────────────────────────── */

    WITH
    /* 1️⃣  every token that belongs to the contract -------------------- */
    contract_tokens AS (
        SELECT
            token_id,                            -- 66‑char hex string
            name,
            symbol,
            metadata
        FROM   tokens
        WHERE  contract_address = '{contractAddress}'        -- <‑‑ change me
    ),

    /* 2️⃣  active listings for the same contract ---------------------- */
    active_orders AS (
        SELECT
            printf('0x%064x', "order.token_id") AS token_id_hex,  -- pad to 66‑char hex
            "order.price"                       AS price_hex,     -- hex price
            "order.expiration"                  AS expiration,
            "order.owner" AS owner,
            order_id
        FROM   "marketplace-MarketOrderModel"
        WHERE  "order.active" = 1
    ),

    /* 3️⃣  find the cheapest ACTIVE price per token ------------------- */
    min_prices AS (
        SELECT
            token_id_hex,
            MIN(price_hex) AS best_price_hex                     -- lexicographic=min
        FROM   active_orders
        GROUP  BY token_id_hex
    ),

    /* 4️⃣  attach the matching expiration to that cheapest listing ---- */
    best_active AS (
        SELECT
            ao.token_id_hex,
            mp.best_price_hex,
            ao.expiration,       -- expiration of *that* cheapest listing
            ao.owner,
            ao.order_id
        FROM   active_orders ao
        JOIN   min_prices   mp
              ON  mp.token_id_hex   = ao.token_id_hex
              AND mp.best_price_hex = ao.price_hex
    )

    /* 5️⃣  merge: tokens first, then listing data --------------------- */
    SELECT
        ct.token_id,
        ct.name,
        ct.symbol,
        ct.metadata,
        ba.best_price_hex,       -- NULL if not listed
        ba.expiration,            -- NULL if not listed
        ba.owner,
        ba.order_id
    FROM   contract_tokens AS ct
    LEFT   JOIN best_active   AS ba
          ON ba.token_id_hex = ct.token_id
    ORDER  BY
          ba.best_price_hex IS NULL,   -- push unlisted tokens down
          ba.best_price_hex;           -- then cheapest → highest
  `,
  SEASON_PASS_REALMS_BY_ADDRESS: `
    SELECT substr(r.token_id, instr(r.token_id, ':') + 1) AS token_id,
           r.balance,
           r.contract_address,
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
  total_active: number;
  total_volume: bigint | null; // SUM can return null if there are no rows
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
  owner: ContractAddress | null;
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
export async function fetchOpenOrdersByPrice(contractAddress: string): Promise<OpenOrderByPrice[]> {
  const query = QUERIES.OPEN_ORDERS_BY_PRICE.replace("{contractAddress}", contractAddress);
  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch open orders by price: ${response.statusText}`);
  }

  // Define the type for the raw API response
  type RawOpenOrderByPrice = {
    token_id: string;
    name: string | null;
    symbol: string | null;
    metadata: string | null;
    best_price_hex: string | null;
    expiration: number | null;
    owner: ContractAddress | null;
    order_id: string;
  };

  const rawData: RawOpenOrderByPrice[] = await response.json();

  // Parse hex strings to bigint
  return rawData.map((item) => ({
    ...item,
    token_id: parseInt(item.token_id, 16),
    order_id: parseInt(item.order_id, 16),
    best_price_hex: item.best_price_hex ? BigInt(item.best_price_hex) : null,
  }));
}

/**
 * Fetch season pass realms by address from the API
 */
export async function fetchSeasonPassRealmsByAddress(realmsAddress: string, seasonPassAddress: string, accountAddress: string): Promise<SeasonPassRealm[]> {
  const query = QUERIES.SEASON_PASS_REALMS_BY_ADDRESS
      .replace("{realmsAddress}", realmsAddress)
      .replace("{seasonPassAddress}", seasonPassAddress)
      .replace(/{accountAddress}/g, accountAddress);
  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch season pass realms: ${response.statusText}`);
  }

  return await response.json();
}
