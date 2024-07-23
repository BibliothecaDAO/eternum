import { ClientComponents } from "@/dojo/createClientComponents";
import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Structure } from "@/hooks/helpers/useStructures";
import { HintSection } from "@/ui/components/hints/HintModal";
import Button from "@/ui/elements/Button";
import { HintModalButton } from "@/ui/elements/HintModalButton";
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
  current: bigint;
  lifetime: bigint;
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
  userArmiesInBattle,
  userArmiesAtPosition,
  structure,
  isActive,
  durationLeft,
}: {
  ownArmySide: string;
  ownArmyEntityId: bigint;
  battleManager: BattleManager | undefined;
  battleAdjusted: ComponentValue<ClientComponents["Battle"]["schema"]> | undefined;
  attackerArmies: ArmyInfo[];
  attackerHealth: Health;
  attackerTroops: Troops;
  defenderArmies: ArmyInfo[];
  defenderHealth: Health | undefined;
  defenderTroops: Troops | undefined;
  userArmiesInBattle: ArmyInfo[] | undefined;
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
        className="absolute bottom-0 "
        variants={{
          hidden: { y: "100%" },
          visible: { y: "0%", opacity: 1, transition: { duration: 0.5 } },
        }}
        initial="hidden"
        animate="visible"
        exit="hidden"
      >
        <div className="flex justify-center mb-2">
          {battleAdjusted && (
            <Button variant="primary" onClick={() => setShowBattleDetails(!showBattleDetails)}>{`${
              !showBattleDetails ? "Battle Details" : "Overview"
            }`}</Button>
          )}
          <HintModalButton className={`relative ${battleAdjusted ? "left-3" : ""}`} section={HintSection.Combat} />
        </div>
        <BattleProgressBar
          ownArmySide={ownArmySide}
          attackingHealth={attackerHealth}
          attackerArmies={attackerArmies}
          defendingHealth={defenderHealth}
          defenderArmies={defenderArmies}
          structure={structure}
          durationLeft={durationLeft}
        />
        <div className="w-screen bg-brown/80 backdrop-blur-lg -top bg-map h-[35vh]">
          <div className="grid grid-cols-12 justify-between gap-4 h-full">
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
                attackersResourcesEscrowEntityId={BigInt(battleAdjusted!.attackers_resources_escrow_id)}
                defendersResourcesEscrowEntityId={BigInt(battleAdjusted!.defenders_resources_escrow_id)}
              />
            ) : (
              <BattleActions
                userArmiesInBattle={userArmiesInBattle}
                userArmiesAtPosition={userArmiesAtPosition}
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
        </div>
      </motion.div>
    </div>
  );
};
