import { HintSection } from "@/ui/components/hints/hint-modal";
import Button from "@/ui/elements/button";
import { HintModalButton } from "@/ui/elements/hint-modal-button";
import { BattleActions } from "@/ui/modules/military/battle-view/battle-actions";
import { BattleProgress } from "@/ui/modules/military/battle-view/battle-progress";
import { BattleSideView } from "@/ui/modules/military/battle-view/battle-side-view";
import { BattleTwitterShareButton } from "@/ui/modules/military/battle-view/battle-twitter-share-button";
import { LockedResources } from "@/ui/modules/military/battle-view/locked-resources";
import { TopScreenView } from "@/ui/modules/military/battle-view/top-screen-view";
import {
  ArmyInfo,
  BattleManager,
  BattleSide,
  ClientComponents,
  ID,
  Structure,
  type Health,
} from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { motion } from "framer-motion";
import { memo, useState } from "react";

export const Battle = memo(
  ({
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
    ownArmyEntityId: ID;
    battleAdjusted: ComponentValue<ClientComponents["Battle"]["schema"]> | undefined;
    attackerArmies: ArmyInfo[];
    attackerHealth: Health;
    attackerTroops: ComponentValue<ClientComponents["Army"]["schema"]>["troops"];
    defenderArmies: (ArmyInfo | undefined)[];
    defenderHealth: Health | undefined;
    defenderTroops: ComponentValue<ClientComponents["Army"]["schema"]>["troops"] | undefined;
    userArmiesInBattle: ArmyInfo[];
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
          <div className="flex justify-center mb-2 space-x-1 items-center">
            <Button variant="opaque" onClick={() => setShowBattleDetails(!showBattleDetails)} className="h-10">{`${
              !showBattleDetails ? "Details" : "Overview"
            }`}</Button>
            <BattleTwitterShareButton
              userArmiesInBattle={userArmiesInBattle}
              attackerArmies={attackerArmies}
              defenderArmies={defenderArmies}
              ownArmySide={ownArmySide}
              battleAdjusted={battleAdjusted}
              structure={structure}
            />
            <HintModalButton className={`relative ${battleAdjusted ? "left-3" : ""}`} section={HintSection.Combat} />
          </div>

          <div className="w-screen bg-brown bg-hex-bg min-h-[40vh]">
            <BattleProgress
              battleManager={battleManager}
              ownArmySide={ownArmySide}
              attackingHealth={attackerHealth}
              attackerArmies={attackerArmies}
              defendingHealth={defenderHealth}
              defenderArmies={defenderArmies}
              structure={structure}
            />
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
                userArmiesOnThatSide={userArmiesInBattle.filter(
                  (army) => army.battle_side === BattleSide[BattleSide.Attack],
                )}
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
                userArmiesOnThatSide={userArmiesInBattle.filter(
                  (army) => army.battle_side === BattleSide[BattleSide.Defence],
                )}
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  },
);
