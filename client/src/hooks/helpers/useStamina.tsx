import { EternumGlobalConfig, ID, ResourcesIds, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
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

  const useStaminaByEntityId = ({ travelingEntityId }: { travelingEntityId: ID }) => {
    const staminasEntityIds = useEntityQuery([HasValue(Stamina, { entity_id: travelingEntityId })]);
    let staminaEntity = getComponentValue(Stamina, staminasEntityIds[0]);

    const armiesEntityIds = runQuery([Has(Army), HasValue(Army, { entity_id: travelingEntityId })]);
    const armyEntity = getComponentValue(Army, Array.from(armiesEntityIds)[0]);

    if (staminaEntity && armyEntity && BigInt(currentArmiesTick) !== staminaEntity.last_refill_tick) {
      staminaEntity = {
        ...staminaEntity,
        last_refill_tick: BigInt(currentArmiesTick),
        amount: getMaxStamina(armyEntity.troops, StaminaConfig),
      };
    }
    return staminaEntity;
  };

  const getStamina = ({
    travelingEntityId,
    currentArmiesTick,
  }: {
    travelingEntityId: ID;
    currentArmiesTick: number;
  }) => {
    const staminasEntityIds = runQuery([HasValue(Stamina, { entity_id: travelingEntityId })]);
    let staminaEntity = getComponentValue(Stamina, Array.from(staminasEntityIds)[0]);

    const armiesEntityIds = runQuery([Has(Army), HasValue(Army, { entity_id: travelingEntityId })]);
    const armyEntity = getComponentValue(Army, Array.from(armiesEntityIds)[0]);

    if (staminaEntity && BigInt(currentArmiesTick) !== staminaEntity?.last_refill_tick) {
      staminaEntity = {
        ...staminaEntity!,
        last_refill_tick: BigInt(currentArmiesTick),
        amount: getMaxStamina(armyEntity!.troops, StaminaConfig),
      };
    }
    return staminaEntity;
  };

  const getMaxStaminaByEntityId = (travelingEntityId: ID): number => {
    const armiesEntityIds = runQuery([Has(Army), HasValue(Army, { entity_id: travelingEntityId })]);
    const armyEntity = getComponentValue(Army, Array.from(armiesEntityIds)[0]);
    if (!armyEntity) return 0;
    const maxStamina = getMaxStamina(armyEntity.troops, StaminaConfig);

    return maxStamina;
  };

  const optimisticStaminaUpdate = (overrideId: string, entityId: ID, cost: number, currentArmiesTick: number) => {
    const entity = getEntityIdFromKeys([BigInt(entityId)]);

    const stamina = getStamina({ travelingEntityId: entityId, currentArmiesTick });

    Stamina.addOverride(overrideId, {
      entity,
      value: {
        entity_id: entityId,
        last_refill_tick: stamina?.last_refill_tick || 0n,
        amount: stamina?.amount ? stamina.amount - cost : 0,
      },
    });
  };

  const useArmiesCanMoveCount = (entityArmies: any) => {
    if (!entityArmies) return 0;

    return entityArmies.filter((entity: any) => {
      const stamina = getStamina({
        travelingEntityId: entity.entity_id,
        currentArmiesTick,
      });
      return (stamina?.amount || 0) >= EternumGlobalConfig.stamina.travelCost;
    }).length;
  };

  return {
    optimisticStaminaUpdate,
    useStaminaByEntityId,
    getStamina,
    getMaxStaminaByEntityId,
    useArmiesCanMoveCount,
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
