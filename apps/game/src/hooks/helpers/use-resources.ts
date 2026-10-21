import { readResourceManager, type ResourceManager } from "@bibliothecadao/eternum";
import type { ID } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useNativeFacts } from "./use-native-facts";

/** The entity's resources; with no entity selected there is nothing to read, never a lookup of entity 0. */
export function useResourceManager(entityId: ID): ResourceManager;
export function useResourceManager(entityId: ID | undefined): ResourceManager | undefined;
export function useResourceManager(entityId: ID | undefined): ResourceManager | undefined {
  const facts = useNativeFacts([
    "ResourceBalance",
    "ResourceProduction",
    "ResourceWeight",
    "StructureBuildings",
    "ProductionBonus",
  ]);
  return useMemo(
    () => (entityId === undefined ? undefined : readResourceManager(facts.store, entityId)),
    [facts, entityId],
  );
}
