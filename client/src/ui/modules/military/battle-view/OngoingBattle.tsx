import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Realm, Structure } from "@/hooks/helpers/useStructures";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { BattleSide } from "@bibliothecadao/eternum";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { BattleActions } from "./BattleActions";
import { BattleDetails } from "./BattleDetails";
import { BattleProgressBar } from "./BattleProgressBar";
import { EntityAvatar } from "./EntityAvatar";
import { LockedResources } from "./LockedResources";
import { TroopRow } from "./Troops";

export const OngoingBattle = ({
  battleManager,
  structure,
  ownArmyEntityId,
  armiesInBattle,
  userArmiesAtPosition,
}: {
  battleManager: BattleManager;
  structure: Structure | Realm | undefined;
  ownArmyEntityId: bigint | undefined;
  armiesInBattle: ArmyInfo[];
  userArmiesAtPosition: ArmyInfo[];
}) => {
  const {
    account: { account },
    setup: {
      systemCalls: { battle_join },
    },
  } = useDojo();
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedUnit, setSelectedUnit] = useState<bigint | undefined>(ownArmyEntityId);
  const [showBattleDetails, setShowBattleDetails] = useState<boolean>(false);

  const currentTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const userArmiesInBattle = armiesInBattle.filter((army) => army.isMine);
  const ownArmySide = String(userArmiesInBattle[0]?.battle_side || "");

  const attackerArmies = armiesInBattle.filter((army) => String(army.battle_side) === "Attack");
  const defenderArmies = armiesInBattle.filter((army) => String(army.battle_side) === "Defence");

  const attackers = attackerArmies.map((army) => BigInt(army.entity_id));
  const defenders = defenderArmies.map((army) => BigInt(army.entity_id));

  const battleAdjusted = useMemo(() => {
    return battleManager.getUpdatedBattle(currentTimestamp!);
  }, [currentTimestamp]);

  const durationLeft = useMemo(() => {
    return battleManager.getTimeLeft(currentTimestamp!);
  }, [battleAdjusted?.duration_left]);

  const setBattleView = useUIStore((state) => state.setBattleView);

  const attackingHealth = {
    current: Number(battleAdjusted!.attack_army_health.current),
    lifetime: Number(battleAdjusted!.attack_army_health.lifetime),
  };
  const defendingHealth = {
    current: Number(battleAdjusted!.defence_army_health.current),
    lifetime: Number(battleAdjusted!.defence_army_health.lifetime),
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
          attacker={`Attackers ${ownArmySide === "Attack" ? "(⚔️)" : ""}`}
          defendingHealth={defendingHealth}
          defender={`Defenders ${ownArmySide === "Defence" ? "(⚔️)" : ""}`}
          durationLeft={durationLeft}
        />
        <div className="w-screen bg-brown/80 backdrop-blur-lg h-72 p-6 mb-4">
          <div className="flex flex-row justify-between h-[20vh]">
            <div className="flex flex-row w-[70vw]">
              <div>
                <EntityAvatar />
                {userArmiesAtPosition && userArmiesAtPosition.length > 0 && (
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
                ownArmyEntityId={selectedUnit}
                defender={undefined}
                structure={structure}
                battle={battleAdjusted}
                isActive
              />
            )}
            <div className="flex flex-row w-[70vw]">
              {showBattleDetails ? (
                <BattleDetails armiesEntityIds={defenders} battleId={battleManager.battleId} />
              ) : (
                <TroopRow troops={battleAdjusted!.defence_army.troops} defending />
              )}
              <div className="">
                <EntityAvatar structure={structure} />
                {userArmiesAtPosition && userArmiesAtPosition.length > 0 && (
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
            <Button onClick={() => setShowBattleDetails(!showBattleDetails)}>{`${
              !showBattleDetails ? "Details" : "Close"
            }`}</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const SelectActiveArmy = ({
  selectedUnit,
  setSelectedUnit,
  userAttackingArmies,
}: {
  selectedUnit: bigint | undefined;
  setSelectedUnit: (val: any) => void;
  userAttackingArmies: ArmyInfo[];
}) => {
  return (
    <div className="self-center flex flex-col justify-between bg-gold clip-angled size-xs mb-1 mr-1">
      <Select
        value={""}
        onValueChange={(a: string) => {
          setSelectedUnit(BigInt(a));
        }}
      >
        <SelectTrigger className="">
          <SelectValue
            placeholder={
              userAttackingArmies.find((army) => selectedUnit === BigInt(army.entity_id))?.name || "Select army"
            }
          />
        </SelectTrigger>
        <SelectContent className="bg-brown text-gold">
          {userAttackingArmies.map((army, index) => (
            <SelectItem className="flex justify-between text-sm" key={index} value={army.entity_id?.toString() || ""}>
              <h5 className="self-center flex gap-4">{army.name}</h5>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
