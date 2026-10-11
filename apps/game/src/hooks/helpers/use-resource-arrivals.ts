import { readResourceArrivals } from "@bibliothecadao/eternum";
import type { ID, ResourceArrivalInfo } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "./use-native-facts";

/** The structure's incoming deliveries; with no structure selected there are none to read, never entity 0's. */
export function useArrivalsByStructure(entityId: ID): ResourceArrivalInfo[];
export function useArrivalsByStructure(entityId: ID | undefined): ResourceArrivalInfo[] | undefined;
export function useArrivalsByStructure(entityId: ID | undefined): ResourceArrivalInfo[] | undefined {
  const {
    setup: { store },
  } = useGame();
  const revision = useNativeRevision(["ResourceArrival"]);
  return useMemo(
    () => (entityId === undefined ? undefined : readResourceArrivals(store, entityId)),
    [store, entityId, revision],
  );
}
