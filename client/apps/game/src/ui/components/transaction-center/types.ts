import { TransactionType } from "@bibliothecadao/provider";
import type { TransactionStatus } from "@/hooks/store/use-transaction-store";

const getChain = () => import.meta.env.VITE_PUBLIC_CHAIN as string | undefined;
const getSlotName = () => import.meta.env.VITE_PUBLIC_SLOT as string | undefined;

export const getExplorerTxUrl = (hash: string): string => {
  const chain = getChain();
  const slotName = getSlotName();

  if (chain === "slot" && slotName) {
    return `https://api.cartridge.gg/x/${slotName}/katana/explorer/tx/${hash}`;
  }

  if (chain === "sepolia") {
    return `https://sepolia.voyager.online/tx/${hash}`;
  }

  // Default to mainnet
  return `https://voyager.online/tx/${hash}`;
};

export const getExplorerName = (): string => {
  const chain = getChain();
  if (chain === "slot") return "Katana Explorer";
  return "Voyager";
};

export const getTxMessage = (type: TransactionType): string => {
  switch (type) {
    // Exploration & Movement
    case TransactionType.EXPLORE:
      return "Scouts sent to explore new lands";
    case TransactionType.TRAVEL_HEX:
      return "Journeyed to distant lands";
    case TransactionType.EXPLORER_CREATE:
      return "Created new explorer";
    case TransactionType.EXPLORER_ADD:
      return "Added troops to explorer";
    case TransactionType.EXPLORER_DELETE:
      return "Disbanded explorer";
    case TransactionType.EXPLORER_MOVE:
      return "Explorer moved";
    case TransactionType.EXPLORER_EXTRACT_REWARD:
      return "Extracted exploration rewards";
    case TransactionType.EXPLORER_EXPLORER_SWAP:
      return "Swapped troops between explorers";
    case TransactionType.EXPLORER_GUARD_SWAP:
      return "Swapped troops from explorer to guard";
    case TransactionType.GUARD_EXPLORER_SWAP:
      return "Swapped troops from guard to explorer";

    // Guards
    case TransactionType.GUARD_ADD:
      return "Added guard to structure";
    case TransactionType.GUARD_DELETE:
      return "Removed guard from structure";

    // Troops & Transfers
    case TransactionType.TROOP_TROOP_ADJACENT_TRANSFER:
      return "Transferred troops between units";
    case TransactionType.TROOP_STRUCTURE_ADJACENT_TRANSFER:
      return "Transferred troops to structure";
    case TransactionType.STRUCTURE_TROOP_ADJACENT_TRANSFER:
      return "Transferred troops from structure";
    case TransactionType.TROOP_BURN:
      return "Burned troops";

    // Combat
    case TransactionType.ATTACK_EXPLORER_VS_EXPLORER:
      return "Explorer attacked explorer";
    case TransactionType.ATTACK_EXPLORER_VS_GUARD:
      return "Explorer attacked guard";
    case TransactionType.ATTACK_GUARD_VS_EXPLORER:
      return "Guard attacked explorer";
    case TransactionType.RAID_EXPLORER_VS_GUARD:
      return "Explorer raided structure";
    case TransactionType.BATTLE_START:
      return "Commenced battle";
    case TransactionType.BATTLE_RESOLVE:
      return "Battle resolved";
    case TransactionType.BATTLE_FORCE_START:
      return "Forced battle to commence";
    case TransactionType.BATTLE_JOIN:
      return "Joined the fray";
    case TransactionType.BATTLE_LEAVE:
      return "Retreated from battle";
    case TransactionType.BATTLE_CLAIM:
      return "Claimed spoils of war";

    // Legacy Army
    case TransactionType.ARMY_CREATE:
      return "Raised a new army";
    case TransactionType.ARMY_DELETE:
      return "Disbanded troops";
    case TransactionType.ARMY_BUY_TROOPS:
      return "Recruited soldiers";
    case TransactionType.ARMY_MERGE_TROOPS:
      return "Combined battalions";

    // Buildings
    case TransactionType.CREATE_BUILDING:
      return "Constructed new building";
    case TransactionType.DESTROY_BUILDING:
      return "Demolished building";
    case TransactionType.PAUSE_BUILDING_PRODUCTION:
      return "Paused building production";
    case TransactionType.RESUME_BUILDING_PRODUCTION:
      return "Resumed building production";
    case TransactionType.LEVEL_UP:
      return "Upgraded building level";

    // Resources & Production
    case TransactionType.SEND:
      return "Sent resources";
    case TransactionType.PICKUP:
      return "Collected resources";
    case TransactionType.ARRIVALS_OFFLOAD:
      return "Offloaded arrivals";
    case TransactionType.BURN_RESOURCE_FOR_RESOURCE_PRODUCTION:
      return "Converted resources";
    case TransactionType.BURN_LABOR_FOR_RESOURCE_PRODUCTION:
      return "Used labor for production";
    case TransactionType.BURN_RESOURCE_FOR_LABOR_PRODUCTION:
      return "Converted resources to labor";
    case TransactionType.MINT_STARTING_RESOURCES:
      return "Received starting resources";
    case TransactionType.MINT:
      return "Minted tokens";
    case TransactionType.MINT_TEST_LORDS:
      return "Minted test LORDS";

    // Banking & Trading
    case TransactionType.OPEN_ACCOUNT:
      return "Opened ledger with the royal bank";
    case TransactionType.CREATE_BANKS:
      return "Established royal treasury";
    case TransactionType.CHANGE_OWNER_AMM_FEE:
      return "Adjusted bank fees";
    case TransactionType.CHANGE_OWNER_BRIDGE_FEE:
      return "Adjusted bridge fees";
    case TransactionType.BUY:
      return "Purchased from the market";
    case TransactionType.SELL:
      return "Sold on the market";
    case TransactionType.ADD:
      return "Added liquidity";
    case TransactionType.REMOVE:
      return "Withdrew liquidity";
    case TransactionType.DEPOSIT:
      return "Deposited tokens";
    case TransactionType.WITHDRAW:
      return "Withdrew tokens";

    // Orders & Marketplace
    case TransactionType.CREATE_ORDER:
      return "Posted trade decree";
    case TransactionType.ACCEPT_ORDER:
      return "Accepted trade decree";
    case TransactionType.ACCEPT_PARTIAL_ORDER:
      return "Accepted portion of trade decree";
    case TransactionType.CANCEL_ORDER:
      return "Cancelled order";
    case TransactionType.CREATE:
      return "Created marketplace order";
    case TransactionType.ACCEPT:
      return "Accepted marketplace order";
    case TransactionType.CANCEL:
      return "Cancelled marketplace order";
    case TransactionType.EDIT:
      return "Edited marketplace order";

    // Guilds
    case TransactionType.CREATE_GUILD:
      return "Created new tribe";
    case TransactionType.JOIN_GUILD:
      return "Joined tribe";
    case TransactionType.LEAVE_GUILD:
      return "Left tribe";
    case TransactionType.REMOVE_MEMBER:
      return "Removed member from tribe";
    case TransactionType.UPDATE_WHITELIST:
      return "Updated tribe whitelist";
    case TransactionType.REMOVE_GUILD_MEMBER:
      return "Expelled member from tribe";
    case TransactionType.REMOVE_PLAYER_FROM_WHITELIST:
      return "Removed player from whitelist";
    case TransactionType.TRANSFER_GUILD_OWNERSHIP:
      return "Transferred tribe ownership";
    case TransactionType.WHITELIST_PLAYER:
      return "Added player to whitelist";

    // Structures & Ownership
    case TransactionType.TRANSFER_STRUCTURE_OWNERSHIP:
      return "Transferred structure ownership";
    case TransactionType.TRANSFER_AGENT_OWNERSHIP:
      return "Transferred agent ownership";
    case TransactionType.STRUCTURE_BURN:
      return "Burned structure";
    case TransactionType.SET_ENTITY_NAME:
      return "Named entity";
    case TransactionType.SET_ADDRESS_NAME:
      return "Set address name";

    // Hyperstructures
    case TransactionType.CONTRIBUTE:
      return "Contributed to hyperstructure";
    case TransactionType.UPDATE_CONSTRUCTION_ACCESS:
      return "Updated construction access";
    case TransactionType.MAKE_HYPERSTRUCTURES:
      return "Created hyperstructures";
    case TransactionType.CLAIM_CONSTRUCTION_POINTS:
      return "Claimed construction points";
    case TransactionType.CLAIM_SHARE_POINTS:
      return "Claimed share points";
    case TransactionType.ALLOCATE_SHARES:
      return "Allocated shares";
    case TransactionType.CLAIM_WONDER_PRODUCTION_BONUS:
      return "Claimed wonder production bonus";

    // Realms & Settlement
    case TransactionType.SETTLE_REALMS:
      return "Settled realms";
    case TransactionType.ASSIGN_REALM_POSITIONS:
      return "Assigned realm positions";
    case TransactionType.OBTAIN_ENTRY_TOKEN:
      return "Obtained entry token";
    case TransactionType.REGISTER:
      return "Registered in the realm";
    case TransactionType.TOKEN_LOCK:
      return "Locked tokens";

    // Lords & Approvals
    case TransactionType.ATTACH_LORDS:
      return "Pledged LORDS tokens";
    case TransactionType.DETACH_LORDS:
      return "Withdrew LORDS tokens";
    case TransactionType.APPROVE:
      return "Authorized resource transfer";
    case TransactionType.SET_APPROVAL_FOR_ALL:
      return "Set approval for all tokens";
    case TransactionType.SET_CO_OWNERS:
      return "Updated shareholders";
    case TransactionType.SET_ACCESS:
      return "Access rights updated";

    // Quests
    case TransactionType.START_QUEST:
      return "Started quest";
    case TransactionType.CLAIM_REWARD:
      return "Claimed reward";
    case TransactionType.ADD_GAME:
      return "Added game";
    case TransactionType.GAME_COUNT:
      return "Retrieved game count";
    case TransactionType.DISABLE_QUESTS:
      return "Disabled quests";
    case TransactionType.ENABLE_QUESTS:
      return "Enabled quests";

    // Season & Leaderboard
    case TransactionType.SEASON_CLOSE:
      return "Season closed";
    case TransactionType.SEASON_PRIZE_CLAIM:
      return "Claimed season prize";
    case TransactionType.CLAIM_LEADERBOARD_REWARDS:
      return "Claimed leaderboard rewards";
    case TransactionType.REGISTER_TO_LEADERBOARD:
      return "Registered for leaderboard";
    case TransactionType.END_GAME:
      return "Game has ended";

    // Blitz
    case TransactionType.BLITZ_PRIZE_CLAIM:
      return "Claimed blitz prize";
    case TransactionType.BLITZ_PRIZE_PLAYER_RANK:
      return "Submitted blitz rankings";
    case TransactionType.BLITZ_PRIZE_CLAIM_NO_GAME:
      return "Claimed blitz prize (no game)";

    // Chests & Relics
    case TransactionType.OPEN_CHEST:
      return "Opened treasure chest";
    case TransactionType.APPLY_RELIC:
      return "Applied relic";

    // VRF
    case TransactionType.REQUEST_RANDOM:
      return "Requested randomness";

    // Config (Admin)
    case TransactionType.INITIALIZE:
      return "Initialized configuration";
    case TransactionType.GRANT_ROLE:
      return "Granted role";
    case TransactionType.SET_STARTING_RESOURCES_CONFIG:
    case TransactionType.SET_MAP_CONFIG:
    case TransactionType.SET_VILLAGE_FOUND_RESOURCES_CONFIG:
    case TransactionType.SET_VICTORY_POINTS_GRANT_CONFIG:
    case TransactionType.SET_VICTORY_POINTS_WIN_CONFIG:
    case TransactionType.SET_GAME_MODE_CONFIG:
    case TransactionType.SET_BLITZ_PREVIOUS_GAME:
    case TransactionType.SET_TRAVEL_FOOD_COST_CONFIG:
    case TransactionType.SET_SEASON_CONFIG:
    case TransactionType.SET_VRF_CONFIG:
    case TransactionType.SET_RESOURCE_BRIDGE_FEE_SPLIT_CONFIG:
    case TransactionType.SET_AGENT_CONFIG:
    case TransactionType.SET_VILLAGE_TOKEN_CONFIG:
    case TransactionType.SET_CAPACITY_CONFIG:
    case TransactionType.SET_DONKEY_SPEED_CONFIG:
    case TransactionType.SET_RESOURCE_WEIGHT_CONFIG:
    case TransactionType.SET_TRADE_CONFIG:
    case TransactionType.SET_TICK_CONFIG:
    case TransactionType.SET_RESOURCE_FACTORY_CONFIG:
    case TransactionType.SET_BANK_CONFIG:
    case TransactionType.SET_RESOURCE_BRIDGE_WHITELIST_CONFIG:
    case TransactionType.SET_TROOP_CONFIG:
    case TransactionType.SET_BATTLE_CONFIG:
    case TransactionType.SET_STRUCTURE_LEVEL_CONFIG:
    case TransactionType.SET_WORLD_CONFIG:
    case TransactionType.SET_MERCENARIES_NAME_CONFIG:
    case TransactionType.SET_STRUCTURE_MAX_LEVEL_CONFIG:
    case TransactionType.SET_BUILDING_CONFIG:
    case TransactionType.SET_BUILDING_CATEGORY_CONFIG:
    case TransactionType.SET_HYPERSTRUCTURE_CONFIG:
    case TransactionType.SET_STAMINA_CONFIG:
    case TransactionType.SET_STAMINA_REFILL_CONFIG:
    case TransactionType.SET_SETTLEMENT_CONFIG:
    case TransactionType.SET_BLITZ_REGISTRATION_CONFIG:
    case TransactionType.SET_QUEST_CONFIG:
      return "Updated game configuration";

    // Legacy
    case TransactionType.RESUME_PRODUCTION:
      return "Resumed production";
    case TransactionType.PAUSE_PRODUCTION:
      return "Paused production";
    case TransactionType.DESTROY:
      return "Destroyed building";
    case TransactionType.UPGRADE_LEVEL:
      return "Upgraded level";
    case TransactionType.CREATE_MARKETPLACE_ORDERS:
      return "Created marketplace orders";
    case TransactionType.ACCEPT_MARKETPLACE_ORDER:
      return "Accepted marketplace order";
    case TransactionType.CANCEL_MARKETPLACE_ORDER:
      return "Cancelled marketplace order";
    case TransactionType.EDIT_MARKETPLACE_ORDER:
      return "Edited marketplace order";
    case TransactionType.GET_GAME_COUNT:
      return "Retrieved game count";
    case TransactionType.CONTRIBUTE_TO_CONSTRUCTION:
      return "Contributed to construction";

    default:
      return "Royal decree executed";
  }
};

export const getTxIcon = (type: TransactionType): string => {
  switch (type) {
    // Exploration & Movement
    case TransactionType.EXPLORE:
    case TransactionType.TRAVEL_HEX:
    case TransactionType.EXPLORER_MOVE:
    case TransactionType.START_QUEST:
      return "🗺️";
    case TransactionType.EXPLORER_CREATE:
    case TransactionType.EXPLORER_ADD:
      return "🧭";
    case TransactionType.EXPLORER_DELETE:
      return "🏃";
    case TransactionType.EXPLORER_EXTRACT_REWARD:
      return "💎";
    case TransactionType.EXPLORER_EXPLORER_SWAP:
    case TransactionType.EXPLORER_GUARD_SWAP:
    case TransactionType.GUARD_EXPLORER_SWAP:
      return "🔀";

    // Guards
    case TransactionType.GUARD_ADD:
      return "🛡️";
    case TransactionType.GUARD_DELETE:
      return "🏃";

    // Troops & Transfers
    case TransactionType.TROOP_TROOP_ADJACENT_TRANSFER:
    case TransactionType.TROOP_STRUCTURE_ADJACENT_TRANSFER:
    case TransactionType.STRUCTURE_TROOP_ADJACENT_TRANSFER:
      return "🔄";

    // Combat
    case TransactionType.ATTACK_EXPLORER_VS_EXPLORER:
    case TransactionType.ATTACK_EXPLORER_VS_GUARD:
    case TransactionType.ATTACK_GUARD_VS_EXPLORER:
    case TransactionType.BATTLE_START:
    case TransactionType.BATTLE_RESOLVE:
    case TransactionType.BATTLE_FORCE_START:
    case TransactionType.BATTLE_JOIN:
      return "⚔️";
    case TransactionType.RAID_EXPLORER_VS_GUARD:
      return "💰";
    case TransactionType.BATTLE_LEAVE:
      return "🏃";
    case TransactionType.BATTLE_CLAIM:
      return "🏆";

    // Legacy Army
    case TransactionType.ARMY_CREATE:
    case TransactionType.ARMY_BUY_TROOPS:
    case TransactionType.ARMY_MERGE_TROOPS:
      return "⚔️";
    case TransactionType.ARMY_DELETE:
      return "🏃";

    // Buildings
    case TransactionType.CREATE_BUILDING:
      return "🏗️";
    case TransactionType.DESTROY_BUILDING:
      return "💥";
    case TransactionType.PAUSE_BUILDING_PRODUCTION:
      return "⏸️";
    case TransactionType.RESUME_BUILDING_PRODUCTION:
      return "▶️";
    case TransactionType.LEVEL_UP:
    case TransactionType.UPGRADE_LEVEL:
      return "⬆️";

    // Resources & Production
    case TransactionType.SEND:
    case TransactionType.PICKUP:
    case TransactionType.ARRIVALS_OFFLOAD:
      return "📦";
    case TransactionType.BURN_RESOURCE_FOR_RESOURCE_PRODUCTION:
    case TransactionType.BURN_LABOR_FOR_RESOURCE_PRODUCTION:
    case TransactionType.BURN_RESOURCE_FOR_LABOR_PRODUCTION:
      return "🔥";
    case TransactionType.MINT_STARTING_RESOURCES:
    case TransactionType.MINT:
    case TransactionType.MINT_TEST_LORDS:
      return "✨";

    // Banking & Trading
    case TransactionType.OPEN_ACCOUNT:
    case TransactionType.CREATE_BANKS:
      return "🏦";
    case TransactionType.BUY:
    case TransactionType.SELL:
    case TransactionType.ADD:
    case TransactionType.REMOVE:
    case TransactionType.CHANGE_OWNER_AMM_FEE:
    case TransactionType.CHANGE_OWNER_BRIDGE_FEE:
      return "💰";
    case TransactionType.DEPOSIT:
    case TransactionType.WITHDRAW:
      return "🏦";

    // Orders & Marketplace
    case TransactionType.CREATE_ORDER:
    case TransactionType.ACCEPT_ORDER:
    case TransactionType.ACCEPT_PARTIAL_ORDER:
    case TransactionType.CREATE:
    case TransactionType.ACCEPT:
    case TransactionType.EDIT:
    case TransactionType.CREATE_MARKETPLACE_ORDERS:
    case TransactionType.ACCEPT_MARKETPLACE_ORDER:
    case TransactionType.EDIT_MARKETPLACE_ORDER:
      return "🛒";
    case TransactionType.CANCEL_ORDER:
    case TransactionType.CANCEL:
    case TransactionType.CANCEL_MARKETPLACE_ORDER:
      return "❌";

    // Guilds
    case TransactionType.CREATE_GUILD:
    case TransactionType.JOIN_GUILD:
      return "⚔️";
    case TransactionType.LEAVE_GUILD:
      return "🚪";
    case TransactionType.REMOVE_MEMBER:
    case TransactionType.REMOVE_GUILD_MEMBER:
      return "👋";
    case TransactionType.UPDATE_WHITELIST:
    case TransactionType.WHITELIST_PLAYER:
    case TransactionType.REMOVE_PLAYER_FROM_WHITELIST:
    case TransactionType.TRANSFER_GUILD_OWNERSHIP:
      return "📜";

    // Structures & Ownership
    case TransactionType.TRANSFER_STRUCTURE_OWNERSHIP:
    case TransactionType.TRANSFER_AGENT_OWNERSHIP:
      return "🔄";
    case TransactionType.STRUCTURE_BURN:
    case TransactionType.TROOP_BURN:
      return "🔥";
    case TransactionType.SET_ENTITY_NAME:
    case TransactionType.SET_ADDRESS_NAME:
      return "✍️";

    // Hyperstructures
    case TransactionType.CONTRIBUTE:
    case TransactionType.CONTRIBUTE_TO_CONSTRUCTION:
      return "🏗️";
    case TransactionType.UPDATE_CONSTRUCTION_ACCESS:
      return "🔑";
    case TransactionType.MAKE_HYPERSTRUCTURES:
      return "🏛️";
    case TransactionType.CLAIM_CONSTRUCTION_POINTS:
    case TransactionType.CLAIM_SHARE_POINTS:
    case TransactionType.ALLOCATE_SHARES:
      return "📊";
    case TransactionType.CLAIM_WONDER_PRODUCTION_BONUS:
      return "✨";

    // Realms & Settlement
    case TransactionType.SETTLE_REALMS:
    case TransactionType.ASSIGN_REALM_POSITIONS:
      return "🏰";
    case TransactionType.OBTAIN_ENTRY_TOKEN:
    case TransactionType.REGISTER:
    case TransactionType.TOKEN_LOCK:
      return "🎫";

    // Lords & Approvals
    case TransactionType.ATTACH_LORDS:
    case TransactionType.DETACH_LORDS:
      return "👑";
    case TransactionType.APPROVE:
    case TransactionType.SET_APPROVAL_FOR_ALL:
    case TransactionType.REGISTER_TO_LEADERBOARD:
    case TransactionType.SET_CO_OWNERS:
      return "📜";
    case TransactionType.SET_ACCESS:
      return "🔑";

    // Quests
    case TransactionType.CLAIM_REWARD:
      return "🎁";
    case TransactionType.ADD_GAME:
    case TransactionType.GAME_COUNT:
    case TransactionType.GET_GAME_COUNT:
      return "🎮";
    case TransactionType.DISABLE_QUESTS:
    case TransactionType.ENABLE_QUESTS:
      return "📋";

    // Season & Leaderboard
    case TransactionType.SEASON_CLOSE:
    case TransactionType.END_GAME:
    case TransactionType.BLITZ_PRIZE_PLAYER_RANK:
      return "🏁";
    case TransactionType.SEASON_PRIZE_CLAIM:
    case TransactionType.CLAIM_LEADERBOARD_REWARDS:
    case TransactionType.BLITZ_PRIZE_CLAIM:
    case TransactionType.BLITZ_PRIZE_CLAIM_NO_GAME:
      return "🏆";

    // Chests & Relics
    case TransactionType.OPEN_CHEST:
      return "📦";
    case TransactionType.APPLY_RELIC:
      return "🔮";

    // VRF
    case TransactionType.REQUEST_RANDOM:
      return "🎲";

    // Config (Admin)
    case TransactionType.INITIALIZE:
    case TransactionType.GRANT_ROLE:
    case TransactionType.SET_STARTING_RESOURCES_CONFIG:
    case TransactionType.SET_MAP_CONFIG:
    case TransactionType.SET_VILLAGE_FOUND_RESOURCES_CONFIG:
    case TransactionType.SET_VICTORY_POINTS_GRANT_CONFIG:
    case TransactionType.SET_VICTORY_POINTS_WIN_CONFIG:
    case TransactionType.SET_GAME_MODE_CONFIG:
    case TransactionType.SET_BLITZ_PREVIOUS_GAME:
    case TransactionType.SET_TRAVEL_FOOD_COST_CONFIG:
    case TransactionType.SET_SEASON_CONFIG:
    case TransactionType.SET_VRF_CONFIG:
    case TransactionType.SET_RESOURCE_BRIDGE_FEE_SPLIT_CONFIG:
    case TransactionType.SET_AGENT_CONFIG:
    case TransactionType.SET_VILLAGE_TOKEN_CONFIG:
    case TransactionType.SET_CAPACITY_CONFIG:
    case TransactionType.SET_DONKEY_SPEED_CONFIG:
    case TransactionType.SET_RESOURCE_WEIGHT_CONFIG:
    case TransactionType.SET_TRADE_CONFIG:
    case TransactionType.SET_TICK_CONFIG:
    case TransactionType.SET_RESOURCE_FACTORY_CONFIG:
    case TransactionType.SET_BANK_CONFIG:
    case TransactionType.SET_RESOURCE_BRIDGE_WHITELIST_CONFIG:
    case TransactionType.SET_TROOP_CONFIG:
    case TransactionType.SET_BATTLE_CONFIG:
    case TransactionType.SET_STRUCTURE_LEVEL_CONFIG:
    case TransactionType.SET_WORLD_CONFIG:
    case TransactionType.SET_MERCENARIES_NAME_CONFIG:
    case TransactionType.SET_STRUCTURE_MAX_LEVEL_CONFIG:
    case TransactionType.SET_BUILDING_CONFIG:
    case TransactionType.SET_BUILDING_CATEGORY_CONFIG:
    case TransactionType.SET_HYPERSTRUCTURE_CONFIG:
    case TransactionType.SET_STAMINA_CONFIG:
    case TransactionType.SET_STAMINA_REFILL_CONFIG:
    case TransactionType.SET_SETTLEMENT_CONFIG:
    case TransactionType.SET_BLITZ_REGISTRATION_CONFIG:
    case TransactionType.SET_QUEST_CONFIG:
      return "⚙️";

    // Legacy
    case TransactionType.RESUME_PRODUCTION:
      return "▶️";
    case TransactionType.PAUSE_PRODUCTION:
      return "⏸️";
    case TransactionType.DESTROY:
      return "💥";

    default:
      return "📜";
  }
};

export const getStatusColor = (status: TransactionStatus, isStuck: boolean): string => {
  if (status === "pending" && isStuck) {
    return "text-orange";
  }

  switch (status) {
    case "pending":
      return "text-gold";
    case "success":
      return "text-brilliance";
    case "reverted":
      return "text-danger";
    default:
      return "text-gold";
  }
};

export const getStatusBorderColor = (status: TransactionStatus, isStuck: boolean): string => {
  if (status === "pending" && isStuck) {
    return "border-l-orange";
  }

  switch (status) {
    case "pending":
      return "border-l-gold";
    case "success":
      return "border-l-brilliance";
    case "reverted":
      return "border-l-danger";
    default:
      return "border-l-gold";
  }
};

export const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }

  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
};

export const truncateHash = (hash: string, chars: number = 6): string => {
  if (hash.length <= chars * 2 + 2) return hash;
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
};
