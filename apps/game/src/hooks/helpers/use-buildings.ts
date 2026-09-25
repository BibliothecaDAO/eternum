import { readBuildings } from "@bibliothecadao/eternum";

import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "./use-native-facts";

export const useBuildings = (structureId: number | undefined) => {
  const {
    setup: { store },
  } = useGame();
  const revision = useNativeRevision(["Building", "ProductionRecipe"]);
  return useMemo(
    () => (structureId === undefined ? [] : readBuildings(store, structureId)),
    [store, structureId, revision],
  );
};
