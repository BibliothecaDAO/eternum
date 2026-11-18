import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { configManager } from "@bibliothecadao/eternum";

const FRAGMENT_MODELS = ["Fragments"] as const;

export const useFragmentsHeld = (): number => {
  const { setup, account } = useGame();
  useNativeRevision(FRAGMENT_MODELS);
  const row = setup.store.get("Fragments", {
    game_id: configManager.getActiveGameId(),
    account: BigInt(account.account.address),
  });
  return Number(row?.balance ?? 0n);
};
