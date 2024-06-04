import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { useDojo } from "../context/DojoContext";
import { Has, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import useBlockchainStore from "../store/useBlockchainStore";
import { getArmyByEntityId } from "./useArmies";
import { ClientComponents } from "@/dojo/createClientComponents";

export const useBattles = () => {
  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);

  const {
    setup: {
      components: { Battle },
    },
  } = useDojo();

  const useBattles = () => {
    const entityIds = useEntityQuery([Has(Battle)]);
    return Array.from(entityIds).map((entityId) => {
      const army = getComponentValue(Battle, entityId);
      if (!army) return;
      return army;
    });
  };

  const useBattleByEntityId = (attackerEntityId: bigint, defenderEntityId: bigint) => {
    const attackerArmy = getArmyByEntityId({ entity_id: attackerEntityId });
    const defenderArmy = getArmyByEntityId({ entity_id: defenderEntityId });

	if (
      !attackerArmy ||
      !defenderArmy ||
      BigInt(defenderArmy.battle_id) === 0n ||
      attackerArmy.battle_id !== defenderArmy.battle_id
    ) {
      return { battle: null, attackerArmy, defenderArmy };
    }

    const battle = useComponentValue(
      Battle,
      getEntityIdFromKeys([BigInt(defenderArmy.battle_id)]),
    ) as unknown as ClientComponents["Battle"]["schema"];

    if (!battle) return;

    if (battle.tick_last_updated !== currentDefaultTick) {
      updateBattle(battle, BigInt(currentDefaultTick));
    }
    return { battle, attackerArmy, defenderArmy };
  };

  return { useBattles, useBattleByEntityId };
};

const updateBattle = (battle: any, currentDefaultTick: bigint) => {
  const durationPassed = getDurationPassed(battle, currentDefaultTick);
  decreaseHealthBy(battle.attack_army_health, BigInt(battle.attack_delta) * durationPassed);
  decreaseHealthBy(battle.defence_army_health, BigInt(battle.attack_delta) * durationPassed);
};

const decreaseHealthBy = (health: { current: bigint; lifetime: bigint }, value: bigint) => {
  if (health.current > value) {
    health.current -= value;
  } else {
    health.current = 0n;
  }
};

const getDurationPassed = (battle: any, currentDefaultTick: bigint) => {
  const duractionSinceLastUpdate = currentDefaultTick - battle.tick_last_updated;
  if (battle.tick_duration_left >= duractionSinceLastUpdate) {
    battle.tick_duration_left -= duractionSinceLastUpdate;
    battle.tick_last_updated = currentDefaultTick;
    return duractionSinceLastUpdate;
  } else {
    // battle is over
    const duration = battle.tick_duration_left;
    battle.tick_duration_left = 0n;
    battle.tick_last_updated = currentDefaultTick;

    return duration;
  }
};
