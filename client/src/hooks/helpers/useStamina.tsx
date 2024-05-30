import { useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Component, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { ResourcesIds, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { ClientComponents } from "@/dojo/createClientComponents";
import useBlockchainStore from "../store/useBlockchainStore";
import { getEntityIdFromKeys } from "@dojoengine/utils";

export const useStamina = ({
  travelingEntityId,
}: {
  travelingEntityId: bigint;
}): ClientComponents["Stamina"]["schema"] | undefined => {
  const {
    setup: {
      components: { Stamina, Army, StaminaConfig },
    },
  } = useDojo();

  const staminasEntityIds = useEntityQuery([HasValue(Stamina, { entity_id: travelingEntityId })]);
  let staminaEntity = getComponentValue(Stamina, staminasEntityIds.values().next().value);
  if (!staminaEntity) return;

  const armiesEntityIds = runQuery([Has(Army), HasValue(Army, { entity_id: travelingEntityId })]);
  const armyEntity = getComponentValue(Army, armiesEntityIds.values().next().value);
  if (!armyEntity) return;

  const currentArmiesTick = useBlockchainStore((state) => state.currentArmiesTick);

  if (currentArmiesTick !== staminaEntity.last_refill_tick) {
    staminaEntity = {
      ...staminaEntity,
      last_refill_tick: currentArmiesTick,
      amount: getRefilledStamina(armyEntity.troops, StaminaConfig),
    };
  }
  return staminaEntity as unknown as ClientComponents["Stamina"]["schema"];
};

const getRefilledStamina = (troops: any, StaminaConfig: Component): number => {
  let maxStaminas: number[] = [];
  if (troops.knight_count > 0) {
    const knightConfig = getComponentValue(
      StaminaConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Knight)]),
    );
    maxStaminas.push(knightConfig!.max_stamina);
  }
  if (troops.crossbowman_count > 0) {
    const crossbowmenConfig = getComponentValue(
      StaminaConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Crossbowmen)]),
    );
    maxStaminas.push(crossbowmenConfig!.max_stamina);
  }
  if (troops.paladin_count > 0) {
    const paladinConfig = getComponentValue(
      StaminaConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Paladin)]),
    );
    maxStaminas.push(paladinConfig!.max_stamina);
  }

  const maxArmyStamina = Math.min(...maxStaminas);

  return maxArmyStamina;
};
