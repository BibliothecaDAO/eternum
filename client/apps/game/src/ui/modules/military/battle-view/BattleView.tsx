import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useBattleManager } from "@/hooks/helpers/battles/useBattles";
import { getArmiesByBattleId, getArmyByEntityId, useArmyByArmyEntityId } from "@/hooks/helpers/useArmies";
import { Structure, useStructureByEntityId, useStructureByPosition } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import useNextBlockTimestamp from "@/hooks/useNextBlockTimestamp";
import { BattleSide } from "@bibliothecadao/eternum";
import { memo, useMemo } from "react";
import { Battle } from "./Battle";

export const BattleView = memo(() => {
  const dojo = useDojo();
  const getStructure = useStructureByPosition();
  const armiesByBattleId = getArmiesByBattleId();
  const { getAliveArmy } = getArmyByEntityId();

  const { nextBlockTimestamp: currentTimestamp } = useNextBlockTimestamp();
  const battleView = useUIStore((state) => state.battleView);
  const selectedHex = useUIStore((state) => state.selectedHex);

  // get updated army for when a battle starts: we need to have the updated component to have the correct battle_id
  const updatedTarget = useArmyByArmyEntityId(battleView?.targetArmy || 0);

  const battlePosition = useMemo(
    () => ({ x: selectedHex?.col || 0, y: selectedHex?.row || 0 }),
    [selectedHex?.col, selectedHex?.row],
  );

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
  }, [battleManager, battleView]);

  const ownArmySide = useMemo(
    () =>
      battleManager.isBattle()
        ? armies.userArmiesInBattle?.[0]?.battle_side || BattleSide[BattleSide.None]
        : BattleSide[BattleSide.Attack],
    [battleManager, armies.userArmiesInBattle],
  );

  const ownArmyBattleStarter = useMemo(
    () => getAliveArmy(battleView?.ownArmyEntityId || 0),
    [battleView?.ownArmyEntityId || 0],
  );

  const attackerArmies = useMemo(
    () =>
      armies.armiesInBattle.length > 0
        ? armies.armiesInBattle.filter((army) => army.battle_side === BattleSide[BattleSide.Attack])
        : [ownArmyBattleStarter!],
    [armies.armiesInBattle, ownArmyBattleStarter],
  );

  const defenderArmies = useMemo(
    () =>
      armies.armiesInBattle.length > 0
        ? armies.armiesInBattle.filter((army) => army.battle_side === BattleSide[BattleSide.Defence])
        : [targetArmy],
    [armies.armiesInBattle, targetArmy],
  );

  const battleAdjusted = useMemo(() => {
    if (!battleManager) return undefined;
    return battleManager!.getUpdatedBattle(currentTimestamp!);
  }, [currentTimestamp, battleManager, battleManager?.battleEntityId, armies.armiesInBattle, battleView]);

  const attackerHealth = useMemo(() => {
    if (battleAdjusted) {
      return {
        current: battleAdjusted.attack_army_health.current,
        lifetime: battleAdjusted.attack_army_health.lifetime,
      };
    } else {
      return {
        current: ownArmyBattleStarter?.health.current || 0n,
        lifetime: ownArmyBattleStarter?.health.lifetime || 0n,
      };
    }
  }, [battleAdjusted, ownArmyBattleStarter]);

  const defenderHealth = useMemo(() => {
    if (battleAdjusted) {
      return {
        current: battleAdjusted.defence_army_health.current,
        lifetime: battleAdjusted.defence_army_health.lifetime,
      };
    } else if (targetArmy) {
      return {
        current: targetArmy.health.current || 0n,
        lifetime: targetArmy.health.lifetime || 0n,
      };
    }
    return undefined;
  }, [battleAdjusted, targetArmy]);

  const attackerTroops = useMemo(
    () => (battleAdjusted ? battleAdjusted!.attack_army.troops : ownArmyBattleStarter?.troops),
    [battleAdjusted, ownArmyBattleStarter],
  );

  const defenderTroops = useMemo(
    () => (battleAdjusted ? battleAdjusted!.defence_army.troops : targetArmy?.troops),
    [battleAdjusted, targetArmy],
  );

  const structureFromPosition = getStructure({ x: battlePosition.x, y: battlePosition.y });

  const structureId = useStructureByEntityId(
    defenderArmies.find((army) => army?.protectee)?.protectee?.protectee_id || 0,
  );

  const structure = useMemo(() => {
    return battleView?.engage && !battleView?.battleEntityId && !battleView.targetArmy
      ? structureFromPosition
      : structureId;
  }, [battleView?.engage, battleView?.battleEntityId, battleView?.targetArmy, structureFromPosition, structureId]);

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
      structure={structure as Structure}
    />
  );
});
