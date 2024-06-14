import { ClientComponents } from "@/dojo/createClientComponents";
import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { Position } from "@bibliothecadao/eternum";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { Has, HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { shortString } from "starknet";
import { useDojo } from "../context/DojoContext";

export type FullArmyType = ClientComponents["Army"]["schema"] & ClientComponents["Health"]["schema"];

export type ExtraBattleInfo = ClientComponents["Position"]["schema"] & {
  opponentArmy: FullArmyType;
  ownArmyEntityName: string;
  opponentArmyEntityName: string;
};

export const useBattleManager = (battleId: bigint) => {
  const {
    setup: {
      components: { Battle },
    },
  } = useDojo();

  const battle = useComponentValue(
    Battle,
    getEntityIdFromKeys([BigInt(battleId)]),
  ) as unknown as ClientComponents["Battle"]["schema"];

  const updatedBattle = useMemo(() => {
    return new BattleManager(Battle, battleId);
  }, [battleId, battle]);

  return { updatedBattle };
};

export const useBattles = () => {
  const {
    setup: {
      components: { Battle, Army, Owner, EntityName, Position },
    },
  } = useDojo();

  const allBattles = () => {
    const entityIds = useEntityQuery([Has(Battle)]);
    return Array.from(entityIds).map((entityId) => {
      const army = getComponentValue(Battle, entityId);
      const position = getComponentValue(Position, entityId);
      if (!army) return;
      return { ...army, ...position };
    });
  };

  const getExtraBattleInformation = (ownArmyEntityId: bigint): ExtraBattleInfo | undefined => {
    const ownArmy = getComponentValue(Army, getEntityIdFromKeys([ownArmyEntityId]));
    if (!ownArmy) return;
    const battle = getComponentValue(Battle, getEntityIdFromKeys([ownArmy.battle_id]));
    if (!battle) return;
    const position = getComponentValue(Position, getEntityIdFromKeys([ownArmy.entity_id]));
    if (!position) return;
    const ownArmyEntityName = getComponentValue(EntityName, getEntityIdFromKeys([ownArmyEntityId]));
    const opponentArmyEntityId = runQuery([
      HasValue(Army, { battle_id: battle.entity_id }),
      NotValue(Army, { entity_id: ownArmy.entity_id }),
    ])
      .values()
      .next().value;

    const opponentArmy = getComponentValue(Army, opponentArmyEntityId);
    if (!opponentArmy) return;
    const opponentArmyEntityName = getComponentValue(EntityName, opponentArmyEntityId);
    return {
      ...position,
      opponentArmy,
      ownArmyEntityName: ownArmyEntityName
        ? shortString.decodeShortString(String(ownArmyEntityName?.name))
        : `Army ${ownArmy!.entity_id}`,
      opponentArmyEntityName: opponentArmyEntityName
        ? shortString.decodeShortString(String(opponentArmyEntityName?.name))
        : `Army ${opponentArmy!.entity_id}`,
    } as unknown as ExtraBattleInfo;
  };

  const playerBattles = (playerAddress: bigint): any[] => {
    const armiesEntityIds = useEntityQuery([Has(Army), HasValue(Owner, { address: playerAddress })]);
    return armiesEntityIds
      .map((armyEntityId) => {
        const ownArmy = getComponentValue(Army, armyEntityId);
        if (!ownArmy) return;
        const battle = getComponentValue(Battle, getEntityIdFromKeys([ownArmy.battle_id]));
        if (!battle) return;
        return {
          battleEntityId: battle.entity_id,
          ownArmy,
        };
      })
      .filter(Boolean);
  };

  return { allBattles, playerBattles, getExtraBattleInformation };
};

export const useBattlesByPosition = ({ x, y }: Position) => {
  const {
    setup: {
      components: { Battle, Army, Owner, EntityName, Position, Protectee, Health },
    },
  } = useDojo();

  const battleEntityIds = useEntityQuery([Has(Battle), HasValue(Position, { x, y })]);
  const battle = getComponentValue(Battle, battleEntityIds[0]);
  if (!battle) return;
  return battle.entity_id;
};
