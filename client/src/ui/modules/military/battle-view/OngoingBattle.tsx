import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Realm, Structure } from "@/hooks/helpers/useStructures";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { BattleActions } from "./BattleActions";
import { BattleProgressBar } from "./BattleProgressBar";
import { EntityAvatar } from "./EntityAvatar";
import { TroopRow } from "./Troops";

export const OngoingBattle = ({
  attackerArmy,
  defenderArmy,
  battleManager,
  structure,
}: {
  attackerArmy: ArmyInfo;
  defenderArmy: ArmyInfo;
  battleManager: BattleManager;
  structure: Structure | Realm | undefined;
}) => {
  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);
  const battleAdjusted = useMemo(() => {
    return battleManager.getUpdatedBattle(currentDefaultTick);
  }, [currentDefaultTick]);

  const { setBattleView } = useUIStore((state) => ({
    setBattleView: state.setBattleView,
  }));

  const attackingHealth =
    battleAdjusted === undefined
      ? { current: Number(attackerArmy.current), lifetime: Number(attackerArmy.lifetime) }
      : {
          current: Number(battleAdjusted.attack_army_health.current),
          lifetime: Number(battleAdjusted.attack_army_health.lifetime),
        };
  const defendingHealth =
    battleAdjusted === undefined
      ? { current: Number(defenderArmy.current), lifetime: Number(defenderArmy.lifetime) }
      : {
          current: Number(battleAdjusted.defence_army_health.current),
          lifetime: Number(battleAdjusted.defence_army_health.lifetime),
        };

  return (
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
        className="absolute bottom-0 "
        variants={{
          hidden: { y: "100%" },
          visible: { y: "0%", opacity: 1, transition: { duration: 0.5 } },
        }}
        initial="hidden"
        animate="visible"
        exit="hidden"
      >
        <BattleProgressBar
          attackingHealth={attackingHealth}
          attacker={`${attackerArmy.name} ${attackerArmy.isMine ? "(Yours)" : ""}`}
          defendingHealth={defendingHealth}
          defender={`${defenderArmy.name} ${defenderArmy.isMine ? "(Yours)" : ""}`}
        />
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
            battleId={BigInt(defenderArmy.battle_id)}
            isActive
          />
          <div className="flex flex-row w-[70vw]">
            <TroopRow army={defenderArmy as ArmyInfo} defending />
            <EntityAvatar army={defenderArmy} structure={structure} />
          </div>
        </div>
      </motion.div>
    </div>
  );
};
