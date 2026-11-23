import { useGame } from "@/hooks/context/game-context";
import { configManager } from "@bibliothecadao/eternum";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import { useMemo } from "react";
import { getGameModeConfig } from "./index";
import { type ResolvedGameMode } from "./resolved-mode";

const useFamily = () => {
  const game = useNativeRow("GameRegistry", { game_id: configManager.getActiveGameId() });
  if (!game) throw new Error("Native game rules are not synchronized");
  return game.family;
};
export const useResolvedWorldGameMode = (): ResolvedGameMode => useGameModeConfig().id;

export const useGameModeConfig = () => {
  const family = useFamily();
  const { setup } = useGame();
  return useMemo(() => {
    const mode = getGameModeConfig(family);
    return {
      ...mode,
      structure: {
        ...mode.structure,
        getName: (structure: Parameters<typeof mode.structure.getName>[0]) =>
          mode.structure.getName(structure, setup.store),
      },
    };
  }, [family, setup.store]);
};
