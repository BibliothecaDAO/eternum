import { ClientComponents } from "@/dojo/createClientComponents";
import { ResourcesIds, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { Component, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useDojo } from "../context/DojoContext";
import useBlockchainStore from "../store/useBlockchainStore";

export const useStamina = () => {
  const {
    setup: {
      components: { Stamina, Army, StaminaConfig },
    },
  } = useDojo();

  const currentArmiesTick = useBlockchainStore((state) => state.currentArmiesTick);

  const useStaminaByEntityId = ({ travelingEntityId }: { travelingEntityId: bigint }) => {
    const staminasEntityIds = useEntityQuery([HasValue(Stamina, { entity_id: travelingEntityId })]);
    let staminaEntity = getComponentValue(Stamina, staminasEntityIds.values().next().value);

    const armiesEntityIds = runQuery([Has(Army), HasValue(Army, { entity_id: travelingEntityId })]);
    const armyEntity = getComponentValue(Army, armiesEntityIds.values().next().value);

    if (staminaEntity && armyEntity && currentArmiesTick !== staminaEntity.last_refill_tick) {
      staminaEntity = {
        ...staminaEntity,
        last_refill_tick: currentArmiesTick,
        amount: getMaxStamina(armyEntity.troops, StaminaConfig),
      };
    }
    return staminaEntity as unknown as ClientComponents["Stamina"]["schema"];
  };

  const getStamina = ({
    travelingEntityId,
    armiesTick = currentArmiesTick,
  }: {
    travelingEntityId: bigint;
    armiesTick?: number;
  }) => {
    const staminasEntityIds = runQuery([HasValue(Stamina, { entity_id: travelingEntityId })]);
    let staminaEntity = getComponentValue(Stamina, staminasEntityIds.values().next().value);

    const armiesEntityIds = runQuery([Has(Army), HasValue(Army, { entity_id: travelingEntityId })]);
    const armyEntity = getComponentValue(Army, armiesEntityIds.values().next().value);

    if (staminaEntity && armiesTick !== staminaEntity?.last_refill_tick) {
      staminaEntity = {
        ...staminaEntity!,
        last_refill_tick: armiesTick,
        amount: getMaxStamina(armyEntity!.troops, StaminaConfig),
      };
    }
    return staminaEntity as unknown as ClientComponents["Stamina"]["schema"];
  };

  const getMaxStaminaByEntityId = (travelingEntityId: bigint): number => {
    const armiesEntityIds = runQuery([Has(Army), HasValue(Army, { entity_id: travelingEntityId })]);
    const armyEntity = getComponentValue(Army, armiesEntityIds.values().next().value);
    if (!armyEntity) return 0;
    const maxStamina = getMaxStamina(armyEntity.troops, StaminaConfig);

    return maxStamina;
  };

  return {
    useStaminaByEntityId,
    getStamina,
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

  if (maxStaminas.length === 0) return 0;

  const maxArmyStamina = Math.min(...maxStaminas);

  return maxArmyStamina;
};
