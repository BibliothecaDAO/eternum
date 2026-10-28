import { useGame } from "@/hooks/context/game-context";
import { configManager } from "@bibliothecadao/eternum";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import { useMemo } from "react";
import { getGameModeConfig } from "./index";
import { type ResolvedGameMode } from "./resolved-mode";

const usePresetId = () => {
  const game = useNativeRow("GameRegistry", { game_id: configManager.getActiveGameId() });
  if (!game) throw new Error("Native game rules are not synchronized");
  return game.preset_id;
};
export const useResolvedWorldGameMode = (): ResolvedGameMode => useGameModeConfig().id;

export const useGameModeConfig = () => {
  const presetId = usePresetId();
  const { setup } = useGame();
  return useMemo(() => {
    const mode = getGameModeConfig(presetId);
    return {
      ...mode,
      structure: {
        ...mode.structure,
        getName: (structure: Parameters<typeof mode.structure.getName>[0]) =>
          mode.structure.getName(structure, setup.store),
      },
    };
  }, [presetId, setup.store]);
};
