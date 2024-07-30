import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useBattleManager } from "@/hooks/helpers/battles/useBattles";
import { getArmiesByBattleId, getArmyByEntityId, useArmyByArmyEntityId } from "@/hooks/helpers/useArmies";
import { getStructureByEntityId, getStructureByPosition } from "@/hooks/helpers/useStructures";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { BattleSide } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import { Battle } from "./Battle";

export const BattleView = () => {
  const dojo = useDojo();
  const getStructure = getStructureByPosition();
  const armiesByBattleId = getArmiesByBattleId();
  const { getAliveArmy } = getArmyByEntityId();

  const currentTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const battleView = useUIStore((state) => state.battleView);
  const selectedHex = useUIStore((state) => state.selectedHex);

  const battlePosition = { x: selectedHex.col, y: selectedHex.row };

  // get updated army for when a battle starts: we need to have the updated component to have the correct battle_id
  const updatedTarget = useArmyByArmyEntityId(battleView?.targetArmy || 0n);

  const targetArmy = useMemo(() => {
    const tempBattleManager = new BattleManager(updatedTarget?.battle_id || 0n, dojo);
    const updatedBattle = tempBattleManager.getUpdatedBattle(currentTimestamp!);
    return tempBattleManager.getUpdatedArmy(updatedTarget, updatedBattle);
  }, [updatedTarget, battleView?.targetArmy]);

  const battleManager = useBattleManager(
    battleView?.battle ? battleView?.battle : battleView?.engage ? 0n : targetArmy?.battle_id || 0n,
  );

  const armies = useMemo(() => {
    if (!battleManager.isBattle()) {
      return { armiesInBattle: [], userArmiesInBattle: [] };
    }
    const armiesInBattle = armiesByBattleId(battleManager?.battleId || 0n);
    const userArmiesInBattle = armiesInBattle.filter((army) => army.isMine);
    return { armiesInBattle, userArmiesInBattle };
  }, [battleManager]);

  const ownArmySide = battleManager.isBattle()
    ? armies.userArmiesInBattle?.[0]?.battle_side || ""
    : BattleSide[BattleSide.Attack];

  const ownArmyBattleStarter = useMemo(
    () => getAliveArmy(battleView!.ownArmyEntityId || 0n),
    [battleView!.ownArmyEntityId],
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
  }, [currentTimestamp, battleManager, battleManager?.battleId, armies.armiesInBattle, battleView]);

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

  const structure =
    battleView?.engage && !battleView?.battle && !battleView.targetArmy
      ? getStructure({ x: battlePosition.x, y: battlePosition.y })
      : getStructureByEntityId(defenderArmies.find((army) => army?.protectee)?.protectee?.protectee_id || 0n);

  const isActive = battleManager?.isBattleOngoing(currentTimestamp!);

  return (
    <Battle
      battleManager={battleManager}
      ownArmySide={ownArmySide}
      ownArmyEntityId={battleView?.ownArmyEntityId}
      battleAdjusted={battleAdjusted}
      attackerArmies={attackerArmies}
      attackerHealth={attackerHealth}
      attackerTroops={attackerTroops!}
      defenderArmies={defenderArmies}
      defenderHealth={defenderHealth}
      defenderTroops={defenderTroops}
      userArmiesInBattle={armies.userArmiesInBattle}
      structure={structure}
      isActive={isActive}
    />
  );
};
