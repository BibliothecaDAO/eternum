import { ClientComponents } from "@/dojo/createClientComponents";
import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Structure } from "@/hooks/helpers/useStructures";
import { Health } from "@/types";
import { HintSection } from "@/ui/components/hints/HintModal";
import Button from "@/ui/elements/Button";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { BattleSide, ID } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { motion } from "framer-motion";
import { useState } from "react";
import { BattleActions } from "./BattleActions";
import { BattleProgressBar } from "./BattleProgressBar";
import { BattleSideView } from "./BattleSideView";
import { LockedResources } from "./LockedResources";
import { TopScreenView } from "./TopScreenView";

export const Battle = ({
  battleManager,
  ownArmySide,
  ownArmyEntityId,
  battleAdjusted,
  attackerArmies,
  attackerHealth,
  attackerTroops,
  defenderArmies,
  defenderHealth,
  defenderTroops,
  userArmiesInBattle,
  structure,
}: {
  battleManager: BattleManager;
  ownArmySide: string;
  ownArmyEntityId: ID | undefined;
  battleAdjusted: ComponentValue<ClientComponents["Battle"]["schema"]> | undefined;
  attackerArmies: ArmyInfo[];
  attackerHealth: Health;
  attackerTroops: ComponentValue<ClientComponents["Army"]["schema"]>["troops"];
  defenderArmies: (ArmyInfo | undefined)[];
  defenderHealth: Health | undefined;
  defenderTroops: ComponentValue<ClientComponents["Army"]["schema"]>["troops"] | undefined;
  userArmiesInBattle: (ArmyInfo | undefined)[];
  structure: Structure | undefined;
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
            <Button variant="opaque" onClick={() => setShowBattleDetails(!showBattleDetails)}>{`${
              !showBattleDetails ? "Details" : "Overview"
            }`}</Button>
          )}
          <HintModalButton className={`relative ${battleAdjusted ? "left-3" : ""}`} section={HintSection.Combat} />
        </div>
        <BattleProgressBar
          battleManager={battleManager}
          ownArmySide={ownArmySide}
          attackingHealth={attackerHealth}
          attackerArmies={attackerArmies}
          defendingHealth={defenderHealth}
          defenderArmies={defenderArmies}
          structure={structure}
        />
        <div className="w-screen bg-[#1b1a1a] -top bg-hex-bg h-[35vh]">
          <div className="grid grid-cols-12 justify-between gap-4 h-full">
            <BattleSideView
              battleManager={battleManager}
              battleSide={BattleSide.Attack}
              battleEntityId={battleManager?.battleEntityId}
              showBattleDetails={showBattleDetails}
              ownSideArmies={attackerArmies}
              ownSideTroopsUpdated={attackerTroops}
              ownArmyEntityId={ownArmyEntityId}
              structure={undefined}
            />
            {showBattleDetails && battleAdjusted ? (
              <LockedResources
                attackersResourcesEscrowEntityId={battleAdjusted?.attackers_resources_escrow_id}
                defendersResourcesEscrowEntityId={battleAdjusted?.defenders_resources_escrow_id}
              />
            ) : (
              <BattleActions
                battleManager={battleManager}
                userArmiesInBattle={userArmiesInBattle}
                ownArmyEntityId={ownArmyEntityId}
                attackerArmies={attackerArmies}
                defenderArmies={defenderArmies}
                structure={structure}
                battleAdjusted={battleAdjusted}
              />
            )}
            <BattleSideView
              battleManager={battleManager}
              battleSide={BattleSide.Defence}
              battleEntityId={battleManager?.battleEntityId}
              showBattleDetails={showBattleDetails}
              ownSideArmies={defenderArmies}
              ownSideTroopsUpdated={defenderTroops}
              ownArmyEntityId={ownArmyEntityId}
              structure={structure}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
};
