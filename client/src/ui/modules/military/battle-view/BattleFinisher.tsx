import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Realm, Structure } from "@/hooks/helpers/useStructures";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { BattleActions } from "./BattleActions";
import { BattleDetails } from "./BattleDetails";
import { BattleProgressBar } from "./BattleProgressBar";
import { EntityAvatar } from "./EntityAvatar";
import { LockedResources } from "./LockedResources";
import { TroopRow } from "./Troops";

export const BattleFinisher = ({
  attackers,
  defenders,
  updatedBattle,
  attackerArmy,
  attackerArmyHealth,
  defenderArmy,
  defenderArmyHealth,
  structure,
}: {
  attackers: bigint[] | undefined;
  defenders: bigint[] | undefined;
  updatedBattle: BattleManager;
  attackerArmy: ArmyInfo | undefined;
  attackerArmyHealth: bigint;
  defenderArmy: ArmyInfo | undefined;
  defenderArmyHealth: bigint;
  structure: Structure | Realm | undefined;
}) => {
  const [showBattleDetails, setShowBattleDetails] = useState<boolean>(false);

  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);
  const setBattleView = useUIStore((state) => state.setBattleView);
  const attackingHealth = attackerArmy
    ? { current: Number(attackerArmyHealth), lifetime: Number(attackerArmy.lifetime) }
    : undefined;
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
          attacker={`${attackerArmy?.name || "Empty"} ${attackerArmy?.isMine ? "(Yours)" : ""}`}
          defendingHealth={defendingHealth}
          defender={
            defenderArmy
              ? `${defenderArmy.name} ${defenderArmy.isMine ? "(Yours)" : ""}`
              : structure
              ? structure!.name
              : "Empty"
          }
        />
        <div className="w-screen bg-brown/80 backdrop-blur-lg h-72 p-6 mb-4">
          <div className="flex flex-row justify-between h-[20vh]">
            <div className="flex flex-row w-[70vw]">
              <div>
                <EntityAvatar empty={!Boolean(attackerArmy)} />
              </div>
              {showBattleDetails ? (
                <BattleDetails armiesEntityIds={attackers} battleId={updatedBattle.battleId} />
              ) : (
                <TroopRow troops={battleAdjusted!.attack_army.troops} />
              )}
            </div>
            {showBattleDetails ? (
              <LockedResources
                attackersResourcesEscrowEntityId={battleAdjusted!.attackers_resources_escrow_id}
                defendersResourcesEscrowEntityId={battleAdjusted!.defenders_resources_escrow_id}
              />
            ) : (
              <BattleActions
                ownArmyEntityId={attackerArmy?.isMine ? BigInt(attackerArmy.entity_id) : undefined}
                defender={undefined}
                structure={structure}
                battle={battleAdjusted}
                isActive
              />
            )}
            <div className="flex flex-row w-[70vw]">
              {showBattleDetails ? (
                <BattleDetails armiesEntityIds={defenders} battleId={updatedBattle.battleId} />
              ) : (
                <TroopRow troops={battleAdjusted!.defence_army.troops} />
              )}
              <div>
                <EntityAvatar structure={structure} empty={!Boolean(defenderArmy)} />
              </div>
            </div>
          </div>
          <div className="flex justify-center mt-4">
            <Button onClick={() => setShowBattleDetails(!showBattleDetails)}>Details</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
