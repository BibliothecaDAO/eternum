export enum TransactionType {
  EXPLORE = "explore",
  TRAVEL_HEX = "travel_hex",
  OPEN_ACCOUNT = "open_account",
  CHANGE_OWNER_AMM_FEE = "change_owner_amm_fee",
  CHANGE_OWNER_BRIDGE_FEE = "change_owner_bridge_fee",
  BUY = "buy",
  SELL = "sell",
  ADD = "add",
  REMOVE = "remove",
  ARMY_CREATE = "army_create",
  ARMY_DELETE = "army_delete",
  ARMY_BUY_TROOPS = "army_buy_troops",
  ARMY_MERGE_TROOPS = "army_merge_troops",
  BATTLE_START = "battle_start",
  BATTLE_RESOLVE = "battle_resolve",
  BATTLE_FORCE_START = "battle_force_start",
  BATTLE_JOIN = "battle_join",
  BATTLE_LEAVE = "battle_leave",
  BATTLE_CLAIM = "battle_claim",
  SEND = "send",
  PICKUP = "pickup",
  CREATE_ORDER = "create_order",
  ACCEPT_ORDER = "accept_order",
  ACCEPT_PARTIAL_ORDER = "accept_partial_order",
  REMOVE_GUILD_MEMBER = "remove_guild_member",
  ATTACH_LORDS = "attach_lords",
  APPROVE = "approve",
  CREATE_BANKS = "create_banks",
  SET_CO_OWNERS = "set_co_owners",
  CLAIM_LEADERBOARD_REWARDS = "claim_leaderboard_rewards",
  REGISTER_TO_LEADERBOARD = "register_to_leaderboard",
  END_GAME = "end_game",
  SET_ACCESS = "set_access",
  CONTRIBUTE_TO_CONSTRUCTION = "contribute_to_construction",
  CREATE = "create",
  REMOVE_PLAYER_FROM_WHITELIST = "remove_player_from_whitelist",
  TRANSFER_GUILD_OWNERSHIP = "transfer_guild_ownership",
  WHITELIST_PLAYER = "whitelist_player",
  CREATE_GUILD = "create_guild",
  JOIN_GUILD = "join_guild",
  MINT_STARTING_RESOURCES = "mint_starting_resources",
  RESUME_PRODUCTION = "resume_production",
  PAUSE_PRODUCTION = "pause_production",
  DESTROY = "destroy",
  SET_ENTITY_NAME = "set_entity_name",
  SET_ADDRESS_NAME = "set_address_name",
  UPGRADE_LEVEL = "upgrade_level",
  CANCEL_ORDER = "cancel_order",
  CREATE_MARKETPLACE_ORDERS = "create_marketplace_orders",
  ACCEPT_MARKETPLACE_ORDER = "accept_marketplace_order",
  CANCEL_MARKETPLACE_ORDER = "cancel_marketplace_order",
  EDIT_MARKETPLACE_ORDER = "edit_marketplace_order",
  LEAVE_GUILD = "leave_guild",
  START_QUEST = "start_quest",
  CLAIM_REWARD = "claim_reward",
  GET_GAME_COUNT = "get_game_count",
  TRANSFER_STRUCTURE_OWNERSHIP = "transfer_structure_ownership",
  TRANSFER_AGENT_OWNERSHIP = "transfer_agent_ownership",
  STRUCTURE_BURN = "structure_burn",
  TROOP_BURN = "troop_burn",
  BLITZ_PRIZE_CLAIM = "blitz_prize_claim",
  BLITZ_PRIZE_PLAYER_RANK = "blitz_prize_player_rank",
}

export type ProviderHeartbeatSource = "transaction-submitted" | "transaction-confirmed" | "stream" | "mock";

export interface ProviderHeartbeat {
  source: ProviderHeartbeatSource;
  timestamp: number;
  blockNumber?: number;
  transactionHash?: string;
}

export interface ProviderSyncState {
  lastTransactionSubmittedAt: number | null;
  lastTransactionConfirmedAt: number | null;
  lastStreamAt: number | null;
  lastBlockNumber: number | null;
  lastHeartbeat: ProviderHeartbeat | null;
}
