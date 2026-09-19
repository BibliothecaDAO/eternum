import { readResourceManager } from "@bibliothecadao/eternum";
import type { ID } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "../context";
import { useNativeRevision } from "./use-native-facts";

export const useResourceManager = (entityId: ID) => {
  const {
    setup: { store },
  } = useGame();
  const revision = useNativeRevision([
    "ResourceBalance",
    "ResourceProduction",
    "ResourceWeight",
    "StructureBuildings",
    "ProductionBonus",
  ]);
  return useMemo(() => readResourceManager(store, entityId), [store, entityId, revision]);
};
