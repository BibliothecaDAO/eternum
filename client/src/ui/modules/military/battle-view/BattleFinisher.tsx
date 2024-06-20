import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, getArmiesByBattleId, getUserArmiesAtPosition } from "@/hooks/helpers/useArmies";
import { Realm, Structure } from "@/hooks/helpers/useStructures";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { BattleSide } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
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
  attackerArmy,
  attackerArmyHealth,
  defenderArmy,
  defenderArmyHealth,
  structure,
}: {
  battleManager: BattleManager;
  attackerArmy: ArmyInfo | undefined;
  attackerArmyHealth: bigint;
  defenderArmy: ArmyInfo | undefined;
  defenderArmyHealth: bigint;
  structure: Structure | Realm | undefined;
}) => {
  const {
    setup: {
      account: { account },
      systemCalls: { battle_join },
      components: { Position },
    },
  } = useDojo();

  const selectedEntity = useUIStore((state) => state.selectedEntity);

  const battlePosition = getComponentValue(Position, getEntityIdFromKeys([battleManager.battleId]));
  const { userArmies } = getUserArmiesAtPosition(battlePosition!);
  console.log(userArmies);
  const ownArmyEntityId = useMemo(() => {
    if (attackerArmy?.isMine) return BigInt(attackerArmy.entity_id);
    if (selectedEntity) return selectedEntity.id;
  }, [selectedEntity]);

  const [loading, setLoading] = useState<boolean>(false);
  const [showBattleDetails, setShowBattleDetails] = useState<boolean>(false);
  const [selectedUnit, setSelectedUnit] = useState<bigint | undefined>(ownArmyEntityId);

  const armiesInBattle = getArmiesByBattleId(battleManager.battleId);
  const userArmyInBattle = armiesInBattle.find((army) => army.isMine);

  const attackers = armiesInBattle
    .filter((army) => String(army.battle_side) === "Attack")
    .map((army) => BigInt(army.entity_id));
  const defenders = armiesInBattle
    .filter((army) => String(army.battle_side) === "Defence")
    .map((army) => BigInt(army.entity_id));

  const currentDefaultTick = useBlockchainStore((state) => state.currentDefaultTick);
  const setBattleView = useUIStore((state) => state.setBattleView);
  const attackingHealth = attackerArmy
    ? { current: Number(attackerArmyHealth), lifetime: Number(attackerArmy.lifetime) }
    : undefined;
  const defendingHealth = defenderArmy
    ? { current: Number(defenderArmyHealth), lifetime: Number(defenderArmy.lifetime) }
    : undefined;

  const battleAdjusted = useMemo(() => {
    return battleManager.getUpdatedBattle(currentDefaultTick);
  }, [currentDefaultTick]);

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
          attacker={`${attackerArmy ? "Attackers" : "Empty"} ${attackerArmy?.isMine ? "(⚔️)" : ""}`}
          defendingHealth={defendingHealth}
          defender={
            structure
              ? `${structure!.name} ${String(userArmyInBattle?.battle_side || "") === "Defence" ? "(⚔️)" : ""}`
              : defenderArmy
              ? `Defenders ${String(userArmyInBattle?.battle_side || "") === "Defence" ? "(⚔️)" : ""}`
              : "Empty"
          }
        />
        <div className="w-screen bg-brown/80 backdrop-blur-lg h-72 p-6 mb-4">
          <div className="flex flex-row justify-between h-[20vh]">
            <div className="flex flex-row w-[70vw]">
              <div>
                <EntityAvatar empty={!Boolean(attackerArmy)} />
                {userArmies && userArmies.length > 0 && (
                  <div className="flex w-full">
                    <SelectActiveArmy
                      setSelectedUnit={setSelectedUnit}
                      userAttackingArmies={userArmies}
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
                <EntityAvatar structure={structure} empty={!Boolean(defenderArmy)} />
                {userArmies && userArmies.length > 0 && (
                  <div className="flex">
                    <SelectActiveArmy
                      setSelectedUnit={setSelectedUnit}
                      userAttackingArmies={userArmies}
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
