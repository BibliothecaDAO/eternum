import { TransactionType } from "./types";

/**
 * Transaction cost categories for smart batching.
 * Transactions in the same category can be batched together.
 */
export enum TransactionCostCategory {
  HIGH = "HIGH", // VRF, combat, complex operations - max 3
  MEDIUM = "MEDIUM", // State writes, resource transfers - max 5
  LOW = "LOW", // Simple state changes - max 10
}

/**
 * Maximum batch size for each cost category.
 * These limits are based on the Starknet step limit of 25M steps.
 */
export const CATEGORY_BATCH_LIMITS: Record<TransactionCostCategory, number> = {
  [TransactionCostCategory.HIGH]: 6,
  [TransactionCostCategory.MEDIUM]: 5,
  [TransactionCostCategory.LOW]: 10,
};

/**
 * Default category for unknown transaction types.
 * Using HIGH to be conservative and avoid step limit issues.
 */
export const DEFAULT_CATEGORY = TransactionCostCategory.HIGH;

/**
 * Mapping of each transaction type to its cost category.
 * This determines how many transactions of each type can be batched together.
 */
export const TRANSACTION_COST_CATEGORY: Partial<Record<TransactionType, TransactionCostCategory>> = {
  // ============================================
  // HIGH COST (3) - VRF, Combat, Complex Operations
  // ============================================

  // Exploration (uses VRF)
  [TransactionType.EXPLORE]: TransactionCostCategory.HIGH,
  [TransactionType.EXPLORER_EXTRACT_REWARD]: TransactionCostCategory.HIGH,

  // Combat (complex calculations)
  [TransactionType.ATTACK_EXPLORER_VS_EXPLORER]: TransactionCostCategory.HIGH,
  [TransactionType.ATTACK_EXPLORER_VS_GUARD]: TransactionCostCategory.HIGH,
  [TransactionType.ATTACK_GUARD_VS_EXPLORER]: TransactionCostCategory.HIGH,
  [TransactionType.RAID_EXPLORER_VS_GUARD]: TransactionCostCategory.HIGH,
  [TransactionType.BATTLE_START]: TransactionCostCategory.HIGH,
  [TransactionType.BATTLE_RESOLVE]: TransactionCostCategory.HIGH,
  [TransactionType.BATTLE_FORCE_START]: TransactionCostCategory.HIGH,
  [TransactionType.BATTLE_JOIN]: TransactionCostCategory.HIGH,
  [TransactionType.BATTLE_LEAVE]: TransactionCostCategory.HIGH,
  [TransactionType.BATTLE_CLAIM]: TransactionCostCategory.HIGH,

  // VRF operations
  [TransactionType.REQUEST_RANDOM]: TransactionCostCategory.HIGH,
  [TransactionType.OPEN_CHEST]: TransactionCostCategory.HIGH,
  [TransactionType.APPLY_RELIC]: TransactionCostCategory.HIGH,

  // Complex operations
  [TransactionType.CONTRIBUTE]: TransactionCostCategory.HIGH,
  [TransactionType.MAKE_HYPERSTRUCTURES]: TransactionCostCategory.HIGH,
  [TransactionType.SETTLE_REALMS]: TransactionCostCategory.HIGH,
  [TransactionType.REGISTER]: TransactionCostCategory.HIGH,
  [TransactionType.SEASON_CLOSE]: TransactionCostCategory.HIGH,
  [TransactionType.END_GAME]: TransactionCostCategory.HIGH,
  [TransactionType.BLITZ_PRIZE_CLAIM]: TransactionCostCategory.HIGH,
  [TransactionType.BLITZ_PRIZE_CLAIM_NO_GAME]: TransactionCostCategory.HIGH,

  // ============================================
  // MEDIUM COST (5) - State Writes, Transfers
  // ============================================

  // Explorer management
  [TransactionType.TRAVEL_HEX]: TransactionCostCategory.MEDIUM,
  [TransactionType.EXPLORER_CREATE]: TransactionCostCategory.MEDIUM,
  [TransactionType.EXPLORER_ADD]: TransactionCostCategory.MEDIUM,
  [TransactionType.EXPLORER_DELETE]: TransactionCostCategory.MEDIUM,
  [TransactionType.EXPLORER_MOVE]: TransactionCostCategory.MEDIUM,
  [TransactionType.EXPLORER_EXPLORER_SWAP]: TransactionCostCategory.MEDIUM,
  [TransactionType.EXPLORER_GUARD_SWAP]: TransactionCostCategory.MEDIUM,
  [TransactionType.GUARD_EXPLORER_SWAP]: TransactionCostCategory.MEDIUM,

  // Guards
  [TransactionType.GUARD_ADD]: TransactionCostCategory.MEDIUM,
  [TransactionType.GUARD_DELETE]: TransactionCostCategory.MEDIUM,

  // Troop operations
  [TransactionType.TROOP_TROOP_ADJACENT_TRANSFER]: TransactionCostCategory.MEDIUM,
  [TransactionType.TROOP_STRUCTURE_ADJACENT_TRANSFER]: TransactionCostCategory.MEDIUM,
  [TransactionType.STRUCTURE_TROOP_ADJACENT_TRANSFER]: TransactionCostCategory.MEDIUM,
  [TransactionType.TROOP_BURN]: TransactionCostCategory.MEDIUM,

  // Legacy Army
  [TransactionType.ARMY_CREATE]: TransactionCostCategory.MEDIUM,
  [TransactionType.ARMY_DELETE]: TransactionCostCategory.MEDIUM,
  [TransactionType.ARMY_BUY_TROOPS]: TransactionCostCategory.MEDIUM,
  [TransactionType.ARMY_MERGE_TROOPS]: TransactionCostCategory.MEDIUM,

  // Buildings (state writes)
  [TransactionType.CREATE_BUILDING]: TransactionCostCategory.MEDIUM,
  [TransactionType.DESTROY_BUILDING]: TransactionCostCategory.MEDIUM,
  [TransactionType.LEVEL_UP]: TransactionCostCategory.MEDIUM,
  [TransactionType.DESTROY]: TransactionCostCategory.MEDIUM,
  [TransactionType.UPGRADE_LEVEL]: TransactionCostCategory.MEDIUM,

  // Resources
  [TransactionType.SEND]: TransactionCostCategory.MEDIUM,
  [TransactionType.PICKUP]: TransactionCostCategory.MEDIUM,
  [TransactionType.ARRIVALS_OFFLOAD]: TransactionCostCategory.MEDIUM,
  [TransactionType.BURN_RESOURCE_FOR_RESOURCE_PRODUCTION]: TransactionCostCategory.MEDIUM,
  [TransactionType.BURN_LABOR_FOR_RESOURCE_PRODUCTION]: TransactionCostCategory.MEDIUM,
  [TransactionType.BURN_RESOURCE_FOR_LABOR_PRODUCTION]: TransactionCostCategory.MEDIUM,
  [TransactionType.MINT_STARTING_RESOURCES]: TransactionCostCategory.MEDIUM,
  [TransactionType.MINT]: TransactionCostCategory.MEDIUM,
  [TransactionType.MINT_TEST_LORDS]: TransactionCostCategory.MEDIUM,

  // Banking
  [TransactionType.OPEN_ACCOUNT]: TransactionCostCategory.MEDIUM,
  [TransactionType.CREATE_BANKS]: TransactionCostCategory.MEDIUM,
  [TransactionType.BUY]: TransactionCostCategory.MEDIUM,
  [TransactionType.SELL]: TransactionCostCategory.MEDIUM,
  [TransactionType.ADD]: TransactionCostCategory.MEDIUM,
  [TransactionType.REMOVE]: TransactionCostCategory.MEDIUM,
  [TransactionType.DEPOSIT]: TransactionCostCategory.MEDIUM,
  [TransactionType.WITHDRAW]: TransactionCostCategory.MEDIUM,

  // Orders
  [TransactionType.CREATE_ORDER]: TransactionCostCategory.MEDIUM,
  [TransactionType.ACCEPT_ORDER]: TransactionCostCategory.MEDIUM,
  [TransactionType.ACCEPT_PARTIAL_ORDER]: TransactionCostCategory.MEDIUM,
  [TransactionType.CANCEL_ORDER]: TransactionCostCategory.MEDIUM,
  [TransactionType.CREATE]: TransactionCostCategory.MEDIUM,
  [TransactionType.ACCEPT]: TransactionCostCategory.MEDIUM,
  [TransactionType.CANCEL]: TransactionCostCategory.MEDIUM,
  [TransactionType.EDIT]: TransactionCostCategory.MEDIUM,
  [TransactionType.CREATE_MARKETPLACE_ORDERS]: TransactionCostCategory.MEDIUM,
  [TransactionType.ACCEPT_MARKETPLACE_ORDER]: TransactionCostCategory.MEDIUM,
  [TransactionType.CANCEL_MARKETPLACE_ORDER]: TransactionCostCategory.MEDIUM,
  [TransactionType.EDIT_MARKETPLACE_ORDER]: TransactionCostCategory.MEDIUM,

  // Guilds (creation)
  [TransactionType.CREATE_GUILD]: TransactionCostCategory.MEDIUM,
  [TransactionType.JOIN_GUILD]: TransactionCostCategory.MEDIUM,

  // ============================================
  // LOW COST (10) - Simple State Changes
  // ============================================

  // Production control
  [TransactionType.PAUSE_BUILDING_PRODUCTION]: TransactionCostCategory.LOW,
  [TransactionType.RESUME_BUILDING_PRODUCTION]: TransactionCostCategory.LOW,
  [TransactionType.PAUSE_PRODUCTION]: TransactionCostCategory.LOW,
  [TransactionType.RESUME_PRODUCTION]: TransactionCostCategory.LOW,

  // Naming
  [TransactionType.SET_ENTITY_NAME]: TransactionCostCategory.LOW,
  [TransactionType.SET_ADDRESS_NAME]: TransactionCostCategory.LOW,

  // Guild management
  [TransactionType.LEAVE_GUILD]: TransactionCostCategory.LOW,
  [TransactionType.REMOVE_MEMBER]: TransactionCostCategory.LOW,
  [TransactionType.UPDATE_WHITELIST]: TransactionCostCategory.LOW,
  [TransactionType.REMOVE_GUILD_MEMBER]: TransactionCostCategory.LOW,
  [TransactionType.REMOVE_PLAYER_FROM_WHITELIST]: TransactionCostCategory.LOW,
  [TransactionType.TRANSFER_GUILD_OWNERSHIP]: TransactionCostCategory.LOW,
  [TransactionType.WHITELIST_PLAYER]: TransactionCostCategory.LOW,

  // Ownership
  [TransactionType.TRANSFER_STRUCTURE_OWNERSHIP]: TransactionCostCategory.LOW,
  [TransactionType.TRANSFER_AGENT_OWNERSHIP]: TransactionCostCategory.LOW,
  [TransactionType.STRUCTURE_BURN]: TransactionCostCategory.LOW,

  // Hyperstructures (claims and simple ops)
  [TransactionType.UPDATE_CONSTRUCTION_ACCESS]: TransactionCostCategory.LOW,
  [TransactionType.CLAIM_CONSTRUCTION_POINTS]: TransactionCostCategory.LOW,
  [TransactionType.CLAIM_SHARE_POINTS]: TransactionCostCategory.LOW,
  [TransactionType.ALLOCATE_SHARES]: TransactionCostCategory.LOW,
  [TransactionType.CLAIM_WONDER_PRODUCTION_BONUS]: TransactionCostCategory.LOW,
  [TransactionType.CONTRIBUTE_TO_CONSTRUCTION]: TransactionCostCategory.LOW,

  // Approvals
  [TransactionType.ATTACH_LORDS]: TransactionCostCategory.LOW,
  [TransactionType.DETACH_LORDS]: TransactionCostCategory.LOW,
  [TransactionType.APPROVE]: TransactionCostCategory.LOW,
  [TransactionType.SET_APPROVAL_FOR_ALL]: TransactionCostCategory.LOW,
  [TransactionType.SET_CO_OWNERS]: TransactionCostCategory.LOW,
  [TransactionType.SET_ACCESS]: TransactionCostCategory.LOW,

  // Settlement
  [TransactionType.ASSIGN_REALM_POSITIONS]: TransactionCostCategory.LOW,
  [TransactionType.OBTAIN_ENTRY_TOKEN]: TransactionCostCategory.LOW,
  [TransactionType.TOKEN_LOCK]: TransactionCostCategory.LOW,

  // Quests
  [TransactionType.START_QUEST]: TransactionCostCategory.LOW,
  [TransactionType.CLAIM_REWARD]: TransactionCostCategory.LOW,
  [TransactionType.ADD_GAME]: TransactionCostCategory.LOW,
  [TransactionType.GAME_COUNT]: TransactionCostCategory.LOW,
  [TransactionType.GET_GAME_COUNT]: TransactionCostCategory.LOW,
  [TransactionType.DISABLE_QUESTS]: TransactionCostCategory.LOW,
  [TransactionType.ENABLE_QUESTS]: TransactionCostCategory.LOW,

  // Season/Leaderboard claims
  [TransactionType.SEASON_PRIZE_CLAIM]: TransactionCostCategory.LOW,
  [TransactionType.CLAIM_LEADERBOARD_REWARDS]: TransactionCostCategory.LOW,
  [TransactionType.REGISTER_TO_LEADERBOARD]: TransactionCostCategory.LOW,
  [TransactionType.BLITZ_PRIZE_PLAYER_RANK]: TransactionCostCategory.LOW,

  // Bank fees
  [TransactionType.CHANGE_OWNER_AMM_FEE]: TransactionCostCategory.LOW,
  [TransactionType.CHANGE_OWNER_BRIDGE_FEE]: TransactionCostCategory.LOW,

  // Config (Admin) - all LOW as they're typically single operations
  [TransactionType.INITIALIZE]: TransactionCostCategory.LOW,
  [TransactionType.GRANT_ROLE]: TransactionCostCategory.LOW,
  [TransactionType.SET_STARTING_RESOURCES_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_MAP_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_VILLAGE_FOUND_RESOURCES_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_VICTORY_POINTS_GRANT_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_VICTORY_POINTS_WIN_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_GAME_MODE_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_BLITZ_PREVIOUS_GAME]: TransactionCostCategory.LOW,
  [TransactionType.SET_TRAVEL_FOOD_COST_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_SEASON_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_VRF_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_RESOURCE_BRIDGE_FEE_SPLIT_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_AGENT_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_VILLAGE_TOKEN_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_CAPACITY_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_DONKEY_SPEED_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_RESOURCE_WEIGHT_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_TRADE_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_TICK_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_RESOURCE_FACTORY_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_BANK_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_RESOURCE_BRIDGE_WHITELIST_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_TROOP_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_BATTLE_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_STRUCTURE_LEVEL_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_WORLD_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_MERCENARIES_NAME_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_STRUCTURE_MAX_LEVEL_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_BUILDING_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_BUILDING_CATEGORY_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_HYPERSTRUCTURE_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_STAMINA_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_STAMINA_REFILL_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_SETTLEMENT_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_BLITZ_REGISTRATION_CONFIG]: TransactionCostCategory.LOW,
  [TransactionType.SET_QUEST_CONFIG]: TransactionCostCategory.LOW,
};

/**
 * Get the cost category for a transaction type.
 * Returns DEFAULT_CATEGORY (HIGH) for unknown types to be conservative.
 */
export function getTransactionCategory(type?: TransactionType): TransactionCostCategory {
  if (!type) return DEFAULT_CATEGORY;
  return TRANSACTION_COST_CATEGORY[type] ?? DEFAULT_CATEGORY;
}

/**
 * Get the maximum batch size for a cost category.
 */
export function getBatchLimit(category: TransactionCostCategory): number {
  return CATEGORY_BATCH_LIMITS[category];
}

/**
 * Get the maximum batch size for a transaction type.
 */
export function getTransactionBatchLimit(type?: TransactionType): number {
  const category = getTransactionCategory(type);
  return getBatchLimit(category);
}
