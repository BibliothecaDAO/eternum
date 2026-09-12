import { gameEntityKey, readStaminaManager } from "@bibliothecadao/eternum";
import { ID } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { useMemo } from "react";
import { useDojo } from "../context";

export const useStaminaManager = (entityId: ID) => {
  const {
    setup: { components },
  } = useDojo();

  const explorer = useComponentValue(components.ExplorerTroops, gameEntityKey([BigInt(entityId)]));

  return useMemo(() => readStaminaManager(components, entityId), [entityId, explorer]);
};
