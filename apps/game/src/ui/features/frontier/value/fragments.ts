import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { configManager, fragmentsSold } from "@bibliothecadao/eternum";

const FRAGMENT_MODELS = ["Fragments", "GameRelease"] as const;

export const useFragmentsSold = (): boolean => {
  const { setup } = useGame();
  useNativeRevision(FRAGMENT_MODELS);
  return fragmentsSold(setup.store, configManager.getActiveGameId());
};

export const useFragmentsHeld = (): number | null => {
  const { setup, account } = useGame();
  const sold = useFragmentsSold();
  const gameId = configManager.getActiveGameId();
  if (!sold) return null;
  const key = { game_id: gameId, account: BigInt(account.account.address) };
  const row = setup.store.get("Fragments", key);
  if (row) return Number(row.balance);
  return setup.store.absenceKnown("Fragments", key).known ? 0 : null;
};
