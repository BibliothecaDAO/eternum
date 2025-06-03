import { ContractAddress, HexPosition, ID } from "@bibliothecadao/types";

// API response types
export interface StructureLocation {
  "base.coord_x": number;
  "base.coord_y": number;
  entity_id: number;
  owner: ContractAddress;
}

export interface TradeEvent {
  type: EventType;
  event: {
    takerId: number;
    makerId: number;
    makerAddress: bigint;
    takerAddress: ContractAddress;
    isYours: boolean;
    resourceGiven: Resource;
    resourceTaken: Resource;
    eventTime: Date;
  };
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

export interface Resource {
  resourceId: number;
  amount: number;
}

export interface SwapEventResponse {
  entity_id: number;
  resource_type: number;
  lords_amount: string;
  resource_amount: string;
  resource_price: string;
  buy: number;
  timestamp: string;
  owner: ContractAddress;
}

// Raw response types for queries that need transformation
export interface RawRealmVillageSlot {
  "connected_realm_coord.x": number;
  "connected_realm_coord.y": number;
  connected_realm_entity_id: ID;
  connected_realm_id: ID;
  directions_left: string; // JSON string that needs parsing
}

export enum EventType {
  SWAP = "AMM Swap",
  ORDERBOOK = "Orderbook",
}
