import { StaminaManager } from "@/dojo/modelManager/StaminaManager";
import { ID, ResourcesIds, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { Component, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
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

export const useStamina = () => {
  const {
    setup: {
      components: { Army, StaminaConfig },
    },
  } = useDojo();

  const getMaxStaminaByEntityId = (travelingEntityId: ID): number => {
    const armiesEntityIds = runQuery([Has(Army), HasValue(Army, { entity_id: travelingEntityId })]);
    const armyEntity = getComponentValue(Army, Array.from(armiesEntityIds)[0]);
    if (!armyEntity) return 0;
    const maxStamina = getMaxStamina(armyEntity.troops, StaminaConfig);

    return maxStamina;
  };

  return {
    getMaxStaminaByEntityId,
  };
};

const getMaxStamina = (troops: any, StaminaConfig: Component): number => {
  let maxStaminas: number[] = [];
  if (troops.knight_count > 0) {
    const knightConfig = getComponentValue(
      StaminaConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Knight)]),
    );
    if (!knightConfig) return 0;
    maxStaminas.push(knightConfig!.max_stamina);
  }
  if (troops.crossbowman_count > 0) {
    const crossbowmanConfig = getComponentValue(
      StaminaConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Crossbowman)]),
    );
    if (!crossbowmanConfig) return 0;
    maxStaminas.push(crossbowmanConfig!.max_stamina);
  }
  if (troops.paladin_count > 0) {
    const paladinConfig = getComponentValue(
      StaminaConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Paladin)]),
    );
    if (!paladinConfig) return 0;
    maxStaminas.push(paladinConfig!.max_stamina);
  }

  if (maxStaminas.length === 0) return 0;

  const maxArmyStamina = Math.min(...maxStaminas);

  return maxArmyStamina;
};
