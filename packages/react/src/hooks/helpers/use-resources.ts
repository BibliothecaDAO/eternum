import { readResourceManager, resourcesOfEntityQuery } from "@bibliothecadao/eternum";
import { ID } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { useMemo } from "react";
import { useDojo } from "../context";

export const useResourceManager = (entityId: ID) => {
  const {
    setup: { components },
  } = useDojo();

  const resource = useEntityQuery(resourcesOfEntityQuery(components, entityId));

  return useMemo(() => readResourceManager(components, entityId), [entityId, resource]);
};
