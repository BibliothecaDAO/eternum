import { useState } from "react";
import Button from "../../../../../../elements/Button";
import { useArrivalTimeByEntityId } from "../../utils";
import { ReactComponent as ArrowIn } from "../../../../../../../assets/icons/npc/arrow_in.svg";
import { ReactComponent as ArrowOut } from "../../../../../../../assets/icons/npc/arrow_out.svg";
import clsx from "clsx";
import { Villager, VillagerType } from "../../types";
import { useDojo } from "@/hooks/context/DojoContext";
import useRealmStore from "@/hooks/store/useRealmStore";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useNpcStore from "@/hooks/store/useNpcStore";

type VillagerButtonsProps = {
  villager: Villager;
};

export const ButtonFromVillagerType = ({ villager }: VillagerButtonsProps) => {
  const {
    setup: {
      components: { ArrivalTime },
      systemCalls: { npc_travel, kick_out_npc, welcome_npc },
    },
    account: { account },
  } = useDojo();

  const { setNpcInTravelPopup } = useNpcStore();
  const [loading, setLoading] = useState(false);

  const { realmEntityId } = useRealmStore();
  const { nextBlockTimestamp } = useBlockchainStore();

  const getButtonsByType = () => {
    switch (villager.type) {
      case VillagerType.Traveler:
        return buttonTraveler;
      case VillagerType.Resident:
        return buttonResident;
      case VillagerType.AtGates:
        return buttonGates;
      default:
        return [<></>];
    }
  };

  const bringBack = (): void => {
    if (villager.npc.entityId) {
      setLoading(true);
      npc_travel({
        signer: account,
        npc_entity_id: villager.npc.entityId,
        to_realm_entity_id: realmEntityId!,
      });
      setLoading(false);
    }
  };

  const kickOut = (): void => {
    if (villager.npc.entityId) {
      setLoading(true);
      kick_out_npc({ signer: account, npc_entity_id: villager.npc.entityId });
      setLoading(false);
    }
  };

  const welcomeIn = (): void => {
    if (villager.npc.entityId) {
      setLoading(true);
      welcome_npc({ npc_entity_id: villager.npc.entityId!, into_realm_entity_id: realmEntityId!, signer: account });
      setLoading(false);
    }
  };

  const isDisabled =
    villager.type === VillagerType.Traveler
      ? useArrivalTimeByEntityId(villager.npc.entityId, ArrivalTime) > nextBlockTimestamp!
      : true;
  const buttonTraveler = (
    <Button
      key="bringBack"
      disabled={isDisabled}
      isLoading={loading}
      size="md"
      className="ml-auto h-6"
      onClick={bringBack}
      variant="outline"
      withoutSound
    >
      <ArrowIn className={clsx("h-3", "mr-1", isDisabled && "fill-gray-gold", !isDisabled && "fill-gold")} />
      {`Bring back`}
    </Button>
  );

  const buttonResident = villager.native ? (
    <Button
      key="travel"
      isLoading={loading}
      size="md"
      className="ml-auto h-6"
      onClick={() => {
        setNpcInTravelPopup(villager.npc);
      }}
      variant="outline"
      withoutSound
    >
      <ArrowOut className="h-3 mr-1 fill-gold" />
      {`Travel`}
    </Button>
  ) : (
    <Button isLoading={loading} size="xs" className="ml-auto" onClick={kickOut} variant="outline" withoutSound>
      {`Kick Out`}
    </Button>
  );

  const buttonGates = (
    <Button
      key="welcomeIn"
      size="md"
      isLoading={loading}
      className="ml-auto h-6"
      onClick={welcomeIn}
      variant="outline"
      withoutSound
    >
      <ArrowIn className="mr-1 fill-gold" />
      {`Welcome in`}
    </Button>
  );
  return getButtonsByType();
};
