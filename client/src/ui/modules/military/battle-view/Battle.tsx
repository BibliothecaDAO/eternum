import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { BattleType } from "@/dojo/modelManager/types";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Realm, Structure } from "@/hooks/helpers/useStructures";
import Button from "@/ui/elements/Button";
import { BattleSide, Troops } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { motion } from "framer-motion";
import { useState } from "react";
import { BattleActions } from "./BattleActions";
import { BattleProgressBar } from "./BattleProgressBar";
import { BattleSideView } from "./BattleSideView";
import { LockedResources } from "./LockedResources";
import { TopScreenView } from "./TopScreenView";

export interface Health {
  current: number;
  lifetime: number;
}

export const Battle = ({
  ownArmySide,
  ownArmyEntityId,
  battleManager,
  battleAdjusted,
  attackerArmies,
  attackerHealth,
  attackerTroops,
  defenderArmies,
  defenderHealth,
  defenderTroops,
  userArmiesAtPosition,
  structure,
  isActive,
  durationLeft,
}: {
  ownArmySide: string;
  ownArmyEntityId: bigint;
  battleManager: BattleManager | undefined;
  battleAdjusted: ComponentValue<BattleType> | undefined;
  attackerArmies: ArmyInfo[];
  attackerHealth: Health;
  attackerTroops: Troops;
  defenderArmies: ArmyInfo[];
  defenderHealth: Health | undefined;
  defenderTroops: Troops | undefined;
  userArmiesAtPosition: ArmyInfo[] | undefined;
  structure: Structure | undefined;
  isActive: boolean;
  durationLeft: Date | undefined;
}) => {
  const [showBattleDetails, setShowBattleDetails] = useState<boolean>(false);

  return (
    <div>
      <TopScreenView />

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
          ownArmySide={ownArmySide}
          attackingHealth={attackerHealth}
          attackerArmies={attackerArmies}
          defendingHealth={defenderHealth}
          defenderArmies={defenderArmies}
          structure={structure}
          durationLeft={durationLeft}
        />
        <div className="w-screen bg-brown/80 backdrop-blur-lg h-72 p-6 mb-4">
          <div className="flex flex-row justify-between h-[20vh]">
            <BattleSideView
              battleSide={BattleSide.Attack}
              battleId={battleManager?.battleId}
              showBattleDetails={showBattleDetails}
              ownSideArmies={attackerArmies}
              ownSideTroopsUpdated={attackerTroops}
              userArmiesAtPosition={userArmiesAtPosition}
              opposingSideArmies={defenderArmies}
              structure={undefined}
            />
            {showBattleDetails && battleAdjusted ? (
              <LockedResources
                attackersResourcesEscrowEntityId={battleAdjusted!.attackers_resources_escrow_id}
                defendersResourcesEscrowEntityId={battleAdjusted!.defenders_resources_escrow_id}
              />
            ) : (
              <BattleActions
                ownArmyEntityId={ownArmyEntityId}
                defender={defenderArmies?.[0]}
                structure={structure}
                battle={battleAdjusted}
                isActive={isActive}
              />
            )}
            <BattleSideView
              battleSide={BattleSide.Defence}
              battleId={battleManager?.battleId}
              showBattleDetails={showBattleDetails}
              ownSideArmies={defenderArmies}
              ownSideTroopsUpdated={defenderTroops}
              userArmiesAtPosition={userArmiesAtPosition}
              opposingSideArmies={attackerArmies}
              structure={structure}
            />
          </div>
          <div className="flex justify-center mt-4">
            {battleAdjusted && (
              <Button onClick={() => setShowBattleDetails(!showBattleDetails)}>{`${
                !showBattleDetails ? "Details" : "Close"
              }`}</Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
