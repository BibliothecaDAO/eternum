import { Direction, EntityType, HexPosition, ID, Position, StructureType } from "@bibliothecadao/types";

// API response types
export interface StructureLocation {
  coord_x: number;
  coord_y: number;
  entity_id: number;
  owner: string;
}

export interface TradeEvent {
  type: EventType;
  event: {
    takerId: number;
    makerId: number;
    makerAddress: string;
    takerAddress: string;
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
  to_address: string;
  contract_address: string;
  token_id: string; // Assuming token_id might be large or non-numeric
  amount: string; // Assuming amount might be large
  executed_at: string; // ISO date string or similar
  from_address: string; // Added field
  name: string;
  symbol: string;
}

export interface PlayerLeaderboardRow {
  player_address: string | null;
  player_name: string | null;
  prize_claimed: number | string | null;
  registered_points: number | string | null;
  playerAddress?: string | null;
  playerName?: string | null;
  prizeClaimed?: number | string | boolean | null;
  registeredPoints?: number | string | null;
  total_points?: number | string | null;
  totalPoints?: number | string | null;
  unregisteredPoints?: number | string | null;
  registeredPointsRaw?: number | string | null;
  registeredPointsRegistered?: number | string | null;
}

export interface HyperstructureLeaderboardConfigRow {
  points_per_second: string | number | bigint | null;
  season_end: string | number | bigint | null;
  realm_count: string | number | bigint | null;
}

export interface HyperstructureShareholderRow {
  hyperstructure_id: number | string | bigint | null;
  start_at: number | string | bigint | null;
  shareholders: unknown;
}

export interface HyperstructureRow {
  hyperstructure_id: number | string | bigint | null;
  points_multiplier: number | string | bigint | null;
}

export interface StoryEventData {
  owner: string | null;
  entity_id: number | null;
  tx_hash: string;
  story: string; // The story type (e.g., "RealmCreatedStory", "ExplorerMoveStory", etc.)
  timestamp: string;
  event_id: string;

  // RealmCreatedStory fields
  realm_coord_x?: number;
  realm_coord_y?: number;

  // ExplorerMoveStory fields
  explorer_id?: number;
  explorer_structure_id?: number;
  start_coord_x?: number;
  start_coord_y?: number;
  end_coord_x?: number;
  end_coord_y?: number;
  explorer_directions?: string;
  explorer_explore?: boolean;
  explore_find?: string;
  reward_resource_type?: number;
  reward_resource_amount?: string;

  // StructureLevelUpStory fields
  structure_new_level?: number;

  // BattleStory fields
  battle_attacker_id?: number;
  battle_defender_id?: number;
  battle_winner_id?: number;
  battle_type?: string;
  battle_attacker_owner_address?: string;
  battle_defender_owner_address?: string;
  battle_attacker_owner_id?: number;
  battle_defender_owner_id?: number;
  battle_attacker_troops_type?: string;
  battle_attacker_troops_tier?: string;
  battle_attacker_troops_before?: string;
  battle_attacker_troops_lost?: string;
  battle_defender_troops_type?: string;
  battle_defender_troops_tier?: string;
  battle_defender_troops_before?: string;
  battle_defender_troops_lost?: string;
  battle_stolen_resources?: string;

  // ProductionStory fields
  production_resource_type?: number;
  production_amount?: string;
  production_cost?: string;

  // BuildingPlacementStory fields
  building_category?: number;
  building_coord_x?: number;
  building_coord_y?: number;
  building_created?: boolean;
  building_destroyed?: boolean;
  building_paused?: boolean;
  building_unpaused?: boolean;

  // BuildingPaymentStory fields
  building_payment_category?: number;
  building_payment_coord_x?: number;
  building_payment_coord_y?: number;
  building_payment_cost?: string;

  // ResourceTransferStory fields
  resource_transfer_type?: string;
  resource_transfer_from_entity_id?: number;
  resource_transfer_from_owner_address?: string;
  resource_transfer_to_entity_id?: number;
  resource_transfer_to_owner_address?: string;
  resource_transfer_resources?: string;
  resource_transfer_is_mint?: boolean;
  resource_transfer_travel_time?: string;

  // ResourceBurnStory fields
  resource_burn_resources?: string;

  // ResourceReceiveArrivalStory fields
  resource_receive_resources?: string;

  // GuardAddStory fields
  guard_add_structure_id?: number;
  guard_add_slot?: string;
  guard_add_category?: string;
  guard_add_tier?: string;
  guard_add_amount?: string;

  // GuardDeleteStory fields
  guard_delete_structure_id?: number;
  guard_delete_slot?: string;

  // ExplorerCreateStory fields
  explorer_create_structure_id?: number;
  explorer_create_explorer_id?: number;
  explorer_create_category?: string;
  explorer_create_tier?: string;
  explorer_create_amount?: string;
  explorer_create_spawn_direction?: string;

  // ExplorerAddStory fields
  explorer_add_explorer_id?: number;
  explorer_add_amount?: string;
  explorer_add_home_direction?: string;

  // ExplorerDeleteStory fields
  explorer_delete_explorer_id?: number;

  // ExplorerExplorerSwapStory fields
  explorer_swap_from_id?: number;
  explorer_swap_to_id?: number;
  explorer_swap_to_direction?: string;
  explorer_swap_count?: string;

  // ExplorerGuardSwapStory fields
  explorer_guard_swap_from_explorer_id?: number;
  explorer_guard_swap_to_structure_id?: number;
  explorer_guard_swap_to_structure_direction?: string;
  explorer_guard_swap_to_guard_slot?: string;
  explorer_guard_swap_count?: string;

  // GuardExplorerSwapStory fields
  guard_explorer_swap_from_structure_id?: number;
  guard_explorer_swap_from_guard_slot?: string;
  guard_explorer_swap_to_explorer_id?: number;
  guard_explorer_swap_to_explorer_direction?: string;
  guard_explorer_swap_count?: string;

  // PrizeDistribution fields
  prize_to_player_address?: string;
  prize_amount?: string;
  prize_decimals?: number;
  prize_trial_id?: string;
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
  occupier_id: ID; // Added owner field aliased as occupier_id
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
  owner: string;
}

// New types for torii-client functionality
export interface QuestTileData {
  id: number;
  game_address: string;
  coord_x: number;
  coord_y: number;
  level: number;
  resource_type: number;
  amount: string;
  capacity: number;
  participant_count: number;
}

export interface ExplorerData {
  explorer_id: number;
  owner: ID;
  troop_category: number;
  troop_tier: number;
  troop_count: string;
  max_stamina: string;
  current_stamina: string;
  last_refill_tick: string;
  coord_x: number;
  coord_y: number;
  resource_id?: number;
  resource_amount?: string;
}

export interface StructureWithResources {
  entity_id: number;
  owner: string;
  "base.coord_x": number;
  "base.coord_y": number;
  "base.category": number;
  "base.level": number;
  "base.created_at": number;
  "metadata.realm_id": number | null;
  category: number;
}

export interface SimpleStructure {
  entity_id: number;
  owner: string;
  "base.coord_x": number;
  "base.coord_y": number;
}

export interface VillageSlotResult {
  realmId: number;
  entityId: number;
  hasSlots: boolean;
  availableSlots: VillageSlot[];
  position: {
    col: number;
    row: number;
  };
}

export interface VillageSlot {
  value: Direction;
  label: string;
  coord: {
    col: number;
    row: number;
  };
}

export interface AddressName {
  name: string;
}

export interface SeasonEnded {
  winner_address: string;
  timestamp: number;
}

export interface StructureMapDataRaw {
  entity_id: number;
  coord_x: number;
  coord_y: number;
  structure_type: number;
  level: number;
  owner_address: string;
  realm_id: number | null;
  resources_packed: string;
  owner_name: string | null;

  // Guard army data
  delta_category: string | null;
  delta_tier: string | null;
  delta_count: string | null; // hex string
  delta_stamina_amount: string | null; // hex string
  charlie_category: string | null;
  charlie_tier: string | null;
  charlie_count: string | null; // hex string
  charlie_stamina_amount: string | null; // hex string
  bravo_category: string | null;
  bravo_tier: string | null;
  bravo_count: string | null; // hex string
  bravo_stamina_amount: string | null; // hex string
  alpha_category: string | null;
  alpha_tier: string | null;
  alpha_count: string | null; // hex string
  alpha_stamina_amount: string | null; // hex string
  delta_battle_cooldown_end: number | null;
  charlie_battle_cooldown_end: number | null;
  bravo_battle_cooldown_end: number | null;
  alpha_battle_cooldown_end: number | null;

  // Building production data from StructureBuildings
  packed_counts_1: string | null; // hex string
  packed_counts_2: string | null; // hex string
  packed_counts_3: string | null; // hex string

  // Battle data
  latest_attacker_id: number | null;
  latest_attack_timestamp: string | null; // hex string
  latest_defender_id: number | null;
  latest_defense_timestamp: string | null; // hex string
  latest_attacker_coord_x: number | null;
  latest_attacker_coord_y: number | null;
  latest_defender_coord_x: number | null;
  latest_defender_coord_y: number | null;
}

export interface ArmyMapDataRaw {
  entity_id: number;
  coord_x: number;
  coord_y: number;
  owner_structure_id: number | null;
  category: string | null;
  tier: string | null;
  count: string; // hex string
  stamina_amount: string | null; // hex string
  stamina_updated_tick: string | null; // hex string
  owner_address: string | null;
  owner_name: string | null;
  battle_cooldown_end: number | null;

  // Battle data
  latest_attacker_id: number | null;
  latest_attack_timestamp: string | null; // hex string
  latest_attacker_coord_x: number | null;
  latest_attacker_coord_y: number | null;
  latest_defender_id: number | null;
  latest_defense_timestamp: string | null; // hex string
  latest_defender_coord_x: number | null;
  latest_defender_coord_y: number | null;
}

export interface HyperstructureRealmCountDataRaw {
  hyperstructure_entity_id: number;
  hyperstructure_coord_x: number;
  hyperstructure_coord_y: number;
  realm_count_within_radius: number;

  // Battle data
  latest_attacker_id: number | null;
  latest_attack_timestamp: string | null; // hex string
  latest_defender_id: number | null;
  latest_defense_timestamp: string | null; // hex string
}

// Raw response types for queries that need transformation
export interface RawRealmVillageSlot {
  "connected_realm_coord.x": number;
  "connected_realm_coord.y": number;
  connected_realm_entity_id: ID;
  connected_realm_id: ID;
  directions_left: string; // JSON string that needs parsing
}

export interface GuardData {
  entity_id: number;
  delta_category: string | null;
  delta_tier: string | null;
  delta_count: string | null; // hex string
  delta_stamina_amount: string | null; // hex string
  delta_stamina_updated_tick: string | null; // hex string
  charlie_category: string | null;
  charlie_tier: string | null;
  charlie_count: string | null; // hex string
  charlie_stamina_amount: string | null; // hex string
  charlie_stamina_updated_tick: string | null; // hex string
  bravo_category: string | null;
  bravo_tier: string | null;
  bravo_count: string | null; // hex string
  bravo_stamina_amount: string | null; // hex string
  bravo_stamina_updated_tick: string | null; // hex string
  alpha_category: string | null;
  alpha_tier: string | null;
  alpha_count: string | null; // hex string
  alpha_stamina_amount: string | null; // hex string
  alpha_stamina_updated_tick: string | null; // hex string
  delta_destroyed_tick: string | null; // hex string
  charlie_destroyed_tick: string | null; // hex string
  bravo_destroyed_tick: string | null; // hex string
  alpha_destroyed_tick: string | null; // hex string
}

export interface Guard {
  slot: number;
  troops: {
    category: string | null;
    tier: string | null;
    count: bigint;
    stamina: {
      amount: bigint;
      updated_tick: bigint;
    };
  } | null;
  destroyedTick: bigint;
  cooldownEnd: number;
}

export enum EventType {
  SWAP = "AMM Swap",
  ORDERBOOK = "Orderbook",
}

export interface ChestTile {
  col: number;
  row: number;
  entity_id: number;
}

export interface StructureRelicsData {
  entity_id: number;
  entity_type: number; // StructureType enum
  coord_x: number;
  coord_y: number;
  realm_id?: number;
  // Relic balances from Resource table
  RELIC_E1_BALANCE?: string;
  RELIC_E2_BALANCE?: string;
  RELIC_E3_BALANCE?: string;
  RELIC_E4_BALANCE?: string;
  RELIC_E5_BALANCE?: string;
  RELIC_E6_BALANCE?: string;
  RELIC_E7_BALANCE?: string;
  RELIC_E8_BALANCE?: string;
  RELIC_E9_BALANCE?: string;
  RELIC_E10_BALANCE?: string;
  RELIC_E11_BALANCE?: string;
  RELIC_E12_BALANCE?: string;
  RELIC_E13_BALANCE?: string;
  RELIC_E14_BALANCE?: string;
  RELIC_E15_BALANCE?: string;
  RELIC_E16_BALANCE?: string;
  RELIC_E17_BALANCE?: string;
  RELIC_E18_BALANCE?: string;
}

export interface ArmyRelicsData {
  entity_id: number;
  coord_x: number;
  coord_y: number;
  troop_category?: number;
  troop_tier?: number;
  // Relic balances from Resource table
  RELIC_E1_BALANCE?: string;
  RELIC_E2_BALANCE?: string;
  RELIC_E3_BALANCE?: string;
  RELIC_E4_BALANCE?: string;
  RELIC_E5_BALANCE?: string;
  RELIC_E6_BALANCE?: string;
  RELIC_E7_BALANCE?: string;
  RELIC_E8_BALANCE?: string;
  RELIC_E9_BALANCE?: string;
  RELIC_E10_BALANCE?: string;
  RELIC_E11_BALANCE?: string;
  RELIC_E12_BALANCE?: string;
  RELIC_E13_BALANCE?: string;
  RELIC_E14_BALANCE?: string;
  RELIC_E15_BALANCE?: string;
  RELIC_E16_BALANCE?: string;
  RELIC_E17_BALANCE?: string;
  RELIC_E18_BALANCE?: string;
}

export interface ChestInfo {
  entityId: ID;
  position: Position;
  distance: number;
}

export interface RelicInventory {
  resourceId: ID;
  amount: number;
}

export interface EntityWithRelics {
  entityId: ID;
  position: Position;
  structureType?: StructureType | undefined;
  type: EntityType;
  relics: RelicInventory[];
}

export interface PlayerRelicsData {
  structures: EntityWithRelics[];
  armies: EntityWithRelics[];
}
