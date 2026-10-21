import { readBuildings } from "@bibliothecadao/eternum";

import { useMemo } from "react";
import { useNativeFacts } from "./use-native-facts";

export const useBuildings = (structureId: number | undefined) => {
  const facts = useNativeFacts(["Building", "ProductionRecipe"]);
  return useMemo(
    () => (structureId === undefined ? [] : readBuildings(facts.store, structureId)),
    [facts, structureId],
  );
};
