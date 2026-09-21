import { TransactionType } from "./types";

/**
 * Transaction cost categories for smart batching.
 * Transactions in the same category can be batched together.
 */
export enum TransactionCostCategory {
  HIGH = "HIGH", // Combat, complex operations - max 6
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
  // HIGH COST (3) - Combat, Complex Operations
  // ============================================

  // Exploration
  [TransactionType.EXPLORE]: TransactionCostCategory.HIGH,

  // Combat (complex calculations)
  [TransactionType.ATTACK_EXPLORER_VS_EXPLORER]: TransactionCostCategory.HIGH,
  [TransactionType.ATTACK_EXPLORER_VS_GUARD]: TransactionCostCategory.HIGH,
  [TransactionType.ATTACK_GUARD_VS_EXPLORER]: TransactionCostCategory.HIGH,
  [TransactionType.RAID_EXPLORER_VS_GUARD]: TransactionCostCategory.HIGH,

  [TransactionType.OPEN_CHEST]: TransactionCostCategory.HIGH,
  [TransactionType.BURN_RESEARCH_FOR_RELIC]: TransactionCostCategory.HIGH,

  // Complex operations
  [TransactionType.BITCOIN_MINE_CONTRIBUTE_LABOR]: TransactionCostCategory.HIGH,
  [TransactionType.BITCOIN_MINE_CLAIM_PHASE_REWARD]: TransactionCostCategory.HIGH,
  [TransactionType.CONTRIBUTE]: TransactionCostCategory.HIGH,
  [TransactionType.SETTLE]: TransactionCostCategory.HIGH,
  [TransactionType.END_GAME]: TransactionCostCategory.HIGH,

  // ============================================
  // MEDIUM COST (5) - State Writes, Transfers
  // ============================================

  // Explorer management
  [TransactionType.TRAVEL_HEX]: TransactionCostCategory.MEDIUM,
  [TransactionType.EXPLORER_CREATE]: TransactionCostCategory.MEDIUM,
  [TransactionType.EXPLORER_ADD]: TransactionCostCategory.MEDIUM,
  [TransactionType.EXPLORER_DELETE]: TransactionCostCategory.MEDIUM,
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

  // Legacy Army

  // Buildings (state writes)
  [TransactionType.CREATE_BUILDING]: TransactionCostCategory.MEDIUM,
  [TransactionType.DESTROY_BUILDING]: TransactionCostCategory.MEDIUM,
  [TransactionType.PROVISION_REALM]: TransactionCostCategory.MEDIUM,
  [TransactionType.LEVEL_UP]: TransactionCostCategory.MEDIUM,

  // Resources
  [TransactionType.SEND]: TransactionCostCategory.MEDIUM,
  [TransactionType.ARRIVALS_OFFLOAD]: TransactionCostCategory.MEDIUM,
  [TransactionType.BURN_RESOURCE_FOR_RESOURCE_PRODUCTION]: TransactionCostCategory.MEDIUM,
  [TransactionType.BURN_LABOR_FOR_RESOURCE_PRODUCTION]: TransactionCostCategory.MEDIUM,

  // Banking
  [TransactionType.BUY]: TransactionCostCategory.MEDIUM,
  [TransactionType.SELL]: TransactionCostCategory.MEDIUM,
  [TransactionType.REMOVE]: TransactionCostCategory.MEDIUM,

  // Orders
  [TransactionType.CREATE_ORDER]: TransactionCostCategory.MEDIUM,
  [TransactionType.ACCEPT_ORDER]: TransactionCostCategory.MEDIUM,
  [TransactionType.CANCEL_ORDER]: TransactionCostCategory.MEDIUM,
  [TransactionType.CREATE]: TransactionCostCategory.MEDIUM,

  // Guilds (creation)
  [TransactionType.CREATE_GUILD]: TransactionCostCategory.MEDIUM,
  [TransactionType.JOIN_GUILD]: TransactionCostCategory.MEDIUM,
  [TransactionType.PLEDGE_FAITH]: TransactionCostCategory.MEDIUM,
  [TransactionType.REMOVE_FAITH]: TransactionCostCategory.MEDIUM,

  // ============================================
  // LOW COST (10) - Simple State Changes
  // ============================================

  // Production control
  [TransactionType.PAUSE_BUILDING_PRODUCTION]: TransactionCostCategory.LOW,
  [TransactionType.RESUME_BUILDING_PRODUCTION]: TransactionCostCategory.LOW,

  // Naming
  [TransactionType.SET_ENTITY_NAME]: TransactionCostCategory.LOW,

  // Guild management
  [TransactionType.LEAVE_GUILD]: TransactionCostCategory.LOW,
  [TransactionType.UPDATE_WHITELIST]: TransactionCostCategory.LOW,
  [TransactionType.REMOVE_GUILD_MEMBER]: TransactionCostCategory.LOW,

  // Ownership

  // Hyperstructures (claims and simple ops)
  [TransactionType.ALLOCATE_SHARES]: TransactionCostCategory.LOW,
  [TransactionType.UPDATE_WONDER_OWNERSHIP]: TransactionCostCategory.LOW,
  [TransactionType.UPDATE_STRUCTURE_OWNERSHIP]: TransactionCostCategory.LOW,

  // Approvals
  [TransactionType.SET_ACCESS]: TransactionCostCategory.LOW,

  // Settlement

  // Season/Leaderboard claims

  // Bank fees

  // Config (Admin) - all LOW as they're typically single operations
  [TransactionType.INITIALIZE]: TransactionCostCategory.LOW,
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
 * Configuration for per-category and per-type batch delays.
 */
export interface BatchDelayConfig {
  categoryDelays?: Partial<Record<TransactionCostCategory, number>>;
  typeOverrides?: Partial<Record<TransactionType, number>>;
  defaultDelay?: number;
}

export const DEFAULT_BATCH_DELAYS: BatchDelayConfig = {
  defaultDelay: 1000,
  categoryDelays: {
    [TransactionCostCategory.HIGH]: 0,
    [TransactionCostCategory.MEDIUM]: 500,
    [TransactionCostCategory.LOW]: 1000,
  },
};

/**
 * Get the batch delay for a given transaction type, respecting type overrides,
 * category delays, and the default delay (in that priority order).
 */
export function getDelayForTransaction(type: TransactionType | undefined, config: BatchDelayConfig): number {
  if (type && config.typeOverrides?.[type] !== undefined) {
    return config.typeOverrides[type]!;
  }
  const category = getTransactionCategory(type);
  if (config.categoryDelays?.[category] !== undefined) {
    return config.categoryDelays[category]!;
  }
  return config.defaultDelay ?? 1000;
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
