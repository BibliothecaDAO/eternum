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
    accepted AS (                           -- only “Accepted” events
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

  // The API returns an array with a single object, potentially with large numbers
  const rawResult: { active_order_count: number; open_orders_total_wei: number | string | null }[] =
    await response.json();

  // Convert wei to bigint
  const result: ActiveMarketOrdersTotal[] = rawResult.map((item) => ({
    total_active: item.active_order_count,
    total_volume: item.open_orders_total_wei !== null ? BigInt(Math.round(Number(item.open_orders_total_wei))) : null,
  }));

  return result;
}
