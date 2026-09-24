import { readResourceArrivals } from "@bibliothecadao/eternum";
import type { ID } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "./use-native-facts";

export const useArrivalsByStructure = (entityId: ID) => {
  const {
    setup: { store },
  } = useGame();
  const revision = useNativeRevision(["ResourceArrival"]);
  return useMemo(() => readResourceArrivals(store, entityId), [store, entityId, revision]);
};
