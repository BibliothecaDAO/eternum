import { ClientComponents } from "@/dojo/createClientComponents";
import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { EternumGlobalConfig, Position } from "@bibliothecadao/eternum";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import {
  Component,
  ComponentValue,
  Components,
  Entity,
  Has,
  HasValue,
  NotValue,
  getComponentValue,
  runQuery,
} from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { shortString } from "starknet";
import { useDojo } from "../../context/DojoContext";
import * as module from "./useBattles";
import { battleIsFinished, protectorStillInBattle } from "./useBattlesUtils";

export type FullArmyType = ClientComponents["Army"]["schema"] & ClientComponents["Health"]["schema"];

export type ExtraBattleInfo = ClientComponents["Position"]["schema"] & {
  opponentArmy: FullArmyType;
  ownArmyEntityName: string;
  opponentArmyEntityName: string;
};

export type BattleInfo = ComponentValue<ClientComponents["Battle"]["schema"]> &
  ComponentValue<ClientComponents["Position"]["schema"]> & { isStructureBattle: boolean };

export const getBattle = (
  battleId: Entity,
  Battle: Component<Components["Battle"]["schema"]>,
): ComponentValue<Components["Battle"]["schema"]> | undefined => {
  let battle = getComponentValue(Battle, battleId);
  let battleClone = structuredClone(battle);
  if (!battleClone) return;
  const multiplier =
    BigInt(EternumGlobalConfig.resources.resourcePrecision) * EternumGlobalConfig.troop.healthPrecision;
  battleClone.attack_army_health.current = battleClone.attack_army_health.current / multiplier;
  battleClone.attack_army_health.lifetime = battleClone.attack_army_health.lifetime / multiplier;
  battleClone.defence_army_health.current = battleClone.defence_army_health.current / multiplier;
  battleClone.defence_army_health.lifetime = battleClone.defence_army_health.lifetime / multiplier;
  return battleClone;
};

export const getExtraBattleInformation = (
  battles: Entity[],
  Battle: Component<Components["Battle"]["schema"]>,
  Position: Component<Components["Position"]["schema"]>,
  Structure: Component<Components["Structure"]["schema"]>,
): BattleInfo[] => {
  return battles
    .map((battleEntityId) => {
      const battle = module.getBattle(battleEntityId, Battle);
      if (!battle) return;
      const position = getComponentValue(Position, battleEntityId);
      if (!position) return;
      const structure = runQuery([Has(Structure), HasValue(Position, { x: position.x, y: position.y })]);
      return { ...battle, ...position, isStructureBattle: structure.size > 0 };
    })
    .filter((item): item is BattleInfo => Boolean(item));
};

export const useBattleManager = (battleId: bigint) => {
  const {
    setup: {
      components: { Battle },
    },
  } = useDojo();

  const battle = useComponentValue(Battle, getEntityIdFromKeys([BigInt(battleId)])) as ComponentValue<
    ClientComponents["Battle"]["schema"]
  >;

  const updatedBattle = useMemo(() => {
    return new BattleManager(battleId, Battle);
  }, [battleId, battle]);

  return { updatedBattle };
};

export const useBattleManagerByPosition = (position: Position) => {
  const {
    setup: {
      components: { Battle, Position, Army, Structure, Protectee },
    },
  } = useDojo();

  const battleEntityIds = useEntityQuery([Has(Battle), HasValue(Position, { x: position.x, y: position.y })]);
  const battle = getExtraBattleInformation(battleEntityIds, Battle, Position, Structure).filter((battle) =>
    module.filterBattles(battle, Army, Protectee),
  )[0];

  const battleManager = useMemo(() => {
    if (!battle) return;
    return new BattleManager(BigInt(battle.entity_id), Battle);
  }, [position, battle]);

  return battleManager;
};

export const useAllBattles = () => {
  const {
    setup: {
      components: { Battle, Army, Position, Structure, Protectee },
    },
  } = useDojo();

  const battlesEntityIds = useEntityQuery([Has(Battle)]);
  const allBattles = useMemo(() => {
    const extraBattleInfo = getExtraBattleInformation(battlesEntityIds, Battle, Position, Structure);
    return extraBattleInfo.filter((battle) => module.filterBattles(battle, Army, Protectee));
  }, [battlesEntityIds]);
  return allBattles;
};

export const usePlayerBattles = () => {
  const {
    account: { account },
    setup: {
      components: { Battle, Army, Owner, Position, Structure, Protectee },
    },
  } = useDojo();

  const armiesEntityIds = useEntityQuery([Has(Army), HasValue(Owner, { address: BigInt(account.address) })]);
  const playerBattles = (): any[] => {
    const battleEntityIds = armiesEntityIds
      .map((armyEntityId: Entity) => {
        const ownArmy = getComponentValue(Army, armyEntityId);
        if (!ownArmy) return null;
        const battle = module.getBattle(getEntityIdFromKeys([ownArmy.battle_id]), Battle);
        if (!battle) return null;
        return getEntityIdFromKeys([battle.entity_id]);
      })
      .filter((entityId): entityId is Entity => entityId !== null);
    return getExtraBattleInformation(battleEntityIds, Battle, Position, Structure).filter((battle) =>
      module.filterBattles(battle, Army, Protectee),
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
  const battle = module.getBattle(getEntityIdFromKeys([ownArmy.battle_id]), Battle);
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
      components: { Battle, Position, Army, Structure, Protectee },
    },
  } = useDojo();
  const battleEntityIds = useEntityQuery([Has(Battle), HasValue(Position, { x, y })]);
  return getExtraBattleInformation(battleEntityIds, Battle, Position, Structure).filter((battle) =>
    module.filterBattles(battle, Army, Protectee),
  )[0];
};

export const getBattleByPosition = () => {
  const {
    setup: {
      components: { Battle, Position, Army, Structure, Protectee },
    },
  } = useDojo();

  const getBattle = ({ x, y }: Position) => {
    const battleEntityIds = runQuery([Has(Battle), HasValue(Position, { x, y })]);
    return getExtraBattleInformation(Array.from(battleEntityIds), Battle, Position, Structure).filter((battle) =>
      module.filterBattles(battle, Army, Protectee),
    )[0];
  };
  return getBattle;
};

export const filterBattles = (battle: BattleInfo, Army: Component, Protectee: Component) => {
  return (
    !battleIsFinished(Army, battle) || (battle.isStructureBattle && protectorStillInBattle(Army, Protectee, battle))
  );
};
