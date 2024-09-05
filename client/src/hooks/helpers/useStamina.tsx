import { StaminaManager } from "@/dojo/modelManager/StaminaManager";
import { ID } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { useDojo } from "../context/DojoContext";

export const useStaminaManager = (entityId: ID) => {
  const { setup } = useDojo();

  const stamina = useComponentValue(setup.components.Stamina, getEntityIdFromKeys([BigInt(entityId)]));

  const manager = useMemo(() => {
    return new StaminaManager(setup, entityId);
  }, [entityId, stamina?.amount, stamina?.last_refill_tick]);

  return manager;
};
