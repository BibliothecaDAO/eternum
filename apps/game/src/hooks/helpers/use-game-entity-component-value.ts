import { gameEntityKey } from "@/sync/game-scope";
import type { ID } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import type { Component, Schema } from "@dojoengine/recs";
import { useMemo } from "react";

/** Subscribe to one game-scoped RECS row by its model entity id. */
export function useGameEntityComponentValue<S extends Schema>(
  component: Component<S>,
  entityId: ID | null | undefined,
) {
  const entity = useMemo(
    () => (entityId === null || entityId === undefined ? undefined : gameEntityKey([BigInt(entityId)])),
    [entityId],
  );

  return useComponentValue(component, entity);
}
