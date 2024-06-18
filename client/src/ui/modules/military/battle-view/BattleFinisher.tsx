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

export const BattleFinisher = ({
  updatedBattle,
  attackerArmy,
  attackerArmyHealth,
  defenderArmy,
  defenderArmyHealth,
  structure,
}: {
  updatedBattle: BattleManager;
  attackerArmy: ArmyInfo;
  attackerArmyHealth: bigint;
  defenderArmy: ArmyInfo | undefined;
  defenderArmyHealth: bigint;
  structure: Structure | Realm | undefined;
}) => {
  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);
  const setBattleView = useUIStore((state) => state.setBattleView);
  const attackingHealth = { current: Number(attackerArmyHealth), lifetime: Number(attackerArmy.lifetime) };
  const defendingHealth = defenderArmy
    ? { current: Number(defenderArmyHealth), lifetime: Number(defenderArmy.lifetime) }
    : undefined;

  const battleAdjusted = useMemo(() => {
    return updatedBattle.getUpdatedBattle(currentDefaultTick);
  }, [currentDefaultTick]);

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
        className="absolute bottom-0"
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
          defender={defenderArmy ? `${defenderArmy.name} ${defenderArmy.isMine ? "(Yours)" : ""}` : structure!.name}
        />
        <div className="w-screen bg-brown/80 backdrop-blur-lg h-72 p-6 mb-4 flex flex-row justify-between">
          <div className="flex flex-row w-[70vw]">
            <EntityAvatar army={attackerArmy} structure={structure} />
            <TroopRow troops={battleAdjusted!.attack_army.troops} />
          </div>
          <BattleActions
            ownArmyEntityId={undefined}
            defender={defenderArmy}
            structure={structure}
            battle={battleAdjusted}
            isActive={false}
          />
          <div className="flex flex-row w-[70vw]">
            <TroopRow troops={battleAdjusted!.defence_army.troops} defending />
            <EntityAvatar army={defenderArmy} structure={structure} />
          </div>
        </div>
      </motion.div>
    </div>
  );
};
