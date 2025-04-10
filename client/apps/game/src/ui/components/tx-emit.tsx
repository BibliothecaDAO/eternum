import { TransactionType } from "@bibliothecadao/provider";
import { useDojo } from "@bibliothecadao/react";
import { useEffect } from "react";
import { toast } from "sonner";

const getTxMessage = (type: TransactionType) => {
  switch (type) {
    case TransactionType.EXPLORE:
      return "🗺️ Scouts sent to explore new lands";
    case TransactionType.TRAVEL_HEX:
      return "🐎 Journeyed to distant lands";
    case TransactionType.OPEN_ACCOUNT:
      return "📜 Opened ledger with the royal bank";
    case TransactionType.CHANGE_OWNER_AMM_FEE:
      return "💰 Adjusted bank fees";
    case TransactionType.CHANGE_OWNER_BRIDGE_FEE:
      return "💰 Adjusted bridge fees";
    case TransactionType.BUY:
      return "💰 Purchased from the market";
    case TransactionType.SELL:
      return "💰 Sold on the market";
    case TransactionType.ADD:
      return "💰 Added liquidity";
    case TransactionType.REMOVE:
      return "💰 Withdrew liquidity";
    case TransactionType.ARMY_CREATE:
      return "⚔️ Raised a new army";
    case TransactionType.ARMY_DELETE:
      return "📜 Disbanded troops";
    case TransactionType.ARMY_BUY_TROOPS:
      return "⚔️ Recruited soldiers";
    case TransactionType.ARMY_MERGE_TROOPS:
      return "⚔️ Combined battalions";
    case TransactionType.BATTLE_START:
      return "⚔️ Commenced battle";
    case TransactionType.BATTLE_FORCE_START:
      return "⚔️ Forced battle to commence";
    case TransactionType.BATTLE_JOIN:
      return "⚔️ Joined the fray";
    case TransactionType.BATTLE_LEAVE:
      return "🏃 Retreated from battle";
    case TransactionType.BATTLE_CLAIM:
      return "🏆 Claimed spoils of war";
    case TransactionType.SEND:
      return "🐎 Collected resources";
    case TransactionType.PICKUP:
      return "Collected resources";
    case TransactionType.CREATE_ORDER:
      return "📜 Posted trade decree";
    case TransactionType.ACCEPT_ORDER:
      return "📜 Accepted trade decree";
    case TransactionType.ACCEPT_PARTIAL_ORDER:
      return "📜 Accepted portion of trade decree";
    case TransactionType.REMOVE_GUILD_MEMBER:
      return "📜 Expelled member from tribe";
    case TransactionType.ATTACH_LORDS:
      return "👑 Pledged LORDS tokens";
    case TransactionType.APPROVE:
      return "📜 Authorized resource transfer";
    case TransactionType.CREATE_BANKS:
      return "🏰 Established royal treasury";
    case TransactionType.SET_CO_OWNERS:
      return "📜 Updated co-owners";
    case TransactionType.CLAIM_LEADERBOARD_REWARDS:
      return "🏆 Claimed leaderboard rewards";
    case TransactionType.REGISTER_TO_LEADERBOARD:
      return "📜 Registered for leaderboard";
    case TransactionType.END_GAME:
      return "🏁 Game has ended";
    case TransactionType.SET_ACCESS:
      return "🔑 Access rights updated";
    case TransactionType.CONTRIBUTE_TO_CONSTRUCTION:
      return "🏗️ Contributed to construction";
    case TransactionType.CREATE:
      return "✨ Created new building or structure";
    case TransactionType.REMOVE_PLAYER_FROM_WHITELIST:
      return "📜 Removed player from whitelist";
    case TransactionType.TRANSFER_GUILD_OWNERSHIP:
      return "👑 Transferred tribe ownership";
    case TransactionType.WHITELIST_PLAYER:
      return "📜 Added player to whitelist";
    case TransactionType.CREATE_GUILD:
      return "⚔️ Created new tribe";
    case TransactionType.JOIN_GUILD:
      return "⚔️ Joined tribe";
    case TransactionType.MINT_STARTING_RESOURCES:
      return "✨ Received starting resources";
    case TransactionType.RESUME_PRODUCTION:
      return "⚒️ Resumed production";
    case TransactionType.PAUSE_PRODUCTION:
      return "⏸️ Paused production";
    case TransactionType.DESTROY:
      return "💥 Destroyed building";
    case TransactionType.SET_ENTITY_NAME:
      return "✍️ Named entity";
    case TransactionType.SET_ADDRESS_NAME:
      return "✍️ Set address name";
    case TransactionType.UPGRADE_LEVEL:
      return "⬆️ Upgraded level";
    case TransactionType.CANCEL_ORDER:
      return "❌ Cancelled order";
    default:
      return "📜 Royal decree has been executed";
  }
};

export function TransactionNotification() {
  const {
    setup: {
      network: { provider },
    },
  } = useDojo();

  useEffect(() => {
    const handleTransactionComplete = (receipt: any) => {
      console.log("Transaction completed:", receipt);
      const description = getTxMessage(receipt.type);
      const txCount = receipt.transactionCount ? ` (${receipt.transactionCount} transactions)` : "";
      toast("Completed Action", { description: description + txCount });
    };

    const handleTransactionFailed = (error: string) => {
      console.error("Transaction failed:", error);
      toast("❌ Transaction failed", { description: error });
    };

    provider.on("transactionComplete", handleTransactionComplete);
    provider.on("transactionFailed", handleTransactionFailed);

    return () => {
      provider.off("transactionComplete", handleTransactionComplete);
      provider.off("transactionFailed", handleTransactionFailed);
    };
  }, [provider]);

  return null;
}
