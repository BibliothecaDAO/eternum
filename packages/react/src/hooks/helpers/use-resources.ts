import { readResourceManager } from "@bibliothecadao/eternum";
import { ID } from "@bibliothecadao/types";
import { useEffect, useMemo, useReducer } from "react";
import { useDojo } from "../context";

export const useResourceManager = (entityId: ID) => {
  const {
    setup: { components },
  } = useDojo();

  const [revision, changed] = useReducer((value: number) => value + 1, 0);
  useEffect(() => readResourceManager(components, entityId).subscribe(changed), [components, entityId]);
  return useMemo(() => readResourceManager(components, entityId), [components, entityId, revision]);
};
