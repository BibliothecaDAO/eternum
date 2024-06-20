import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Realm, Structure } from "@/hooks/helpers/useStructures";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { BattleSide, Position } from "@bibliothecadao/eternum";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { BattleActions } from "./BattleActions";
import { BattleDetails } from "./BattleDetails";
import { BattleProgressBar } from "./BattleProgressBar";
import { EntityAvatar } from "./EntityAvatar";
import { LockedResources } from "./LockedResources";
import { SelectActiveArmy } from "./OngoingBattle";
import { TroopRow } from "./Troops";

export const BattleFinisher = ({
  battleManager,
  structure,
  selectedEntityId,
  armiesInBattle,
  userArmiesAtPosition,
}: {
  battleManager: BattleManager;
  structure: Structure | Realm | undefined;
  selectedEntityId: bigint | undefined;
  position: Position;
  armiesInBattle: ArmyInfo[];
  userArmiesAtPosition: ArmyInfo[];
}) => {
  const {
    setup: {
      account: { account },
      systemCalls: { battle_join },
    },
  } = useDojo();

  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);
  const setBattleView = useUIStore((state) => state.setBattleView);

  const userArmiesInBattle = armiesInBattle.filter((army) => army.isMine);
  const ownArmySide = String(userArmiesInBattle[0]?.battle_side || "");

  const attackerArmies = armiesInBattle.filter((army) => String(army.battle_side) === "Attack");
  const defenderArmies = armiesInBattle.filter((army) => String(army.battle_side) === "Defence");

  const attackers = attackerArmies.map((army) => BigInt(army.entity_id));
  const defenders = defenderArmies.map((army) => BigInt(army.entity_id));

  const ownArmyEntityId = useMemo(() => {
    if (selectedEntityId) return selectedEntityId;
    if (userArmiesInBattle[0]?.isMine) return BigInt(userArmiesInBattle?.[0].entity_id);
  }, [selectedEntityId]);

  const battleAdjusted = useMemo(() => {
    return battleManager.getUpdatedBattle(currentDefaultTick);
  }, [currentDefaultTick]);

  const [loading, setLoading] = useState<boolean>(false);
  const [showBattleDetails, setShowBattleDetails] = useState<boolean>(false);
  const [selectedUnit, setSelectedUnit] = useState<bigint | undefined>(ownArmyEntityId);

  const attackingHealth = {
    current: Number(battleAdjusted?.attack_army_health.current),
    lifetime: Number(battleAdjusted?.attack_army_health.lifetime),
  };
  const defendingHealth = {
    current: Number(battleAdjusted?.defence_army_health.current),
    lifetime: Number(battleAdjusted?.defence_army_health.lifetime),
  };

  const joinBattle = async (side: BattleSide, armyId: bigint) => {
    if (selectedUnit) {
      setLoading(true);
      await battle_join({
        signer: account,
        army_id: armyId,
        battle_id: battleManager.battleId,
        battle_side: BigInt(side),
      });
      setLoading(false);
    } else {
      setSelectedUnit(0n);
    }
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
          attacker={`${attackerArmies.length > 0 ? "Attackers" : "Empty"} ${ownArmySide === "Attack" ? "(⚔️)" : ""}`}
          defendingHealth={defendingHealth}
          defender={
            structure
              ? `${structure!.name} ${ownArmySide === "Defence" ? "(⚔️)" : ""}`
              : defenderArmies?.length > 0
              ? `Defenders ${ownArmySide === "Defence" ? "(⚔️)" : ""}`
              : "Empty"
          }
        />
        <div className="w-screen bg-brown/80 backdrop-blur-lg h-72 p-6 mb-4">
          <div className="flex flex-row justify-between h-[20vh]">
            <div className="flex flex-row w-[70vw]">
              <div>
                <EntityAvatar show={attackerArmies.length > 0} />
                {defenders.length > 0 && userArmiesAtPosition && userArmiesAtPosition.length > 0 && (
                  <div className="flex w-full">
                    <SelectActiveArmy
                      setSelectedUnit={setSelectedUnit}
                      userAttackingArmies={userArmiesAtPosition}
                      selectedUnit={selectedUnit}
                    />
                    <Button
                      onClick={() => joinBattle(BattleSide.Attack, selectedUnit!)}
                      isLoading={loading}
                      className="size-xs"
                    >
                      Join
                    </Button>
                  </div>
                )}
              </div>
              {showBattleDetails ? (
                <BattleDetails armiesEntityIds={attackers} battleId={battleManager.battleId} />
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
                ownArmyEntityId={ownArmyEntityId}
                defender={undefined}
                structure={structure}
                battle={battleAdjusted}
                isActive={false}
              />
            )}
            <div className="flex flex-row w-[70vw]">
              {showBattleDetails ? (
                <BattleDetails armiesEntityIds={defenders} battleId={battleManager.battleId} />
              ) : (
                <TroopRow troops={battleAdjusted!.defence_army.troops} />
              )}
              <div>
                <EntityAvatar structure={structure} show={defenderArmies.length > 0} />
                {attackers.length > 0 && userArmiesAtPosition && userArmiesAtPosition.length > 0 && (
                  <div className="flex">
                    <SelectActiveArmy
                      setSelectedUnit={setSelectedUnit}
                      userAttackingArmies={userArmiesAtPosition}
                      selectedUnit={selectedUnit}
                    />
                    <Button
                      onClick={() => joinBattle(BattleSide.Defence, selectedUnit!)}
                      isLoading={loading}
                      className="size-xs"
                    >
                      Join
                    </Button>
                  </div>
                )}
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
