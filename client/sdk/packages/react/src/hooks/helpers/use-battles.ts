import { BattleManager, ContractAddress, ID, Position } from "@bibliothecadao/eternum";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { useDojo } from "../context/dojo-context";
import { usePlayerRealms } from "./use-entities";

export const useBattleManager = (battleEntityId: ID) => {
  const dojo = useDojo();

  const battle = useComponentValue(dojo.setup.components.Battle, getEntityIdFromKeys([BigInt(battleEntityId)]));

  const battleManager = useMemo(() => {
    return new BattleManager(dojo.setup.components, dojo.network.provider, battleEntityId);
  }, [battleEntityId, battle]);

  return battleManager;
};

export const useBattlesAtPosition = ({ x, y }: Position) => {
  const {
    setup: {
      components: { Battle, Position },
    },
  } = useDojo();
  const battles = useEntityQuery([Has(Battle), NotValue(Battle, { duration_left: 0n }), HasValue(Position, { x, y })]);

  const battleEntityIds = useMemo(() => {
    return Array.from(battles)
      .map((battleId) => {
        const battle = getComponentValue(Battle, battleId);
        return battle ? battle.entity_id : undefined;
      })
      .filter((id): id is ID => Boolean(id)) as ID[];
  }, [battles]);

  return battleEntityIds;
};

export const usePlayerBattles = () => {
  const {
    account: { account },
    setup: {
      components: { Army, EntityOwner },
    },
  } = useDojo();

  const realms = usePlayerRealms(ContractAddress(account.address));

  const battleEntityIds = useMemo(() => {
    // Get all armies in battle owned by player's realms
    const armiesInBattle = realms.flatMap((realm) =>
      Array.from(
        runQuery([
          Has(Army),
          NotValue(Army, { battle_id: 0 }),
          HasValue(EntityOwner, { entity_owner_id: realm.entity_id }),
        ]),
      ),
    );

    // Map armies to their battle IDs
    const battleIds = armiesInBattle
      .map((armyId) => {
        const army = getComponentValue(Army, armyId);
        return army ? army.battle_id : undefined;
      })
      .filter((id) => Boolean(id)) as ID[];

    return battleIds;
  }, [realms]);

  return battleEntityIds;
};
