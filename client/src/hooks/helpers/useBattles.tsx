import { ClientComponents } from "@/dojo/createClientComponents";
import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { EternumGlobalConfig, Position } from "@bibliothecadao/eternum";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { Component, Entity, Has, HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
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

export type BattleInfo = ClientComponents["Battle"]["schema"] &
  ClientComponents["Position"]["schema"] & { isRealmBattle: boolean };

export const getExtraBattleInformation = (
  battles: Entity[],
  Battle: Component,
  Position: Component,
  Realm: Component,
): BattleInfo[] => {
  return battles
    .map((battleEntityId) => {
      const battle = getComponentValue(Battle, battleEntityId) as ClientComponents["Battle"]["schema"];
      if (!battle) return;
      const position = getComponentValue(Position, battleEntityId) as ClientComponents["Position"]["schema"];
      if (!position) return;
      const realm = runQuery([Has(Realm), HasValue(Position, { x: position.x, y: position.y })]);
      return { ...battle, ...position, isRealmBattle: realm.size > 0 };
    })
    .filter((item): item is BattleInfo => Boolean(item));
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

export const useBattleManagerByPosition = (position: Position) => {
  const {
    setup: {
      components: { Battle, Position, Army, Realm },
    },
  } = useDojo();

  const battleEntityIds = useEntityQuery([Has(Battle), HasValue(Position, position)]);

  const battle = getExtraBattleInformation(Array.from(battleEntityIds), Battle, Position, Realm).filter((battle) =>
    filterBattles(battle, Army),
  )[0];

  const battleManager = useMemo(() => {
    if (!battle) return;
    return new BattleManager(Battle, BigInt(battle.entity_id));
  }, [position, battle]);

  return battleManager;
};

export const useBattles = () => {
  const {
    setup: {
      components: { Battle, Army, Position, Realm },
    },
  } = useDojo();

  const battlesEntityIds = useEntityQuery([Has(Battle)]);

  return {
    allBattles: () =>
      getExtraBattleInformation(battlesEntityIds, Battle, Position, Realm).filter((battle) =>
        filterBattles(battle, Army),
      ),
  };
};

export const usePlayerBattles = () => {
  const {
    account: { account },
    setup: {
      components: { Battle, Army, Owner, Position, Realm },
    },
  } = useDojo();

  const armiesEntityIds = useEntityQuery([Has(Army), HasValue(Owner, { address: BigInt(account.address) })]);

  const playerBattles = (): any[] => {
    const battleEntityIds = armiesEntityIds
      .map((armyEntityId: Entity) => {
        const ownArmy = getComponentValue(Army, armyEntityId);
        if (!ownArmy) return null;
        const battle = getComponentValue(Battle, getEntityIdFromKeys([ownArmy.battle_id]));
        if (!battle) return null;
        return getEntityIdFromKeys([battle.entity_id]);
      })
      .filter((entityId): entityId is Entity => entityId !== null);
    return getExtraBattleInformation(battleEntityIds, Battle, Position, Realm).filter((battle) =>
      filterBattles(battle, Army),
    );
  };
  return { playerBattles };
};

export const getBattleInfoByOwnArmyEntityId = (ownArmyEntityId: bigint): ExtraBattleInfo | undefined => {
  const {
    setup: {
      components: { Army, Battle, Position, EntityName },
    },
  } = useDojo();

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

export const useBattlesByPosition = ({ x, y }: Position) => {
  const {
    setup: {
      components: { Battle, Position, Army, Realm },
    },
  } = useDojo();

  const battleEntityIds = useEntityQuery([Has(Battle), HasValue(Position, { x, y })]);
  return getExtraBattleInformation(battleEntityIds, Battle, Position, Realm).filter((battle) =>
    filterBattles(battle, Army),
  )[0];
};

export const getBattleByPosition = ({ x, y }: Position) => {
  const {
    setup: {
      components: { Battle, Position, Army, Realm },
    },
  } = useDojo();

  const battleEntityIds = runQuery([Has(Battle), HasValue(Position, { x, y })]);
  return getExtraBattleInformation(Array.from(battleEntityIds), Battle, Position, Realm).filter((battle) =>
    filterBattles(battle, Army),
  )[0];
};

const filterBattles = (battle: BattleInfo, Army: any) => {
  return !battleIsFinished(Army, battle) || (battle.isRealmBattle && !battleIsEmpty(Army, battle));
};

export const battleIsFinished = (Army: Component, battle: BattleInfo) => {
  const attackersEntityIds = runQuery([HasValue(Army, { battle_id: battle.entity_id, battle_side: "Attack" })]);
  const defendersEntityIds = runQuery([HasValue(Army, { battle_id: battle.entity_id, battle_side: "Defence" })]);

  return (
    (Array.from(attackersEntityIds).length === 0 &&
      BigInt(battle.defence_army_health.current) / EternumGlobalConfig.troop.healthPrecision <= 0) ||
    (Array.from(defendersEntityIds).length === 0 &&
      BigInt(battle.attack_army_health.current) / EternumGlobalConfig.troop.healthPrecision <= 0)
  );
};

export const battleIsEmpty = (Army: Component, battle: BattleInfo) => {
  const attackersEntityIds = runQuery([HasValue(Army, { battle_id: battle.entity_id, battle_side: "Attack" })]);
  const defendersEntityIds = runQuery([HasValue(Army, { battle_id: battle.entity_id, battle_side: "Defence" })]);

  return Array.from(attackersEntityIds).length === 0 && Array.from(defendersEntityIds).length === 0;
};

export const armyIsLosingSide = (
  army: ClientComponents["Army"]["schema"],
  battle: ClientComponents["Battle"]["schema"],
) => {
  return (
    (String(army.battle_side) === "Attack" && BigInt(battle.attack_army_health.current) === 0n) ||
    (String(army.battle_side) === "Defence" && BigInt(battle.defence_army_health.current) === 0n)
  );
};
