import { ClientComponents } from "@/dojo/createClientComponents";
import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { EternumGlobalConfig, ID, Position } from "@bibliothecadao/eternum";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import {
  Component,
  ComponentValue,
  Components,
  Entity,
  Has,
  HasValue,
  getComponentValue,
  runQuery,
} from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";
import { useDojo } from "../../context/DojoContext";
import * as module from "./useBattles";

export type BattleInfo = ComponentValue<ClientComponents["Battle"]["schema"]> & {
  isStructureBattle: boolean;
  position: ComponentValue<ClientComponents["Position"]["schema"]>;
};

export const getBattle = (
  battleEntityId: Entity,
  Battle: Component<Components["Battle"]["schema"]>,
): ComponentValue<Components["Battle"]["schema"]> | undefined => {
  let battle = getComponentValue(Battle, battleEntityId);
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
      return { ...battle, position, isStructureBattle: structure.size > 0 };
    })
    .filter((item): item is BattleInfo => Boolean(item));
};

export const useBattleManager = (battleEntityId: ID) => {
  const dojo = useDojo();

  const battle = useComponentValue(dojo.setup.components.Battle, getEntityIdFromKeys([BigInt(battleEntityId)]));

  const battleManager = useMemo(() => {
    return new BattleManager(battleEntityId, dojo);
  }, [battleEntityId, battle]);

  return battleManager;
};

export const useBattlesByPosition = ({ x, y }: Position) => {
  const {
    setup: {
      components: { Battle, Position, Structure },
    },
  } = useDojo();
  const battleEntityIds = useEntityQuery([Has(Battle), HasValue(Position, { x, y })]);
  return getExtraBattleInformation(battleEntityIds, Battle, Position, Structure);
};
