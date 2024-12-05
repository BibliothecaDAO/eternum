import { useDojo } from "@/hooks/context/DojoContext";
import { TransactionType } from "@bibliothecadao/eternum";
import { useEffect } from "react";
import { toast } from "sonner";

const getTxMessage = (type: TransactionType) => {
  switch (type) {
    case TransactionType.EXPLORE:
      return "🗺️ Sending scouts to explore new lands";
    case TransactionType.TRAVEL_HEX:
      return "🐎 Journeying to distant lands";
    case TransactionType.OPEN_ACCOUNT:
      return "📜 Opening ledger with the royal bank";
    case TransactionType.CHANGE_OWNER_AMM_FEE:
      return "💰 Adjusting merchant guild fees";
    case TransactionType.CHANGE_OWNER_BRIDGE_FEE:
      return "💰 Adjusting bridge toll fees";
    case TransactionType.BUY:
      return "💰 Purchasing wares from the market";
    case TransactionType.SELL:
      return "💰 Selling wares at the market";
    case TransactionType.ADD_LIQUIDITY:
      return "💰 Depositing gold to merchant's guild";
    case TransactionType.REMOVE_LIQUIDITY:
      return "💰 Withdrawing gold from merchant's guild";
    case TransactionType.ARMY_CREATE:
      return "⚔️ Raising a new army";
    case TransactionType.ARMY_DELETE:
      return "📜 Disbanding troops";
    case TransactionType.ARMY_BUY_TROOPS:
      return "⚔️ Recruiting soldiers";
    case TransactionType.ARMY_MERGE_TROOPS:
      return "⚔️ Combining battalions";
    case TransactionType.BATTLE_START:
      return "⚔️ Commencing siege";
    case TransactionType.BATTLE_FORCE_START:
      return "⚔️ Forcing battle to commence";
    case TransactionType.BATTLE_JOIN:
      return "⚔️ Joining the fray";
    case TransactionType.BATTLE_LEAVE:
      return "🏃 Retreating from battle";
    case TransactionType.BATTLE_CLAIM:
      return "🏆 Claiming spoils of war";
    case TransactionType.SEND_RESOURCES:
      return "🐎 Dispatching caravan with resources";
    case TransactionType.APPROVE_RESOURCES:
      return "📜 Authorizing resource transfer";
    case TransactionType.PICKUP_RESOURCES:
      return "📦 Collecting resources from caravan";
    case TransactionType.CREATE_ORDER:
      return "📜 Posting trade decree";
    case TransactionType.ACCEPT_ORDER:
      return "📜 Accepting trade decree";
    case TransactionType.ACCEPT_PARTIAL_ORDER:
      return "📜 Accepting portion of trade decree";
    case TransactionType.REMOVE_GUILD_MEMBER:
      return "📜 Expelling member from guild";
    case TransactionType.ATTACH_LORDS:
      return "👑 Pledging LORDS tokens";
    case TransactionType.APPROVE:
      return "📜 Approving royal decree";
    case TransactionType.CREATE_BANK:
      return "🏰 Establishing new royal bank";
    case TransactionType.CREATE_ADMIN_BANK:
      return "🏰 Establishing royal treasury";
    case TransactionType.SET_SETTLEMENT_CONFIG:
      return "📜 Adjusting settlement laws";
    case TransactionType.SET_SEASON_CONFIG:
      return "📜 Adjusting seasonal decrees";
    case TransactionType.SET_RESOURCE_BRIDGE_WHITELIST_CONFIG:
      return "📜 Adjusting bridge passage rights";
    case TransactionType.SET_CAPACITY_CONFIG:
      return "📜 Adjusting storage capacity laws";
    case TransactionType.SET_SPEED_CONFIG:
      return "📜 Adjusting travel speed laws";
    case TransactionType.SET_TICK_CONFIG:
      return "⏳ Adjusting hourglass measures";
    case TransactionType.SET_BANK_CONFIG:
      return "📜 Adjusting royal bank laws";
    case TransactionType.SET_TROOP_CONFIG:
      return "📜 Adjusting military doctrine";
    case TransactionType.SET_BATTLE_CONFIG:
      return "📜 Adjusting rules of engagement";
    case TransactionType.SET_QUEST_REWARD_CONFIG:
      return "📜 Adjusting quest bounties";
    case TransactionType.SET_REALM_LEVEL_CONFIG:
      return "📜 Adjusting realm advancement laws";
    default:
      return "📜 Royal decree executed";
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
