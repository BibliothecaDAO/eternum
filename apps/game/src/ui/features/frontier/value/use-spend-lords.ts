import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

const MODELS = ["DepositSource", "SpendLords", "DepositReceipt"] as const;
/** Absent purchased balance means no credit has ever been delivered; all current values come from native facts. */
export function useSpendLords(realm: NativeRows["Structure"]) {
  const { setup } = useGame();
  useNativeRevision(MODELS);
  const game_id = configManager.getActiveGameId();
  return {
    source: setup.store.get("DepositSource", { game_id }),
    balance: setup.store.get("SpendLords", { game_id, account: realm.owner }),
    receipts: [...setup.store.rows("DepositReceipt")].filter(
      (row) => row.game_id === game_id && row.account === realm.owner,
    ),
  };
}
