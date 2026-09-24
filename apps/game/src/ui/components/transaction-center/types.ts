import { TransactionType } from "@bibliothecadao/provider";
import { env } from "../../../../env";

export const getExplorerTxUrl = (hash: string): string | null =>
  env.VITE_PUBLIC_EXPLORER_URL ? `${env.VITE_PUBLIC_EXPLORER_URL.replace(/\/$/, "")}/tx/${hash}` : null;

export const getExplorerName = (): string => "Explorer";

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
      return "Explorer moved";
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

    // Combat
    case TransactionType.ATTACK_EXPLORER_VS_EXPLORER:
      return "Explorer attacked explorer";
    case TransactionType.ATTACK_EXPLORER_VS_GUARD:
      return "Explorer attacked guard";
    case TransactionType.ATTACK_GUARD_VS_EXPLORER:
      return "Guard attacked explorer";
    case TransactionType.RAID_EXPLORER_VS_GUARD:
      return "Explorer raided structure";
      return "Commenced battle";
      return "Battle resolved";
      return "Forced battle to commence";
      return "Joined the fray";
      return "Retreated from battle";
      return "Claimed spoils of war";

      // Legacy Army
      return "Raised a new army";
      return "Disbanded troops";
      return "Recruited soldiers";
      return "Combined battalions";

    // Buildings
    case TransactionType.CREATE_BUILDING:
      return "Constructed new building";
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
      return "Collected resources";
    case TransactionType.ARRIVALS_OFFLOAD:
      return "Offloaded arrivals";
    case TransactionType.BURN_RESOURCE_FOR_RESOURCE_PRODUCTION:
      return "Converted resources";
    case TransactionType.BURN_LABOR_FOR_RESOURCE_PRODUCTION:
      return "Used labor for production";
      return "Minted tokens";
      return "Minted test LORDS";

      // Banking & Trading
      return "Opened ledger with the royal bank";
      return "Established royal treasury";
      return "Adjusted bank fees";
      return "Adjusted bridge fees";
    case TransactionType.BUY:
      return "Purchased from the market";
    case TransactionType.SELL:
      return "Sold on the market";
      return "Added liquidity";
    case TransactionType.REMOVE:
      return "Withdrew liquidity";
      return "Deposited tokens";
      return "Withdrew tokens";

    // Orders & Marketplace
    case TransactionType.CREATE_ORDER:
      return "Posted trade decree";
      return "Accepted trade decree";
      return "Accepted portion of trade decree";
      return "Cancelled order";
    case TransactionType.CREATE:
      return "Created marketplace order";
      return "Accepted marketplace order";
      return "Cancelled marketplace order";
      return "Edited marketplace order";

    // Guilds
    case TransactionType.CREATE_GUILD:
      return "Created new tribe";
    case TransactionType.JOIN_GUILD:
      return "Joined tribe";
    case TransactionType.LEAVE_GUILD:
      return "Left tribe";
      return "Removed member from tribe";
    case TransactionType.UPDATE_WHITELIST:
      return "Updated tribe whitelist";
    case TransactionType.REMOVE_GUILD_MEMBER:
      return "Expelled member from tribe";
      return "Removed player from whitelist";
      return "Transferred tribe ownership";
      return "Added player to whitelist";

      // Structures & Ownership
      return "Transferred structure ownership";
      return "Burned structure";
    case TransactionType.SET_ENTITY_NAME:
      return "Named entity";
      return "Set address name";

    // Hyperstructures
    case TransactionType.CONTRIBUTE:
      return "Contributed to hyperstructure";
      return "Updated construction access";
      return "Claimed construction points";
    case TransactionType.ALLOCATE_SHARES:
      return "Allocated shares";
      return "Claimed wonder production bonus";

    // Realms & Settlement
    case TransactionType.SETTLE:
      return "Settled realm";
      return "Registered in the realm";
      return "Locked tokens";

      // Lords & Approvals
      return "Pledged LORDS tokens";
      return "Withdrew LORDS tokens";
      return "Authorized resource transfer";
      return "Set approval for all tokens";
      return "Updated shareholders";
    case TransactionType.SET_ACCESS:
      return "Access rights updated";

      // Season & Leaderboard
      return "Season closed";
      return "Claimed season prize";
      return "Claimed leaderboard rewards";
    case TransactionType.END_GAME:
      return "Game has ended";

      // Blitz
      return "Submitted blitz rankings";

    // Chests & Relics
    case TransactionType.OPEN_CHEST:
      return "Opened treasure chest";
    case TransactionType.BURN_RESEARCH_FOR_RELIC:
      return "Crafted relic from research";
      return "Applied relic";

    // Config (Admin)
    case TransactionType.INITIALIZE:
      return "Initialized configuration";
      return "Granted role";
      return "Updated game configuration";

      // Legacy
      return "Resumed production";
      return "Paused production";
      return "Destroyed building";
      return "Upgraded level";
      return "Created marketplace orders";
      return "Accepted marketplace order";
      return "Cancelled marketplace order";
      return "Edited marketplace order";
      return "Contributed to construction";

    default:
      return "Royal decree executed";
  }
};
