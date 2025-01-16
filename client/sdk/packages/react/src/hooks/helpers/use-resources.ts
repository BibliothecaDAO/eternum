import { getEntityIdFromKeys, ID, ResourceManager, ResourcesIds } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { useMemo } from "react";
import { useDojo } from "../context";

export const useResourceManager = (entityId: ID, resourceId: ResourcesIds) => {
  const dojo = useDojo();
  const production = useComponentValue(
    dojo.setup.components.Production,
    getEntityIdFromKeys([BigInt(entityId), BigInt(resourceId)]),
  );

  const resourceManager = useMemo(() => {
    return new ResourceManager(dojo.setup.components, entityId, resourceId);
  }, [dojo.setup, entityId, resourceId, production]);

  return resourceManager;
};
