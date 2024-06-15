import { useArmyByArmyEntityId } from "@/hooks/helpers/useArmies";
import { useBattleManager } from "@/hooks/helpers/useBattles";
import { Realm, Structure } from "@/hooks/helpers/useStructures";
import { BattleViewInfo } from "@/hooks/store/types";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { CombatTarget } from "@/types";
import { useMemo } from "react";
import { BattleFinisher } from "./BattleFinisher";
import { BattleStarter } from "./BattleStarter";
import { OngoingBattle } from "./OngoingBattle";

export const BattleView = () => {
  const { battleView, selectedEntity } = useUIStore((state) => ({
    battleView: state.battleView,
    selectedEntity: state.selectedEntity,
  }));
  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);
  
  const { attackerArmy, defenderArmy, structure } = useMemo(() => {
    return getArmiesAndStructure(battleView!);
  }, [battleView?.defenders]);

  const updatedAttacker = useArmyByArmyEntityId(BigInt(attackerArmy || 0n));
  const updatedDefender = useArmyByArmyEntityId(BigInt(defenderArmy || 0n));
  const { updatedBattle } = useBattleManager(BigInt(updatedDefender?.battle_id || 0n));

  const battleAdjusted = useMemo(() => {
    return updatedBattle.getUpdatedBattle(currentDefaultTick);
  }, [currentDefaultTick]);

  const elem = useMemo(() => {
    if (!attackerArmy) return;
    if (updatedBattle.battleActive(currentDefaultTick)) {
      return (
        <OngoingBattle
          attackerArmy={updatedAttacker}
          defenderArmy={updatedDefender!}
          structure={structure}
          battleManager={updatedBattle}
        />
      );
    }
    if (selectedEntity && !attackerArmy) {
      return (
        <BattleStarter
          attackerArmy={updatedAttacker}
          attackerArmyHealth={
            battleAdjusted ? battleAdjusted.attack_army_health.current : BigInt(updatedAttacker.current)
          }
          defenderArmy={
            !structure
              ? updatedDefender
              : (battleAdjusted?.defence_army_health.current === undefined ? updatedDefender?.current || 0 : 0) > 0
              ? updatedDefender
              : undefined
          }
          defenderArmyHealth={
            battleAdjusted ? battleAdjusted.defence_army_health.current : BigInt(updatedDefender.current)
          }
          structure={structure}
        />
      );
    }

    return (
      <BattleFinisher
        attackerArmy={updatedAttacker}
        attackerArmyHealth={
          battleAdjusted ? battleAdjusted.attack_army_health.current : BigInt(updatedAttacker.current)
        }
        defenderArmy={
          !structure
            ? updatedDefender
            : (battleAdjusted?.defence_army_health.current === undefined ? updatedDefender?.current || 0 : 0) > 0
            ? updatedDefender
            : undefined
        }
        defenderArmyHealth={
          battleAdjusted ? battleAdjusted.defence_army_health.current : BigInt(updatedDefender.current)
        }
        structure={structure}
      />
    );
  }, [updatedAttacker, updatedDefender, battleView, battleAdjusted, selectedEntity]);

  return elem;
};

const getArmiesAndStructure = (
  battleView: BattleViewInfo,
): {
  attackerArmy: bigint | undefined;
  defenderArmy: bigint | undefined;
  structure: Realm | Structure | undefined;
} => {
  if (battleView.defenders.type === CombatTarget.Army) {
    return {
      attackerArmy: battleView.attackers[0],
      defenderArmy: (battleView.defenders.entities as bigint[])[0],
      structure: undefined,
    };
  } else if (battleView.defenders.type === CombatTarget.Structure) {
    const target = battleView.defenders.entities as Realm | Structure;
    return {
      attackerArmy: battleView.attackers[0],
      defenderArmy: BigInt(target.protector?.entity_id || 0n),
      structure: target,
    };
  }
  return { attackerArmy: undefined, defenderArmy: undefined, structure: undefined };
};
