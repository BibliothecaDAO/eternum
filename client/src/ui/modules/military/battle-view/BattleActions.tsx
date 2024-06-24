import { BattleType } from "@/dojo/modelManager/types";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { Structure } from "@/hooks/helpers/useStructures";
import { useModal } from "@/hooks/store/useModal";
import useUIStore from "@/hooks/store/useUIStore";
import { ModalContainer } from "@/ui/components/ModalContainer";
import { PillageHistory } from "@/ui/components/military/Battle";
import Button from "@/ui/elements/Button";
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
  isActive,
  ownArmyEntityId,
  defender,
  structure,
  battle,
}: {
  ownArmyEntityId: bigint | undefined;
  defender: ArmyInfo | undefined;
  structure: Structure | undefined;
  battle: ComponentValue<BattleType, unknown> | undefined;
  isActive: boolean;
}) => {
  const [loading, setLoading] = useState<Loading>(Loading.None);
  const setBattleView = useUIStore((state) => state.setBattleView);
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

  const { getArmy } = getArmyByEntityId();

  const ownArmy = useMemo(() => {
    return getArmy(ownArmyEntityId || 0n);
  }, [ownArmyEntityId, battle]);

  const isRealm = useMemo(() => {
    if (!structure) return false;
    return Boolean(getComponentValue(Realm, getEntityIdFromKeys([BigInt(structure.entity_id)])));
  }, [structure]);

  const handleRaid = async () => {
    setLoading(Loading.Raid);
    if (battle?.entity_id! !== 0n && battle?.entity_id === BigInt(ownArmy!.battle_id)) {
      await battle_leave_and_raid({
        signer: account,
        army_id: ownArmy!.entity_id,
        battle_id: battle?.entity_id!,
        structure_id: structure!.entity_id,
      });
    } else {
      await battle_pillage({
        signer: account,
        army_id: ownArmy!.entity_id,
        structure_id: structure!.entity_id,
      });
    }

    setLoading(Loading.None);
    setBattleView(null);
    toggleModal(
      <ModalContainer size="half">
        <PillageHistory
          structureId={BigInt(structure!.entity_id)}
          attackerRealmEntityId={BigInt(ownArmy!.entity_owner_id)}
        />
      </ModalContainer>,
    );
  };

  const handleBattleStart = async () => {
    setLoading(Loading.Start);
    await battle_start({
      signer: account,
      attacking_army_id: ownArmy!.entity_id,
      defending_army_id: defender!.entity_id,
    });
    setLoading(Loading.None);
  };

  const handleBattleClaim = async () => {
    setLoading(Loading.Claim);
    if (battle?.entity_id! !== 0n && battle?.entity_id === BigInt(ownArmy!.battle_id)) {
      await battle_leave_and_claim({
        signer: account,
        army_id: ownArmy!.entity_id,
        battle_id: battle?.entity_id!,
        structure_id: structure!.entity_id,
      });
    } else {
      await battle_claim({
        signer: account,
        army_id: ownArmy!.entity_id,
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
      army_id: ownArmy!.entity_id,
      battle_id: battle?.entity_id!,
    });

    setLoading(Loading.None);
    setBattleView(null);
  };

  const defenceIsEmptyOrDead = !defender || (battle && battle.defence_army_health.current <= 0);

  const isClaimable = Boolean(ownArmy) && !isActive && defenceIsEmptyOrDead && !isRealm && Boolean(structure);

  return (
    <div className="col-span-2 flex justify-center flex-wrap mx-4 w-[100vw]">
      <div className="grid grid-cols-2 gap-3 row-span-2">
        <Button
          variant="primary"
          className="flex flex-col gap-2"
          isLoading={loading === Loading.Raid}
          onClick={handleRaid}
          disabled={loading !== Loading.None || !structure || !ownArmy || isActive}
        >
          <img className="w-10" src="/images/icons/raid.png" alt="coin" />
          Raid!
        </Button>

        <Button
          variant="primary"
          className="flex flex-col gap-2"
          isLoading={loading === Loading.Claim}
          onClick={handleBattleClaim}
          disabled={loading !== Loading.None || !isClaimable}
        >
          <img className="w-10" src="/images/icons/claim.png" alt="coin" />
          Claim
        </Button>

        <Button
          variant="primary"
          className="flex flex-col gap-2"
          isLoading={loading === Loading.Leave}
          onClick={handleLeaveBattle}
          disabled={loading !== Loading.None || !ownArmy || !Boolean(ownArmy.battle_id)}
        >
          <img className="w-10" src="/images/icons/leave-battle.png" alt="coin" />
          Leave Battle
        </Button>

        <Button
          variant="primary"
          className="flex flex-col gap-2"
          isLoading={loading === Loading.Start}
          onClick={handleBattleStart}
          disabled={
            loading !== Loading.None ||
            !ownArmy ||
            Boolean(ownArmy.battle_id) ||
            (!defender && Boolean(structure)) ||
            Boolean(battle)
          }
        >
          <img className="w-10" src="/images/icons/attack.png" alt="coin" />
          Battle
        </Button>
      </div>
    </div>
  );
};
