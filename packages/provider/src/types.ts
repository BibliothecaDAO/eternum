export type TransactionFailureStage = "submit" | "confirmation" | "revert" | "background_confirmation";

/** not_sent: this submission was explicitly refused at admission; an unknown hash never establishes this. */
export type TransactionSubmitFailureKind = "provider_connection_destroyed" | "submit_failed" | "not_sent";

export type TransactionProviderState = "ready" | "destroyed" | "unavailable" | "unknown";

export type TransactionRetrySafety = "safe_after_reconnect" | "unsafe_until_wallet_checked" | "unknown";

export interface TransactionLifecycleMeta {
  type?: TransactionType;
  transactionHash?: string;
  signerAddress?: string;
  transactionCount?: number;
  entrypoints?: string[];
  contractAddresses?: string[];
}

export interface TransactionFailedPayload extends TransactionLifecycleMeta {
  message: string;
  stage: TransactionFailureStage;
  failureKind?: TransactionSubmitFailureKind;
  providerState?: TransactionProviderState;
  hasTxHash?: boolean;
  retrySafety?: TransactionRetrySafety;
  /** The original error, untouched. */
  error?: unknown;
  /** Raw revert reason from the receipt, verbatim, when the transaction reverted on-chain. */
  revertReason?: string;
}

export interface TransactionSubmitGuardContext extends TransactionLifecycleMeta {
  transactionType?: TransactionType;
  signerAddress?: string;
  providerState?: TransactionProviderState;
}

export type TransactionSubmitGuard = (context: TransactionSubmitGuardContext) => Promise<void> | void;

interface TransactionStreamStatus {
  block: number | null;
  hash: string;
  batchRemaining?: string;
  revertReason?: string;
  status: string;
}

/**
 * Waits for a transaction's outcome, settled once Herald has applied it; `inBlock`, when the submission reconciles
 * its sends, is a fallback while Herald is silent. Command identity identifies batch receipt requirements.
 */
export type TransactionStreamWaiter = (
  transactionHash: string,
  inBlock?: Promise<void>,
  transactionType?: TransactionType,
  startedAt?: number,
) => Promise<TransactionStreamStatus>;

export enum TransactionType {
  PROVISION_REALM = "provision_realm",
  BITCOIN_MINE_CONTRIBUTE_LABOR = "bitcoin_mine_contribute_labor",
  BITCOIN_MINE_CLAIM_PHASE_REWARD = "bitcoin_mine_claim_phase_reward",
  BITCOIN_MINE_CLOSE_PHASE = "bitcoin_mine_close_phase",
  BITCOIN_MINE_BIND_PHASE = "bitcoin_mine_bind_phase",
  // Exploration & Movement
  EXPLORE = "explore",
  TRAVEL_HEX = "travel_hex",
  TOGGLE_ALTERNATE = "toggle_alternate",
  ENTER_DEPTH = "enter_depth",
  RESEARCH = "research",
  BUY_TIER = "buy_tier",
  REFILL_STAMINA = "refill_stamina",
  WITHDRAW_LORDS = "withdraw_lords",
  EXPLORER_CREATE = "explorer_create",
  EXPLORER_ADD = "explorer_add",
  EXPLORER_DELETE = "explorer_delete",
  EXPLORER_EXPLORER_SWAP = "explorer_explorer_swap",
  EXPLORER_GUARD_SWAP = "explorer_guard_swap",
  GUARD_EXPLORER_SWAP = "guard_explorer_swap",

  // Guards
  GUARD_ADD = "guard_add",
  GUARD_DELETE = "guard_delete",

  // Troops & Transfers
  TROOP_TROOP_ADJACENT_TRANSFER = "troop_troop_adjacent_transfer",
  TROOP_STRUCTURE_ADJACENT_TRANSFER = "troop_structure_adjacent_transfer",
  STRUCTURE_TROOP_ADJACENT_TRANSFER = "structure_troop_adjacent_transfer",

  // Combat
  ATTACK_EXPLORER_VS_EXPLORER = "attack_explorer_vs_explorer",
  ATTACK_EXPLORER_VS_GUARD = "attack_explorer_vs_guard",
  ATTACK_GUARD_VS_EXPLORER = "attack_guard_vs_explorer",
  RAID_EXPLORER_VS_GUARD = "raid_explorer_vs_guard",

  // Legacy Army (kept for compatibility)

  // Buildings
  CREATE_BUILDING = "create_building",
  DESTROY_BUILDING = "destroy_building",
  PAUSE_BUILDING_PRODUCTION = "pause_building_production",
  RESUME_BUILDING_PRODUCTION = "resume_building_production",
  LEVEL_UP = "level_up",

  // Resources & Production
  SEND = "send",
  ARRIVALS_OFFLOAD = "arrivals_offload",
  BURN_RESOURCE_FOR_RESOURCE_PRODUCTION = "burn_resource_for_resource_production",
  BURN_LABOR_FOR_RESOURCE_PRODUCTION = "burn_labor_for_resource_production",

  // Banking & Trading
  BUY = "buy",
  SELL = "sell",
  REMOVE = "remove",
  ADD_LIQUIDITY = "add_liquidity",
  BRIDGE_DEPOSIT = "bridge_deposit",
  BRIDGE_WITHDRAW = "bridge_withdraw",

  // Orders & Marketplace
  CREATE_ORDER = "create_order",
  ACCEPT_ORDER = "accept_order",
  CANCEL_ORDER = "cancel_order",
  CREATE = "create",

  // Guilds
  CREATE_GUILD = "create_guild",
  JOIN_GUILD = "join_guild",
  LEAVE_GUILD = "leave_guild",
  UPDATE_WHITELIST = "update_whitelist",
  REMOVE_GUILD_MEMBER = "remove_guild_member",

  // Structures & Ownership
  SET_ENTITY_NAME = "set_entity_name",
  TRANSFER_STRUCTURE_OWNERSHIP = "transfer_structure_ownership",
  STRUCTURE_BURN = "structure_burn",

  // Hyperstructures
  CREATE_HYPERSTRUCTURE = "create_hyperstructure",
  INITIALIZE_HYPERSTRUCTURE = "initialize_hyperstructure",
  CONTRIBUTE = "contribute",
  CLAIM_WONDER_POINTS = "claim_wonder_points",
  CLAIM_PLAYER_FAITH_POINTS = "claim_player_faith_points",
  PLEDGE_FAITH = "pledge_faith",
  REMOVE_FAITH = "remove_faith",
  UPDATE_WONDER_OWNERSHIP = "update_wonder_ownership",
  UPDATE_STRUCTURE_OWNERSHIP = "update_structure_ownership",

  // Realms & Settlement
  SETTLE = "settle",

  // Lords & Approvals
  SET_ACCESS = "set_access",

  // Season & Leaderboard
  END_GAME = "end_game",

  // Blitz

  // Chests & Relics
  OPEN_CHEST = "open_chest",
  INTERACT_SITE = "interact_site",
  BURN_RESEARCH_FOR_RELIC = "burn_research_for_relic",
  APPLY_RELIC = "apply_relic",

  // Legacy (kept for compatibility)
}
