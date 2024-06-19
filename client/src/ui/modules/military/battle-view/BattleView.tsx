import { getArmyByEntityId, useArmyByArmyEntityId } from "@/hooks/helpers/useArmies";
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
  const battleView = useUIStore((state) => state.battleView);
  const selectedEntity = useUIStore((state) => state.selectedEntity);

  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);

  const { attackers, defenders, structure } = useMemo(() => {
    return getArmiesAndStructure(battleView!);
  }, [battleView?.defenders]);

  const updatedAttacker = useArmyByArmyEntityId(BigInt(attackers?.[0] || 0n));
  const defender = getArmyByEntityId(BigInt(defenders?.[0] || 0n));
  const { updatedBattle } = useBattleManager(BigInt(defender?.battle_id || updatedAttacker?.battle_id || 0));

  const battleAdjusted = useMemo(() => {
    return updatedBattle.getUpdatedBattle(currentDefaultTick);
  }, [currentDefaultTick]);

  const elem = useMemo(() => {
    if (!attackers) return;
    if (updatedBattle.battleActive(currentDefaultTick)) {
      return (
        <OngoingBattle
          attackers={attackers}
          defenders={defenders!}
          structure={structure}
          battleManager={updatedBattle}
          ownArmyEntityId={selectedEntity?.id}
        />
      );
    }

    if (battleAdjusted === undefined && selectedEntity) {
      return (
        <BattleStarter
          ownArmy={updatedAttacker}
          defenderArmy={!structure ? defender : structure.protector}
          structure={structure}
        />
      );
    }

    return (
      <BattleFinisher
        attackers={attackers}
        defenders={defenders}
        attackerArmy={updatedAttacker}
        attackerArmyHealth={
          battleAdjusted ? battleAdjusted.attack_army_health.current : BigInt(updatedAttacker.current)
        }
        defenderArmy={defender}
        defenderArmyHealth={
          battleAdjusted ? battleAdjusted.defence_army_health.current : BigInt(defender?.current || 0)
        }
        structure={structure}
        updatedBattle={updatedBattle}
      />
    );
  }, [updatedAttacker, defender, battleView, battleAdjusted, selectedEntity]);

  return elem;
};

const getArmiesAndStructure = (
  battleView: BattleViewInfo,
): {
  attackers: bigint[] | undefined;
  defenders: bigint[] | undefined;
  structure: Realm | Structure | undefined;
} => {
  if (battleView.defenders.type === CombatTarget.Army) {
    return {
      attackers: battleView.attackers,
      defenders: battleView.defenders.entities as bigint[],
      structure: undefined,
    };
  } else if (battleView.defenders.type === CombatTarget.Structure) {
    const target = battleView.defenders.entities as Realm | Structure;
    return {
      attackers: battleView.attackers,
      defenders: [BigInt(target.protector?.entity_id || 0n)],
      structure: target,
    };
  }
  return { attackers: undefined, defenders: undefined, structure: undefined };
};
