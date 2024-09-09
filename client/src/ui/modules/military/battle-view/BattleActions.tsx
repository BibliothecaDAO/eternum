import { ClientComponents } from "@/dojo/createClientComponents";
import { BattleManager, RaidStatus } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { Structure } from "@/hooks/helpers/useStructures";
import { useModalStore } from "@/hooks/store/useModalStore";
import useUIStore from "@/hooks/store/useUIStore";
import { PillageHistory } from "@/ui/components/military/PillageHistory";
import { ModalContainer } from "@/ui/components/ModalContainer";
import Button from "@/ui/elements/Button";
import { Headline } from "@/ui/elements/Headline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { ID } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";
import { View } from "../../navigation/LeftNavigationModule";

enum Loading {
  None,
  Claim,
  Raid,
  Start,
  Leave,
}

export const BattleActions = ({
  battleManager,
  userArmiesInBattle,
  isActive,
  ownArmyEntityId,
  attackerArmies,
  defenderArmies,
  structure,
  battleAdjusted,
}: {
  battleManager: BattleManager;
  userArmiesInBattle: (ArmyInfo | undefined)[];
  ownArmyEntityId: ID | undefined;
  attackerArmies: (ArmyInfo | undefined)[];
  defenderArmies: (ArmyInfo | undefined)[];
  structure: Structure | undefined;
  battleAdjusted: ComponentValue<ClientComponents["Battle"]["schema"]> | undefined;
  isActive: boolean;
}) => {
  const dojo = useDojo();
  const {
    account: { account },
    setup: {
      systemCalls: { battle_leave, battle_start, battle_claim, battle_leave_and_claim },
    },
  } = dojo;

  const currentTimestamp = useUIStore((state) => state.nextBlockTimestamp);
  const currentArmiesTick = useUIStore((state) => state.currentArmiesTick);
  const setBattleView = useUIStore((state) => state.setBattleView);
  const setView = useUIStore((state) => state.setLeftNavigationView);

  const [loading, setLoading] = useState<Loading>(Loading.None);
  const [raidWarning, setRaidWarning] = useState(false);

  const { toggleModal } = useModalStore();

  const { getAliveArmy } = getArmyByEntityId();

  const [localSelectedUnit, setLocalSelectedUnit] = useState<ID | undefined>(
    userArmiesInBattle?.[0]?.entity_id || ownArmyEntityId || 0,
  );

  const selectedArmy = useMemo(() => {
    return getAliveArmy(localSelectedUnit || 0);
  }, [localSelectedUnit, isActive]);

  const defenderArmy = useMemo(() => {
    const defender = structure?.protector ? structure.protector : defenderArmies[0];
    const battleManager = new BattleManager(defender?.battle_id || 0, dojo);
    return battleManager.getUpdatedArmy(defender, battleManager.getUpdatedBattle(currentTimestamp!));
  }, [defenderArmies]);

  const handleRaid = async () => {
    if (selectedArmy?.battle_id !== 0 && !raidWarning) {
      setRaidWarning(true);
      return;
    }

    setLoading(Loading.Raid);
    setRaidWarning(false);

    await battleManager.pillageStructure(selectedArmy!, structure!.entity_id);
    setLoading(Loading.None);
    setBattleView(null);
    setView(View.None);
    toggleModal(
      <ModalContainer size="half">
        <Headline>Pillage History</Headline>
        <PillageHistory structureId={structure!.entity_id} />
      </ModalContainer>,
    );
  };

  const handleBattleStart = async () => {
    setLoading(Loading.Start);
    await battle_start({
      signer: account,
      attacking_army_id: selectedArmy!.entity_id,
      defending_army_id: defenderArmy!.entity_id,
    });
    setBattleView({
      engage: false,
      battleEntityId: undefined,
      ownArmyEntityId: undefined,
      targetArmy: defenderArmy?.entity_id,
    });
    setLoading(Loading.None);
  };

  const handleBattleClaim = async () => {
    setLoading(Loading.Claim);
    if (battleAdjusted?.entity_id! !== 0 && battleAdjusted?.entity_id === selectedArmy!.battle_id) {
      await battle_leave_and_claim({
        signer: account,
        army_id: selectedArmy!.entity_id,
        battle_id: battleManager?.battleEntityId || 0,
        structure_id: structure!.entity_id,
      });
    } else {
      await battle_claim({
        signer: account,
        army_id: selectedArmy!.entity_id,
        structure_id: structure!.entity_id,
      });
    }
    setBattleView(null);
    setView(View.None);

    setLoading(Loading.None);
  };

  const handleLeaveBattle = async () => {
    setLoading(Loading.Leave);
    await battle_leave({
      signer: account,
      army_id: selectedArmy!.entity_id,
      battle_id: battleManager?.battleEntityId || 0,
    }).then(() => {
      setLoading(Loading.None);
      setBattleView(null);
      setView(View.None);

      const attackerArmiesLength = attackerArmies.some((army) => army?.entity_id === selectedArmy?.entity_id)
        ? attackerArmies.length - 1
        : attackerArmies.length;
      const defenderArmiesLength = defenderArmies.some((army) => army?.entity_id === selectedArmy?.entity_id)
        ? defenderArmies.length - 1
        : defenderArmies.length;
      if (attackerArmiesLength === 0 && defenderArmiesLength === 0) {
        battleManager.deleteBattle();
      }
    });
  };

  const isClaimable = useMemo(
    () => battleManager.isClaimable(currentTimestamp!, selectedArmy, structure, defenderArmy),
    [battleManager, currentTimestamp, selectedArmy],
  );

  const raidStatus = useMemo(
    () => battleManager.isRaidable(currentTimestamp!, currentArmiesTick, selectedArmy, structure),
    [battleManager, currentTimestamp, selectedArmy],
  );

  const isAttackable = useMemo(() => battleManager.isAttackable(defenderArmy), [battleManager, defenderArmy]);

  const isLeavable = useMemo(
    () => battleManager.isLeavable(currentTimestamp!, selectedArmy),
    [battleManager, selectedArmy],
  );

  return (
    <div className="col-span-2 flex justify-center flex-wrap -bottom-y p-2 bg-[#1b1a1a] bg-hex-bg">
      <div className="grid grid-cols-2 gap-1 w-full">
        <Button
          variant="outline"
          className="flex flex-col gap-2"
          isLoading={loading === Loading.Raid}
          onClick={handleRaid}
          disabled={loading !== Loading.None || raidStatus !== RaidStatus.isRaidable}
        >
          <img className="w-10" src="/images/icons/raid.png" alt="coin" />
          <div className={`text-wrap ${raidWarning ? "text-danger" : ""}`}>
            {raidWarning ? "Leave battle & Raid ?" : "Raid"}
          </div>
        </Button>
        <Button
          variant="outline"
          className="flex flex-col gap-2"
          isLoading={loading === Loading.Claim}
          onClick={handleBattleClaim}
          disabled={loading !== Loading.None || !isClaimable}
        >
          <img className="w-10" src="/images/icons/claim.png" alt="coin" />
          Claim
        </Button>

        <Button
          variant="outline"
          className="flex flex-col gap-2"
          isLoading={loading === Loading.Leave}
          onClick={handleLeaveBattle}
          disabled={loading !== Loading.None || !isLeavable}
        >
          <img className="w-10" src="/images/icons/leave-battle.png" alt="coin" />
          Leave
        </Button>

        <Button
          variant="outline"
          className="flex flex-col gap-2"
          isLoading={loading === Loading.Start}
          onClick={handleBattleStart}
          disabled={!isAttackable}
        >
          <img className="w-10" src="/images/icons/attack.png" alt="coin" />
          Battle
        </Button>
        {battleAdjusted && (
          <ArmySelector
            localSelectedUnit={selectedArmy?.entity_id}
            setLocalSelectedUnit={setLocalSelectedUnit}
            userArmiesInBattle={userArmiesInBattle}
          />
        )}
      </div>
    </div>
  );
};

const ArmySelector = ({
  localSelectedUnit,
  setLocalSelectedUnit,
  userArmiesInBattle,
}: {
  localSelectedUnit: ID | undefined;
  setLocalSelectedUnit: (val: ID) => void;
  userArmiesInBattle: (ArmyInfo | undefined)[];
}) => {
  return (
    userArmiesInBattle &&
    userArmiesInBattle.length > 0 && (
      <div className="self-center w-full flex flex-col justify-between bg-transparent size-xs col-span-2 text-gold text-center border border-gold rounded h-10 font-bold text-xl">
        <Select
          onValueChange={(a: string) => {
            setLocalSelectedUnit(Number(a));
          }}
        >
          <SelectTrigger className="text-gold h-10 text-lg">
            <SelectValue
              placeholder={
                userArmiesInBattle.find((army) => localSelectedUnit === army?.entity_id || 0n)?.name || "Select army"
              }
            />
          </SelectTrigger>
          <SelectContent className="text-gold w-full">
            {userArmiesInBattle.map((army, index) => (
              <SelectItem
                className="flex justify-center self-center text-sm pl-0 w-full text-center"
                key={index}
                value={army?.entity_id?.toString() || ""}
              >
                <h5 className="gap-4 text-gold w-full max-w-full mr-2">{army?.name}</h5>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );
};
