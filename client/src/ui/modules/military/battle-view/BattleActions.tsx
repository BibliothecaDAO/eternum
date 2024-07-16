import { ClientComponents } from "@/dojo/createClientComponents";
import { useDojo } from "@/hooks/context/DojoContext";
import { armyHasLost } from "@/hooks/helpers/battles/useBattlesUtils";
import { ArmyInfo, getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { Structure } from "@/hooks/helpers/useStructures";
import { useModal } from "@/hooks/store/useModal";
import useUIStore from "@/hooks/store/useUIStore";
import { ModalContainer } from "@/ui/components/ModalContainer";
import { PillageHistory } from "@/ui/components/military/Battle";
import Button from "@/ui/elements/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo, useState } from "react";

enum Loading {
  None,
  Claim,
  Raid,
  Start,
  Leave,
}

export const BattleActions = ({
  userArmiesInBattle,
  userArmiesAtPosition,
  isActive,
  ownArmyEntityId,
  defender,
  structure,
  battle,
}: {
  userArmiesInBattle: ArmyInfo[] | undefined;
  userArmiesAtPosition: ArmyInfo[] | undefined;
  ownArmyEntityId: bigint | undefined;
  defender: ArmyInfo | undefined;
  structure: Structure | undefined;
  battle: ComponentValue<ClientComponents["Battle"]["schema"]> | undefined;
  isActive: boolean;
}) => {
  const [localSelectedUnit, setLocalSelectedUnit] = useState<bigint | undefined>(
    ownArmyEntityId || BigInt(userArmiesAtPosition?.[0]?.entity_id || 0),
  );
  const [loading, setLoading] = useState<Loading>(Loading.None);

  const setBattleView = useUIStore((state) => state.setBattleView);
  const clearSelection = useUIStore((state) => state.clearSelection);
  const { toggleModal } = useModal();

  const {
    account: { account },
    setup: {
      systemCalls: {
        battle_leave,
        battle_start,
        battle_claim,
        battle_pillage,
        battle_leave_and_claim,
        battle_leave_and_raid,
      },
      components: { Realm },
    },
  } = useDojo();

  const { getAliveArmy } = getArmyByEntityId();

  const selectedArmy = useMemo(() => {
    return getAliveArmy(localSelectedUnit || 0n);
  }, [localSelectedUnit, battle]);

  const isRealm = useMemo(() => {
    if (!structure) return false;
    return Boolean(getComponentValue(Realm, getEntityIdFromKeys([BigInt(structure.entity_id)])));
  }, [structure]);

  const handleRaid = async () => {
    setLoading(Loading.Raid);
    if (battle?.entity_id! !== 0n && battle?.entity_id === BigInt(selectedArmy!.battle_id)) {
      await battle_leave_and_raid({
        signer: account,
        army_id: selectedArmy!.entity_id,
        battle_id: battle?.entity_id!,
        structure_id: structure!.entity_id,
      });
    } else {
      await battle_pillage({
        signer: account,
        army_id: selectedArmy!.entity_id,
        structure_id: structure!.entity_id,
      });
    }

    setLoading(Loading.None);
    setBattleView(null);
    toggleModal(
      <ModalContainer size="half">
        <PillageHistory
          structureId={BigInt(structure!.entity_id)}
          attackerRealmEntityId={BigInt(selectedArmy!.entityOwner.entity_owner_id)}
        />
      </ModalContainer>,
    );
  };

  const handleBattleStart = async () => {
    setLoading(Loading.Start);
    await battle_start({
      signer: account,
      attacking_army_id: selectedArmy!.entity_id,
      defending_army_id: defender!.entity_id,
    });
    setLoading(Loading.None);
    setBattleView({
      battle: { x: Number(selectedArmy!.position.x), y: Number(selectedArmy!.position.y) },
      target: undefined,
    });
    clearSelection();
  };

  const handleBattleClaim = async () => {
    setLoading(Loading.Claim);
    if (battle?.entity_id! !== 0n && battle?.entity_id === BigInt(selectedArmy!.battle_id)) {
      await battle_leave_and_claim({
        signer: account,
        army_id: selectedArmy!.entity_id,
        battle_id: battle?.entity_id!,
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

    setLoading(Loading.None);
  };

  const handleLeaveBattle = async () => {
    setLoading(Loading.Leave);
    await battle_leave({
      signer: account,
      army_id: selectedArmy!.entity_id,
      battle_id: battle?.entity_id!,
    });

    setLoading(Loading.None);
    setBattleView(null);
  };

  const defenceIsEmptyOrDead =
    !defender || checkIfArmyLostAFinishedBattle(battle, defender, isActive) || !checkIfArmyAlive(defender);

  const isClaimable =
    Boolean(selectedArmy) && defenceIsEmptyOrDead && Boolean(structure) && !isRealm && !structure!.isMine;

  const isAttackable =
    loading === Loading.None &&
    selectedArmy &&
    BigInt(selectedArmy?.battle_id || 1) &&
    defender &&
    checkIfArmyAlive(defender) &&
    !Boolean(battle);

  return (
    <div className="col-span-2 flex justify-center flex-wrap -bottom-y p-2 bg-[#1b1a1a] bg-map">
      <div className="grid grid-cols-2 gap-1 w-full">
        <Button
          variant="outline"
          className="flex flex-col gap-2"
          isLoading={loading === Loading.Raid}
          onClick={handleRaid}
          disabled={
            loading !== Loading.None ||
            !structure ||
            !selectedArmy ||
            isActive ||
            structure?.isMine ||
            structure.isMercenary
          }
        >
          <img className="w-10" src="/images/icons/raid.png" alt="coin" />
          Raid!
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
          disabled={
            loading !== Loading.None ||
            !selectedArmy ||
            !Boolean(selectedArmy.battle_id) ||
            (isActive && selectedArmy.protectee !== undefined)
          }
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
        {battle && (
          <ArmySelector
            localSelectedUnit={localSelectedUnit}
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
  localSelectedUnit: bigint | undefined;
  setLocalSelectedUnit: (val: bigint) => void;
  userArmiesInBattle: ArmyInfo[] | undefined;
}) => {
  return (
    userArmiesInBattle &&
    userArmiesInBattle.length > 0 && (
      <div className="self-center w-full flex flex-col justify-between bg-transparent size-xs col-span-2 text-gold text-center border border-gold rounded">
        <Select
          onValueChange={(a: string) => {
            setLocalSelectedUnit(BigInt(a));
          }}
        >
          <SelectTrigger className="text-gold">
            <SelectValue
              placeholder={
                userArmiesInBattle.find((army) => localSelectedUnit === BigInt(army.entity_id))?.name || "Select army"
              }
            />
          </SelectTrigger>
          <SelectContent className="text-gold w-full">
            {userArmiesInBattle.map((army, index) => (
              <SelectItem
                className="flex justify-center self-center text-sm pl-0 w-full"
                key={index}
                value={army.entity_id?.toString() || ""}
              >
                <h5 className="gap-4 text-gold w-full max-w-full">{army.name}</h5>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );
};

const checkIfArmyLostAFinishedBattle = (battle: any, army: any, isActive: boolean) => {
  if (battle && armyHasLost(army, battle!) && !isActive) {
    return true;
  }
  return false;
};

const checkIfArmyAlive = (army: ArmyInfo) => {
  return BigInt(army.health.current) > 0;
};
