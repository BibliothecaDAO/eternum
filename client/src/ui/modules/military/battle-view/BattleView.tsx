import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { useBattleManager } from "@/hooks/helpers/useBattles";
import { FullStructure } from "@/hooks/helpers/useStructures";
import { BattleViewInfo } from "@/hooks/store/types";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import { CombatTarget } from "@/types";
import Button from "@/ui/elements/Button";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { BattleActions } from "./BattleActions";
import { BattleProgressBar } from "./BattleProgressBar";
import { EntityAvatar } from "./EntityAvatar";
import { TroopRow } from "./Troops";
import { getAttackerDefender } from "./utils";

export const BattleView = () => {
  const { battleView, setBattleView } = useUIStore((state) => ({
    battleView: state.battleView,
    setBattleView: state.setBattleView,
  }));
  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);

  const { attackerArmy, defenderArmy, structure } = useMemo(
    () => getArmiesAndStructure(battleView!),
    [battleView?.defenders],
  );
  
  const { updatedBattle } = useBattleManager(BigInt(defenderArmy?.battle_id || 0n));

  const battleAdjusted = useMemo(() => {
    return updatedBattle.getUpdatedBattle(currentDefaultTick);
  }, [currentDefaultTick]);

  const attackingHealth =
    battleAdjusted === undefined ? Number(attackerArmy?.current) : Number(battleAdjusted?.attack_army_health.current);
  const defendingHealth =
    battleAdjusted === undefined ? Number(defenderArmy?.current) : Number(battleAdjusted?.defence_army_health.current);

  return (
    attackerArmy && (
      <div>
        <motion.div
          className="absolute top-0 flex w-full"
          variants={{
            hidden: { y: "-100%", opacity: 0 },
            visible: { y: "0%", opacity: 1, transition: { duration: 0.3 } },
          }}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <div className="mx-auto bg-brown text-gold text-2xl  p-4 flex flex-col w-72 text-center clip-angled">
            <div className="mb-4">Battle!</div>

            <Button onClick={() => setBattleView(null)}>exit battle view</Button>
          </div>
        </motion.div>
        <motion.div
          className="absolute bottom-0"
          variants={{
            hidden: { y: "100%" },
            visible: { y: "0%", opacity: 1, transition: { duration: 0.5 } },
          }}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          {defenderArmy && (
            <BattleProgressBar
              attackingHealth={attackingHealth}
              lifetimeAttackingHealth={Number(attackerArmy?.lifetime)}
              attacker={`${attackerArmy.name} ${attackerArmy.isMine ? "(Yours)" : ""}`}
              defendingHealth={defendingHealth}
              lifetimeDefendingHealth={Number(defenderArmy?.lifetime)}
              defender={`${defenderArmy?.name} ${defenderArmy.isMine ? "(Yours)" : ""}`}
            />
          )}
          <div className="w-screen bg-brown/80 backdrop-blur-lg h-72 p-6 mb-4 flex flex-row justify-between">
            <div className="flex flex-row w-[70vw]">
              <EntityAvatar army={attackerArmy} structure={structure} />
              <TroopRow army={attackerArmy} />
            </div>
            <BattleActions
              battle={battleAdjusted}
              attacker={attackerArmy}
              defender={defenderArmy}
              structure={structure}
              battleId={BigInt(defenderArmy?.battle_id || "0")}
            />
            <div className="flex flex-row w-[70vw]">
              <TroopRow army={defenderArmy as ArmyInfo} defending />
              <EntityAvatar army={defenderArmy} structure={structure} />
            </div>
          </div>
        </motion.div>
      </div>
    )
  );
};

const getArmiesAndStructure = (
  battleView: BattleViewInfo,
): { attackerArmy: ArmyInfo | undefined; defenderArmy: ArmyInfo | undefined; structure: FullStructure | undefined } => {
  if (battleView.defenders.type === CombatTarget.Army) {
    return {
      ...getAttackerDefender(battleView.attackers[0], (battleView.defenders.entities as ArmyInfo[])[0]),
      structure: undefined,
    };
  } else if (battleView.defenders.type === CombatTarget.Structure) {
    const target = battleView.defenders.entities as FullStructure;
    return { attackerArmy: battleView.attackers[0], defenderArmy: target.protector, structure: target };
  }
  return { attackerArmy: undefined, defenderArmy: undefined, structure: undefined };
};
