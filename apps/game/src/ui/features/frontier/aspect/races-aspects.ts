import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { configManager } from "@bibliothecadao/eternum";

/**
 * Whether the active game races Aspects by height (it has race rules): true for Season 1, false for a game whose complete
 * snapshot holds none, which ranks players by the sites they cleared, and undefined while that is not yet known.
 */
export const useRacesAspects = (): boolean | undefined => {
  const {
    setup: { store },
  } = useGame();
  useNativeRevision(["RaceRules"]);
  const game_id = configManager.getActiveGameId();
  if (store.get("RaceRules", { game_id })) return true;
  return store.absenceKnown("RaceRules", { game_id }).known ? false : undefined;
};
