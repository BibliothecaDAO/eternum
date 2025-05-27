import { TradeEvent } from "@/ui/components/trading/market-trading-history";
import { ContractAddress, HexPosition, ID, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { env } from "../../env";

export const API_BASE_URL = env.VITE_PUBLIC_TORII + "/sql";

/**
 * Properly formats an address by converting to bigint and padding to 64 hex characters
 * This ensures consistent address formatting for database queries by:
 * 1. Converting the input string to bigint (handles various formats)
 * 2. Converting back to hex string (normalizes the format)
 * 3. Padding with leading zeros to exactly 64 characters
 * 4. Adding the 0x prefix
 *
 * Example: "0x1234" -> "0x0000000000000000000000000000000000000000000000000000000000001234"
 */
function formatAddressForQuery(address: string): string {
  // Convert string to bigint to normalize it
  const addressBigInt = BigInt(address);

  // Convert back to hex string (without 0x prefix)
  const hexString = addressBigInt.toString(16);

  // Pad with leading zeros to make it 64 characters
  const paddedHex = hexString.padStart(64, "0");

  // Add 0x prefix back
  return `0x${paddedHex}`;
}

// Define SQL queries separately for better maintainability
const QUERIES = {
  EXPLORER_ADDRESS_OWNER: `
    SELECT s.owner as address_owner
    FROM \`s1_eternum-ExplorerTroops\` e
    JOIN \`s1_eternum-Structure\` s ON e.owner = s.entity_id
    WHERE e.explorer_id = {entityId};
  `,
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
  OTHER_STRUCTURES: `
    SELECT entity_id AS entityId, \`metadata.realm_id\` AS realmId, owner, category FROM [s1_eternum-Structure] WHERE owner != '{owner}';
  `,
  STRUCTURES_BY_OWNER:
    "SELECT `base.coord_x`, `base.coord_y`, entity_id, owner FROM [s1_eternum-Structure] WHERE owner == '{owner}';",
  REALM_SETTLEMENTS:
    "SELECT `base.coord_x`, `base.coord_y`, entity_id,  owner FROM [s1_eternum-Structure] WHERE category == 1;",
  REALM_VILLAGE_SLOTS:
    "SELECT `connected_realm_coord.x`, `connected_realm_coord.y`, connected_realm_entity_id, connected_realm_id, directions_left FROM `s1_eternum-StructureVillageSlots`",
  ALL_TILES: `
    SELECT DISTINCT
        col,
        row,
        biome,
        occupier_id,
        occupier_type,
        occupier_is_structure
    FROM \`s1_eternum-Tile\`
    ORDER BY col, row;
  `,
  STRUCTURE_AND_EXPLORER_DETAILS: `
    SELECT
        s.owner AS owner_address,
        GROUP_CONCAT(DISTINCT s.entity_id || ':' || s.\`metadata.realm_id\`|| ':' || s.\`category\`) AS structure_ids,
        GROUP_CONCAT(
            CASE 
                WHEN et.explorer_id IS NOT NULL 
                THEN et.explorer_id || ':' || s.entity_id 
                ELSE NULL 
            END
        ) AS explorer_ids,
        COUNT(DISTINCT CASE WHEN s.category = 1 THEN s.entity_id END) as realms_count,
        COUNT(DISTINCT CASE WHEN s.category = 2 THEN s.entity_id END) as hyperstructures_count,
        COUNT(DISTINCT CASE WHEN s.category = 3 THEN s.entity_id END) as bank_count,
        COUNT(DISTINCT CASE WHEN s.category = 4 THEN s.entity_id END) as mine_count,
        COUNT(DISTINCT CASE WHEN s.category = 5 THEN s.entity_id END) as village_count,
        gm.guild_id,
        g.name AS guild_name,
        sos.name AS player_name
    FROM [s1_eternum-Structure] s
    LEFT JOIN [s1_eternum-ExplorerTroops] et ON et.owner = s.entity_id
    LEFT JOIN [s1_eternum-GuildMember] gm ON gm.member = s.owner
    LEFT JOIN [s1_eternum-Guild] g ON g.guild_id = gm.guild_id
    LEFT JOIN [s1_eternum-StructureOwnerStats] sos ON sos.owner = s.owner
    GROUP BY s.owner 
  `,

  HYPERSTRUCTURES: `
    SELECT 
        hyperstructure_id
    FROM \`s1_eternum-Hyperstructure\`;
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
  STRUCTURE_BY_COORD: `
    SELECT
        internal_id,
        entity_id,
        owner                           AS occupier_id,
        \`base.category\`                 AS structure_category,
        \`base.level\`                    AS structure_level,
        \`base.coord_x\`                  AS coord_x,
        \`base.coord_y\`                  AS coord_y,
        \`base.created_at\`               AS created_tick,
        \`metadata.realm_id\`             AS realm_id,
        category                        AS top_level_category,
        internal_created_at,
        internal_updated_at,
        resources_packed
    FROM
        \`s1_eternum-Structure\`
    WHERE
        \`base.coord_x\` = {coord_x}
        AND
        \`base.coord_y\` = {coord_y};
  `,
  BATTLE_LOGS: `
    SELECT 
        'ExplorerNewRaidEvent' as event_type,
        explorer_id as attacker_id,
        structure_id as defender_id,
        explorer_owner_id as attacker_owner_id,
        NULL as defender_owner_id,
        NULL as winner_id,
        NULL as max_reward,
        success,
        timestamp
    FROM [s1_eternum-ExplorerNewRaidEvent]
    {whereClause}
    UNION ALL
    SELECT 
        'BattleEvent' as event_type,
        attacker_id,
        defender_id,
        attacker_owner as attacker_owner_id,
        defender_owner as defender_owner_id,
        winner_id,
        max_reward,
        NULL as success,
        timestamp
    FROM [s1_eternum-BattleEvent]
    {whereClause}
    ORDER BY timestamp DESC
  `,
  PLAYER_STRUCTURES: `
    SELECT 
        \`base.coord_x\` as coord_x,
        \`base.coord_y\` as coord_y,
        category,
        resources_packed,
        entity_id,
        \`metadata.realm_id\` as realm_id,
        \`metadata.has_wonder\` as has_wonder,
        \`base.level\` as level
    FROM \`s1_eternum-Structure\`
    WHERE owner = '{owner}'
    ORDER BY category, entity_id;
  `,
};

// API response types
export interface StructureLocation {
  "base.coord_x": number;
  "base.coord_y": number;
  entity_id: number;
  owner: ContractAddress;
}

export interface Tile {
  col: number;
  row: number;
  biome: number;
  occupier_id: number;
  occupier_type: number;
  occupier_is_structure: boolean;
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

export interface PlayersData {
  explorer_ids: string | number;
  structure_ids: string;
  guild_id: string | null;
  guild_name: string | null;
  player_name: string | null;
  owner_address: string;
  realms_count: number;
  hyperstructures_count: number;
  bank_count: number;
  mine_count: number;
  village_count: number;
}

export interface BattleLogEvent {
  event_type: "BattleEvent" | "ExplorerNewRaidEvent";
  attacker_id: number;
  defender_id: number;
  attacker_owner_id: number;
  defender_owner_id: number | null;
  winner_id: number | null;
  max_reward: string | number;
  success: number | null;
  timestamp: string;
}

export interface StructureDetails {
  internal_id: string; // Assuming internal_id might be non-numeric or large
  entity_id: number; // Assuming entity_id is numeric
  structure_category: number; // Assuming category is numeric
  structure_level: number; // Assuming level is numeric
  coord_x: number;
  coord_y: number;
  created_tick: number; // Assuming tick is numeric
  realm_id: number; // Assuming realm_id is numeric
  top_level_category: number; // Assuming category is numeric
  internal_created_at: string; // ISO date string or similar
  internal_updated_at: string; // ISO date string or similar
  resources_packed: string; // Assuming this is a packed format, represented as string initially
  occupier_id: ContractAddress; // Added owner field aliased as occupier_id
}

export interface Hyperstructure {
  entity_id: number;
  hyperstructure_id: number;
}

export interface PlayerStructure {
  coord_x: number;
  coord_y: number;
  category: number;
  resources_packed: string;
  entity_id: number;
  realm_id: number | null;
  has_wonder: boolean | null;
  level: number;
}

export enum EventType {
  SWAP = "AMM Swap",
  ORDERBOOK = "Orderbook",
}

export interface Resource {
  resourceId: number;
  amount: number;
}

interface SwapEventResponse {
  entity_id: number;
  resource_type: number;
  lords_amount: string;
  resource_amount: string;
  resource_price: string;
  buy: number;
  timestamp: string;
  owner: ContractAddress;
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
 * Fetch structures by owner from the API
 */
export async function fetchStructuresByOwner(owner: string): Promise<StructureLocation[]> {
  const formattedOwner = formatAddressForQuery(owner);

  const url = `${API_BASE_URL}?query=${encodeURIComponent(
    QUERIES.STRUCTURES_BY_OWNER.replace("{owner}", formattedOwner),
  )}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch structures by owner: ${response.statusText}`);
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
 * Fetch structure details for a specific coordinate from the API
 */
export async function fetchStructureByCoord(coordX: number, coordY: number): Promise<StructureDetails[]> {
  // Construct the query by replacing the placeholders
  const query = QUERIES.STRUCTURE_BY_COORD.replace("{coord_x}", coordX.toString()).replace(
    "{coord_y}",
    coordY.toString(),
  );

  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch structure details: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Fetch global structure explorer and guild details from the API
 */
export async function fetchGlobalStructureExplorerAndGuildDetails(): Promise<PlayersData[]> {
  const query = QUERIES.STRUCTURE_AND_EXPLORER_DETAILS;

  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch structure explorer and guild details: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Fetch all tiles on the map from the API
 */
export async function fetchAllTiles(): Promise<Tile[]> {
  const url = `${API_BASE_URL}?query=${encodeURIComponent(QUERIES.ALL_TILES)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch tiles: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Fetch all hyperstructures from the API
 */
export async function fetchHyperstructures(): Promise<Hyperstructure[]> {
  const url = `${API_BASE_URL}?query=${encodeURIComponent(QUERIES.HYPERSTRUCTURES)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch hyperstructures: ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchOtherStructures(
  owner: string,
): Promise<{ entityId: ID; owner: ContractAddress; category: StructureType; realmId: number }[]> {
  const formattedOwner = formatAddressForQuery(owner);

  const url = `${API_BASE_URL}?query=${encodeURIComponent(QUERIES.OTHER_STRUCTURES.replace("{owner}", formattedOwner))}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch other structures: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Fetch swap events from the API and transform them into TradeEvents
 */
export async function fetchSwapEvents(userEntityIds: ID[]): Promise<TradeEvent[]> {
  const url = `${API_BASE_URL}?query=${encodeURIComponent(QUERIES.SWAP_EVENTS)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch swap events: ${response.statusText}`);
  }

  const events: SwapEventResponse[] = await response.json();

  return events.map((event) => {
    const isBuy = event.buy === 1;
    const lordsAmount = BigInt(event.lords_amount);
    const resourceAmount = BigInt(event.resource_amount);

    return {
      type: EventType.SWAP,
      event: {
        takerId: event.entity_id,
        makerId: 0, // For swap events, there's no maker
        makerAddress: 0n,
        takerAddress: event.owner,
        isYours: userEntityIds.includes(event.entity_id),
        resourceGiven: {
          resourceId: isBuy ? ResourcesIds.Lords : event.resource_type,
          amount: Number(isBuy ? lordsAmount : resourceAmount),
        },
        resourceTaken: {
          resourceId: isBuy ? event.resource_type : ResourcesIds.Lords,
          amount: Number(isBuy ? resourceAmount : lordsAmount),
        },
        eventTime: new Date(Number(event.timestamp) * 1000),
      },
    };
  });
}

export async function fetchExplorerAddressOwner(entityId: ID): Promise<ContractAddress | null> {
  const url = `${API_BASE_URL}?query=${encodeURIComponent(QUERIES.EXPLORER_ADDRESS_OWNER.replace("{entityId}", entityId.toString()))}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch explorer address owner: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.length === 0) {
    return null;
  }
  return data[0].address_owner;
}

export const fetchBattleLogs = async (afterTimestamp?: string): Promise<BattleLogEvent[]> => {
  const whereClause = afterTimestamp ? `WHERE timestamp > '${afterTimestamp ? afterTimestamp : "0"}'` : "";

  const query = QUERIES.BATTLE_LOGS.replaceAll("{whereClause}", whereClause);
  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch battle logs: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
};

/**
 * Fetch player structures with coordinates, category, and resources_packed from the API
 */
export async function fetchPlayerStructures(owner: string): Promise<PlayerStructure[]> {
  const formattedOwner = formatAddressForQuery(owner);

  const url = `${API_BASE_URL}?query=${encodeURIComponent(QUERIES.PLAYER_STRUCTURES.replace("{owner}", formattedOwner))}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch player structures: ${response.statusText}`);
  }

  return await response.json();
}
