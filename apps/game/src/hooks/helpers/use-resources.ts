import { readResourceManager, type ResourceManager } from "@bibliothecadao/eternum";
import type { ID } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "./use-native-facts";

/** The entity's resources; with no entity selected there is nothing to read, never a lookup of entity 0. */
export function useResourceManager(entityId: ID): ResourceManager;
export function useResourceManager(entityId: ID | undefined): ResourceManager | undefined;
export function useResourceManager(entityId: ID | undefined): ResourceManager | undefined {
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
  return useMemo(
    () => (entityId === undefined ? undefined : readResourceManager(store, entityId)),
    [store, entityId, revision],
  );
}
