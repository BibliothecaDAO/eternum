export enum TransactionType {
  // Exploration & Movement
  EXPLORE = "explore",
  TRAVEL_HEX = "travel_hex",
  EXPLORER_CREATE = "explorer_create",
  EXPLORER_ADD = "explorer_add",
  EXPLORER_DELETE = "explorer_delete",
  EXPLORER_MOVE = "explorer_move",
  EXPLORER_EXTRACT_REWARD = "explorer_extract_reward",
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
  TROOP_BURN = "troop_burn",

  // Combat
  ATTACK_EXPLORER_VS_EXPLORER = "attack_explorer_vs_explorer",
  ATTACK_EXPLORER_VS_GUARD = "attack_explorer_vs_guard",
  ATTACK_GUARD_VS_EXPLORER = "attack_guard_vs_explorer",
  RAID_EXPLORER_VS_GUARD = "raid_explorer_vs_guard",
  BATTLE_START = "battle_start",
  BATTLE_RESOLVE = "battle_resolve",
  BATTLE_FORCE_START = "battle_force_start",
  BATTLE_JOIN = "battle_join",
  BATTLE_LEAVE = "battle_leave",
  BATTLE_CLAIM = "battle_claim",

  // Legacy Army (kept for compatibility)
  ARMY_CREATE = "army_create",
  ARMY_DELETE = "army_delete",
  ARMY_BUY_TROOPS = "army_buy_troops",
  ARMY_MERGE_TROOPS = "army_merge_troops",

  // Buildings
  CREATE_BUILDING = "create_building",
  DESTROY_BUILDING = "destroy_building",
  PAUSE_BUILDING_PRODUCTION = "pause_building_production",
  RESUME_BUILDING_PRODUCTION = "resume_building_production",
  LEVEL_UP = "level_up",

  // Resources & Production
  SEND = "send",
  PICKUP = "pickup",
  ARRIVALS_OFFLOAD = "arrivals_offload",
  BURN_RESOURCE_FOR_RESOURCE_PRODUCTION = "burn_resource_for_resource_production",
  BURN_LABOR_FOR_RESOURCE_PRODUCTION = "burn_labor_for_resource_production",
  BURN_RESOURCE_FOR_LABOR_PRODUCTION = "burn_resource_for_labor_production",
  MINT_STARTING_RESOURCES = "mint_starting_resources",
  MINT = "mint",
  MINT_TEST_LORDS = "mint_test_lords",

  // Banking & Trading
  OPEN_ACCOUNT = "open_account",
  CREATE_BANKS = "create_banks",
  CHANGE_OWNER_AMM_FEE = "change_owner_amm_fee",
  CHANGE_OWNER_BRIDGE_FEE = "change_owner_bridge_fee",
  BUY = "buy",
  SELL = "sell",
  ADD = "add",
  REMOVE = "remove",
  DEPOSIT = "deposit",
  WITHDRAW = "withdraw",

  // Orders & Marketplace
  CREATE_ORDER = "create_order",
  ACCEPT_ORDER = "accept_order",
  ACCEPT_PARTIAL_ORDER = "accept_partial_order",
  CANCEL_ORDER = "cancel_order",
  CREATE = "create",
  ACCEPT = "accept",
  CANCEL = "cancel",
  EDIT = "edit",

  // Guilds
  CREATE_GUILD = "create_guild",
  JOIN_GUILD = "join_guild",
  LEAVE_GUILD = "leave_guild",
  REMOVE_MEMBER = "remove_member",
  UPDATE_WHITELIST = "update_whitelist",
  REMOVE_GUILD_MEMBER = "remove_guild_member",
  REMOVE_PLAYER_FROM_WHITELIST = "remove_player_from_whitelist",
  TRANSFER_GUILD_OWNERSHIP = "transfer_guild_ownership",
  WHITELIST_PLAYER = "whitelist_player",

  // Structures & Ownership
  TRANSFER_STRUCTURE_OWNERSHIP = "transfer_structure_ownership",
  TRANSFER_AGENT_OWNERSHIP = "transfer_agent_ownership",
  STRUCTURE_BURN = "structure_burn",
  SET_ENTITY_NAME = "set_entity_name",
  SET_ADDRESS_NAME = "set_address_name",

  // Hyperstructures
  CONTRIBUTE = "contribute",
  UPDATE_CONSTRUCTION_ACCESS = "update_construction_access",
  MAKE_HYPERSTRUCTURES = "make_hyperstructures",
  CLAIM_CONSTRUCTION_POINTS = "claim_construction_points",
  CLAIM_SHARE_POINTS = "claim_share_points",
  ALLOCATE_SHARES = "allocate_shares",
  CLAIM_WONDER_PRODUCTION_BONUS = "claim_wonder_production_bonus",

  // Realms & Settlement
  SETTLE_REALMS = "settle_realms",
  ASSIGN_REALM_POSITIONS = "assign_realm_positions",
  OBTAIN_ENTRY_TOKEN = "obtain_entry_token",
  REGISTER = "register",
  TOKEN_LOCK = "token_lock",

  // Lords & Approvals
  ATTACH_LORDS = "attach_lords",
  DETACH_LORDS = "detach_lords",
  APPROVE = "approve",
  SET_APPROVAL_FOR_ALL = "set_approval_for_all",
  SET_CO_OWNERS = "set_co_owners",
  SET_ACCESS = "set_access",

  // Quests
  START_QUEST = "start_quest",
  CLAIM_REWARD = "claim_reward",
  ADD_GAME = "add_game",
  GAME_COUNT = "game_count",
  DISABLE_QUESTS = "disable_quests",
  ENABLE_QUESTS = "enable_quests",

  // Season & Leaderboard
  SEASON_CLOSE = "season_close",
  SEASON_PRIZE_CLAIM = "season_prize_claim",
  CLAIM_LEADERBOARD_REWARDS = "claim_leaderboard_rewards",
  REGISTER_TO_LEADERBOARD = "register_to_leaderboard",
  END_GAME = "end_game",

  // Blitz
  BLITZ_PRIZE_CLAIM = "blitz_prize_claim",
  BLITZ_PRIZE_PLAYER_RANK = "blitz_prize_player_rank",
  BLITZ_PRIZE_CLAIM_NO_GAME = "blitz_prize_claim_no_game",

  // Chests & Relics
  OPEN_CHEST = "open_chest",
  APPLY_RELIC = "apply_relic",

  // VRF
  REQUEST_RANDOM = "request_random",

  // Config (Admin)
  INITIALIZE = "initialize",
  GRANT_ROLE = "grant_role",
  SET_STARTING_RESOURCES_CONFIG = "set_starting_resources_config",
  SET_MAP_CONFIG = "set_map_config",
  SET_VILLAGE_FOUND_RESOURCES_CONFIG = "set_village_found_resources_config",
  SET_VICTORY_POINTS_GRANT_CONFIG = "set_victory_points_grant_config",
  SET_VICTORY_POINTS_WIN_CONFIG = "set_victory_points_win_config",
  SET_GAME_MODE_CONFIG = "set_game_mode_config",
  SET_BLITZ_PREVIOUS_GAME = "set_blitz_previous_game",
  SET_TRAVEL_FOOD_COST_CONFIG = "set_travel_food_cost_config",
  SET_SEASON_CONFIG = "set_season_config",
  SET_VRF_CONFIG = "set_vrf_config",
  SET_RESOURCE_BRIDGE_FEE_SPLIT_CONFIG = "set_resource_bridge_fee_split_config",
  SET_AGENT_CONFIG = "set_agent_config",
  SET_VILLAGE_TOKEN_CONFIG = "set_village_token_config",
  SET_CAPACITY_CONFIG = "set_capacity_config",
  SET_DONKEY_SPEED_CONFIG = "set_donkey_speed_config",
  SET_RESOURCE_WEIGHT_CONFIG = "set_resource_weight_config",
  SET_TRADE_CONFIG = "set_trade_config",
  SET_TICK_CONFIG = "set_tick_config",
  SET_RESOURCE_FACTORY_CONFIG = "set_resource_factory_config",
  SET_BANK_CONFIG = "set_bank_config",
  SET_RESOURCE_BRIDGE_WHITELIST_CONFIG = "set_resource_bridge_whitelist_config",
  SET_TROOP_CONFIG = "set_troop_config",
  SET_BATTLE_CONFIG = "set_battle_config",
  SET_STRUCTURE_LEVEL_CONFIG = "set_structure_level_config",
  SET_WORLD_CONFIG = "set_world_config",
  SET_MERCENARIES_NAME_CONFIG = "set_mercenaries_name_config",
  SET_STRUCTURE_MAX_LEVEL_CONFIG = "set_structure_max_level_config",
  SET_BUILDING_CONFIG = "set_building_config",
  SET_BUILDING_CATEGORY_CONFIG = "set_building_category_config",
  SET_HYPERSTRUCTURE_CONFIG = "set_hyperstructure_config",
  SET_STAMINA_CONFIG = "set_stamina_config",
  SET_STAMINA_REFILL_CONFIG = "set_stamina_refill_config",
  SET_SETTLEMENT_CONFIG = "set_settlement_config",
  SET_BLITZ_REGISTRATION_CONFIG = "set_blitz_registration_config",
  SET_QUEST_CONFIG = "set_quest_config",

  // Legacy (kept for compatibility)
  RESUME_PRODUCTION = "resume_production",
  PAUSE_PRODUCTION = "pause_production",
  DESTROY = "destroy",
  UPGRADE_LEVEL = "upgrade_level",
  CREATE_MARKETPLACE_ORDERS = "create_marketplace_orders",
  ACCEPT_MARKETPLACE_ORDER = "accept_marketplace_order",
  CANCEL_MARKETPLACE_ORDER = "cancel_marketplace_order",
  EDIT_MARKETPLACE_ORDER = "edit_marketplace_order",
  GET_GAME_COUNT = "get_game_count",
  CONTRIBUTE_TO_CONSTRUCTION = "contribute_to_construction",
}
