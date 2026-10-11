import { readStaminaManager, type StaminaManager } from "@bibliothecadao/eternum";
import type { ID } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "./use-native-facts";

/** The army's stamina; with no army selected there is none to read, never ExplorerTroops 0. */
export function useStaminaManager(entityId: ID): StaminaManager;
export function useStaminaManager(entityId: ID | undefined): StaminaManager | undefined;
export function useStaminaManager(entityId: ID | undefined): StaminaManager | undefined {
  const {
    setup: { store },
  } = useGame();
  const revision = useNativeRevision(["ExplorerTroops"]);
  return useMemo(
    () => (entityId === undefined ? undefined : readStaminaManager(store, entityId)),
    [store, entityId, revision],
  );
}
