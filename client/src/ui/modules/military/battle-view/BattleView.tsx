import { getArmiesAtPosition, getArmyByEntityId, useArmiesByBattleId } from "@/hooks/helpers/useArmies";
import { useBattleManagerByPosition } from "@/hooks/helpers/useBattles";
import { getStructureAtPosition } from "@/hooks/helpers/useStructures";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { useMemo } from "react";
import { Battle } from "./Battle";
import { getDefenderAndStructureFromTarget } from "./utils";

export const BattleView = () => {
  const currentTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const battleView = useUIStore((state) => state.battleView);
  const selectedEntity = useUIStore((state) => state.selectedEntity);

  const defenderAndStructureBattleStarter = useMemo(() => {
    if (!battleView || !battleView!.target) {
      return undefined;
    } else {
      return getDefenderAndStructureFromTarget(battleView!.target!);
    }
  }, [battleView]);

  const battlePosition = battleView?.battle || { x: selectedEntity!.position.x, y: selectedEntity!.position.y };

  const battleManager = useBattleManagerByPosition(battlePosition);

  const structure = getStructureAtPosition(battlePosition);

  let armiesInBattle = useArmiesByBattleId(battleManager?.battleId || 0n);
  if (!battleManager) {
    armiesInBattle = [];
  }
  const userArmiesInBattle = armiesInBattle.filter((army) => army.isMine);

  const ownArmySide = battleManager ? String(userArmiesInBattle[0]?.battle_side || "") : "Attack";

  const { getArmy } = getArmyByEntityId();
  const ownArmyEntityId = selectedEntity?.id || BigInt(userArmiesInBattle.find((army) => army.isMine)?.entity_id || 0);
  const ownArmyBattleStarter = getArmy(BigInt(ownArmyEntityId || 0n));
  const defenderArmyBattleStarter = getArmy(BigInt(defenderAndStructureBattleStarter?.defender || 0n));

  const attackerArmies =
    armiesInBattle.length > 0
      ? armiesInBattle.filter((army) => String(army.battle_side) === "Attack")
      : [ownArmyBattleStarter];

  const defenderArmies =
    armiesInBattle.length > 0
      ? armiesInBattle.filter((army) => String(army.battle_side) === "Defence")
      : [defenderArmyBattleStarter];

  const battleAdjusted = useMemo(() => {
    if (!battleManager) return undefined;
    return battleManager!.getUpdatedBattle(currentTimestamp!);
  }, [currentTimestamp, battleManager, battleManager?.battleId, armiesInBattle, battleView]);

  const durationLeft = useMemo(() => {
    if (!battleManager) return undefined;
    return battleManager!.getTimeLeft(currentTimestamp!);
  }, [battleAdjusted?.duration_left, battleManager, currentTimestamp, battleView]);

  const { getArmies } = getArmiesAtPosition();
  const userArmiesAtPosition = useMemo(() => {
    return getArmies(battlePosition).userArmiesAtPosition;
  }, [battlePosition, battleAdjusted]);

  const attackerHealth = battleAdjusted
    ? {
        current: Number(battleAdjusted!.attack_army_health.current),
        lifetime: Number(battleAdjusted!.attack_army_health.lifetime),
      }
    : { current: Number(ownArmyBattleStarter?.current || 0), lifetime: Number(ownArmyBattleStarter?.lifetime || 0) };
  const defenderHealth = battleAdjusted
    ? {
        current: Number(battleAdjusted!.defence_army_health.current),
        lifetime: Number(battleAdjusted!.defence_army_health.lifetime),
      }
    : defenderArmyBattleStarter
      ? {
          current: Number(defenderArmyBattleStarter.current || 0),
          lifetime: Number(defenderArmyBattleStarter.lifetime || 0),
        }
      : undefined;

  const attackerTroops = battleAdjusted ? battleAdjusted!.attack_army.troops : ownArmyBattleStarter?.troops;
  const defenderTroops = battleAdjusted ? battleAdjusted!.defence_army.troops : defenderArmyBattleStarter?.troops;

  const isActive = Boolean(battleManager?.isBattleActive(currentTimestamp!));

  return (
    <Battle
      ownArmySide={ownArmySide}
      ownArmyEntityId={ownArmyEntityId}
      battleManager={battleManager}
      battleAdjusted={battleAdjusted}
      attackerArmies={attackerArmies}
      attackerHealth={attackerHealth}
      attackerTroops={attackerTroops}
      defenderArmies={defenderArmies}
      defenderHealth={defenderHealth}
      defenderTroops={defenderTroops}
      userArmiesInBattle={userArmiesInBattle}
      userArmiesAtPosition={userArmiesAtPosition}
      structure={structure}
      isActive={isActive}
      durationLeft={durationLeft}
    />
  );
};
