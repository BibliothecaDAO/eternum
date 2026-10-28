import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { configManager } from "@bibliothecadao/eternum";

const SEASON_MODELS = ["GameRegistry"] as const;

/** When the active game's season ends (its registry's end_at), in unix seconds; undefined until the game is known. */
export const useSeasonEndsAt = (): number | undefined => {
  const { setup } = useGame();
  useNativeRevision(SEASON_MODELS);
  const game = setup.store.get("GameRegistry", { game_id: configManager.getActiveGameId() });
  return game ? Number(game.end_at) : undefined;
};
