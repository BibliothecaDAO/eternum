import { configManager } from "@bibliothecadao/eternum";
import { useNativeRow } from "@bibliothecadao/react";
import { useMemo } from "react";
import { getGameModeConfig } from "./index";
import { resolveGameModeFromBlitzFlag, type ResolvedGameMode } from "./resolved-mode";

const useBlitzMode = () => {
  const rules = useNativeRow("SliceRules", { game_id: configManager.getActiveGameId() });
  if (!rules) throw new Error("Native game rules are not synchronized");
  return rules.mode_id === 1;
};
export const useResolvedWorldGameMode = (): ResolvedGameMode => resolveGameModeFromBlitzFlag(useBlitzMode());
export const useGameModeConfig = () => {
  const blitzModeOn = useBlitzMode();
  return useMemo(() => getGameModeConfig({ blitzModeOn }), [blitzModeOn]);
};
