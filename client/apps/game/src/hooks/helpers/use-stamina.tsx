import { useDojo } from "@/hooks/context/DojoContext";
import { ID, StaminaManager } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";

export const useStaminaManager = (entityId: ID) => {
  const { setup } = useDojo();

  const stamina = useComponentValue(setup.components.Stamina, getEntityIdFromKeys([BigInt(entityId)]));

  const manager = useMemo(() => {
    return new StaminaManager(setup.components, entityId);
  }, [entityId, stamina?.amount, stamina?.last_refill_tick]);

  return manager;
};
