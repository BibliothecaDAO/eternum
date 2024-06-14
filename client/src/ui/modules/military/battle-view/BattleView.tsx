import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { useBattleManager } from "@/hooks/helpers/useBattles";
import { Realm, Structure } from "@/hooks/helpers/useStructures";
import { BattleViewInfo } from "@/hooks/store/types";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { CombatTarget } from "@/types";
import { useMemo } from "react";
import { NoOngoingBattle } from "./NoOngoingBattle";
import { OngoingBattle } from "./OngoingBattle";
import { getAttackerDefender } from "./utils";

export const BattleView = () => {
  const { battleView } = useUIStore((state) => ({
    battleView: state.battleView,
  }));
  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);

  const { attackerArmy, defenderArmy, structure } = useMemo(() => {
    return getArmiesAndStructure(battleView!);
  }, [battleView?.defenders]);

  const { updatedBattle } = useBattleManager(BigInt(defenderArmy?.battle_id || 0n));

  const battleAdjusted = useMemo(() => {
    return updatedBattle.getUpdatedBattle(currentDefaultTick);
  }, [currentDefaultTick]);

  return (
    attackerArmy &&
    (updatedBattle.battleActive(currentDefaultTick) ? (
      <OngoingBattle
        attackerArmy={attackerArmy}
        defenderArmy={defenderArmy!}
        structure={structure}
        battleManager={updatedBattle}
      />
    ) : (
      <NoOngoingBattle
        attackerArmy={attackerArmy}
        defenderArmy={
          !structure
            ? defenderArmy
            : (battleAdjusted?.defence_army_health.current === undefined ? defenderArmy?.current || 0 : 0) > 0
            ? defenderArmy
            : undefined
        }
        structure={structure}
      />
    ))
  );
};

const getArmiesAndStructure = (
  battleView: BattleViewInfo,
): {
  attackerArmy: ArmyInfo | undefined;
  defenderArmy: ArmyInfo | undefined;
  structure: Realm | Structure | undefined;
} => {
  if (battleView.defenders.type === CombatTarget.Army) {
    return {
      ...getAttackerDefender(battleView.attackers[0], (battleView.defenders.entities as ArmyInfo[])[0]),
      structure: undefined,
    };
  } else if (battleView.defenders.type === CombatTarget.Structure) {
    const target = battleView.defenders.entities as Realm | Structure;
    return { attackerArmy: battleView.attackers[0], defenderArmy: target.protector, structure: target };
  }
  return { attackerArmy: undefined, defenderArmy: undefined, structure: undefined };
};
