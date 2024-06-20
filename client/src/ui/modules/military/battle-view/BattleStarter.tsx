import { getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { Realm, Structure } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { CombatTarget } from "@/types";
import Button from "@/ui/elements/Button";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { BattleActions } from "./BattleActions";
import { BattleProgressBar } from "./BattleProgressBar";
import { EntityAvatar } from "./EntityAvatar";
import { TroopRow } from "./Troops";

export const BattleStarter = ({ target }: { target: { type: CombatTarget; entity: bigint | Realm | Structure } }) => {
  const setBattleView = useUIStore((state) => state.setBattleView);
  const selectedEntity = useUIStore((state) => state.selectedEntity);

  const { defender, structure } = useMemo(() => getArmiesAndStructure(target!), [target]);

  const defenderArmy = getArmyByEntityId(BigInt(defender || 0n));
  const ownArmy = getArmyByEntityId(BigInt(selectedEntity!.id || 0n));

  const attackingHealth = { current: Number(ownArmy.current), lifetime: Number(ownArmy.lifetime) };
  const defendingHealth = defenderArmy
    ? { current: Number(defenderArmy.current || 0), lifetime: Number(defenderArmy.lifetime || 0) }
    : undefined;

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
          attacker={`${ownArmy.name} ${ownArmy.isMine ? "(Yours)" : ""}`}
          defendingHealth={defendingHealth}
          defender={structure ? structure.name : `${defenderArmy!.name}`}
        />
        <div className="w-screen bg-brown/80 backdrop-blur-lg h-72 p-6 mb-4 flex flex-row justify-between">
          <div className="flex flex-row w-[70vw]">
            <EntityAvatar />
            <TroopRow troops={ownArmy!.troops} />
          </div>
          <BattleActions
            ownArmyEntityId={BigInt(ownArmy.entity_id)}
            defender={defenderArmy}
            structure={structure}
            battle={undefined}
            isActive={false}
          />
          <div className="flex flex-row w-[70vw]">
            <TroopRow troops={defenderArmy?.troops} defending />
            <EntityAvatar structure={structure} />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const getArmiesAndStructure = (target: {
  type: CombatTarget;
  entity: bigint | Realm | Structure;
}): {
  defender: bigint | undefined;
  structure: Realm | Structure | undefined;
} => {
  if (target.type === CombatTarget.Army) {
    return {
      defender: target.entity as bigint,
      structure: undefined,
    };
  } else if (target.type === CombatTarget.Structure) {
    return {
      defender: BigInt((target.entity as Realm | Structure).protector?.entity_id || 0n),
      structure: target.entity as Realm | Structure,
    };
  }
  return { defender: undefined, structure: undefined };
};
