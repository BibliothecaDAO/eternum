import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useBattleManager } from "@/hooks/helpers/battles/useBattles";
import { getArmiesByBattleId, getArmyByEntityId, useArmyByArmyEntityId } from "@/hooks/helpers/useArmies";
import { getStructureByEntityId, getStructureByPosition } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { BattleSide } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import { Battle } from "./Battle";

export const BattleView = () => {
  const dojo = useDojo();
  const getStructure = getStructureByPosition();
  const armiesByBattleId = getArmiesByBattleId();
  const { getAliveArmy } = getArmyByEntityId();

  const currentTimestamp = useUIStore((state) => state.nextBlockTimestamp);
  const battleView = useUIStore((state) => state.battleView);
  const selectedHex = useUIStore((state) => state.selectedHex);

  const battlePosition = { x: selectedHex.col, y: selectedHex.row };

  // get updated army for when a battle starts: we need to have the updated component to have the correct battle_id
  const updatedTarget = useArmyByArmyEntityId(battleView?.targetArmy || 0);

  const targetArmy = useMemo(() => {
    const tempBattleManager = new BattleManager(updatedTarget?.battle_id || 0, dojo);
    const updatedBattle = tempBattleManager.getUpdatedBattle(currentTimestamp!);
    return tempBattleManager.getUpdatedArmy(updatedTarget, updatedBattle);
  }, [updatedTarget, battleView?.targetArmy]);

  const battleManager = useBattleManager(
    battleView?.battleEntityId ? battleView?.battleEntityId : battleView?.engage ? 0 : targetArmy?.battle_id || 0,
  );

  const armies = useMemo(() => {
    if (!battleManager.isBattle()) {
      return { armiesInBattle: [], userArmiesInBattle: [] };
    }
    const armiesInBattle = armiesByBattleId(battleManager?.battleEntityId || 0);
    const userArmiesInBattle = armiesInBattle.filter((army) => army.isMine);
    return { armiesInBattle, userArmiesInBattle };
  }, [battleManager]);

  const ownArmySide = battleManager.isBattle()
    ? armies.userArmiesInBattle?.[0]?.battle_side || BattleSide[BattleSide.None]
    : BattleSide[BattleSide.Attack];

  const ownArmyBattleStarter = useMemo(
    () => getAliveArmy(battleView?.ownArmyEntityId || 0),
    [battleView?.ownArmyEntityId || 0],
  );

  const attackerArmies =
    armies.armiesInBattle.length > 0
      ? armies.armiesInBattle.filter((army) => army.battle_side === BattleSide[BattleSide.Attack])
      : [ownArmyBattleStarter!];

  const defenderArmies =
    armies.armiesInBattle.length > 0
      ? armies.armiesInBattle.filter((army) => army.battle_side === BattleSide[BattleSide.Defence])
      : [targetArmy];

  const battleAdjusted = useMemo(() => {
    if (!battleManager) return undefined;
    return battleManager!.getUpdatedBattle(currentTimestamp!);
  }, [currentTimestamp, battleManager, battleManager?.battleEntityId, armies.armiesInBattle, battleView]);

  const attackerHealth = battleAdjusted
    ? {
        current: battleAdjusted!.attack_army_health.current,
        lifetime: battleAdjusted!.attack_army_health.lifetime,
      }
    : {
        current: ownArmyBattleStarter?.health.current || 0n,
        lifetime: ownArmyBattleStarter?.health.lifetime || 0n,
      };
  const defenderHealth = battleAdjusted
    ? {
        current: battleAdjusted!.defence_army_health.current,
        lifetime: battleAdjusted!.defence_army_health.lifetime,
      }
    : targetArmy
    ? {
        current: targetArmy.health.current || 0n,
        lifetime: targetArmy.health.lifetime || 0n,
      }
    : undefined;

  const attackerTroops = battleAdjusted ? battleAdjusted!.attack_army.troops : ownArmyBattleStarter?.troops;
  const defenderTroops = battleAdjusted ? battleAdjusted!.defence_army.troops : targetArmy?.troops;

  const structureFromPosition = getStructure({ x: battlePosition.x, y: battlePosition.y });
  const structureId = getStructureByEntityId(
    defenderArmies.find((army) => army?.protectee)?.protectee?.protectee_id || 0,
  );

  const structure =
    battleView?.engage && !battleView?.battleEntityId && !battleView.targetArmy ? structureFromPosition : structureId;

  return (
    <Battle
      battleManager={battleManager}
      ownArmySide={ownArmySide}
      ownArmyEntityId={battleView?.ownArmyEntityId || 0}
      battleAdjusted={battleAdjusted}
      attackerArmies={attackerArmies}
      attackerHealth={attackerHealth}
      attackerTroops={attackerTroops!}
      defenderArmies={defenderArmies}
      defenderHealth={defenderHealth}
      defenderTroops={defenderTroops}
      userArmiesInBattle={armies.userArmiesInBattle}
      structure={structure}
    />
  );
};
