import { ID } from "@bibliothecadao/types";
import { StaminaManager } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { useDojo } from "../context";

export const useStaminaManager = (entityId: ID) => {
  const { setup } = useDojo();

  const explorer = useComponentValue(setup.components.ExplorerTroops, getEntityIdFromKeys([BigInt(entityId)]));

  const manager = useMemo(() => {
    return new StaminaManager(setup.components, entityId);
  }, [entityId, explorer]);

  return manager;
};
