import { ID } from "@bibliothecadao/types";
import { gameEntityKey, StaminaManager } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { useMemo } from "react";
import { useDojo } from "../context";

export const useStaminaManager = (entityId: ID) => {
  const { setup } = useDojo();

  const explorer = useComponentValue(setup.components.ExplorerTroops, gameEntityKey([BigInt(entityId)]));

  const manager = useMemo(() => {
    return new StaminaManager(setup.components, entityId);
  }, [entityId, explorer]);

  return manager;
};
