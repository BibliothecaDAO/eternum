import { readBuildings } from "@bibliothecadao/eternum";

import { useMemo } from "react";
import { useGame } from "../context";
import { useNativeRevision } from "./use-native-facts";

export const useBuildings = (col: number, row: number, alt = false) => {
  const {
    setup: { store },
  } = useGame();
  const revision = useNativeRevision(["Building", "ProductionRecipe"]);
  return useMemo(() => readBuildings(store, col, row, alt), [store, col, row, alt, revision]);
};
