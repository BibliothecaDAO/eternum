import { readStaminaManager } from "@bibliothecadao/eternum";
import type { ID } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "../context";
import { useNativeRevision } from "./use-native-facts";

export const useStaminaManager = (entityId: ID) => {
  const {
    setup: { store },
  } = useGame();
  const revision = useNativeRevision(["ExplorerTroops"]);
  return useMemo(() => readStaminaManager(store, entityId), [store, entityId, revision]);
};
