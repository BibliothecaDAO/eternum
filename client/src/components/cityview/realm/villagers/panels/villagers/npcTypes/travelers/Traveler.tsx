import { useState } from "react";
import { useDojo } from "../../../../../../../../DojoContext";
import { HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import useRealmStore from "../../../../../../../../hooks/store/useRealmStore";
import useBlockchainStore from "../../../../../../../../hooks/store/useBlockchainStore";
import { OrderIcon } from "../../../../../../../../elements/OrderIcon";
import Button from "../../../../../../../../elements/Button";
import { useArrivalTimeByEntityId } from "../../../../utils";
import { getRealmIdByPosition, getRealmNameById, getRealmOrderNameById } from "../../../../../../../../utils/realms";
import { formatSecondsLeftInDaysHours } from "../../../../../labor/laborUtils";
import { Npc } from "../../../../types";
import { NpcComponent } from "../../../../NpcComponent";
import { ReactComponent as ArrowSquare } from "../../../../../../../../assets/icons/npc/arrow_in.svg";
import clsx from "clsx";

type NpcComponentProps = {
  npc: Npc;
  setSelectedNpc: (state: Npc | undefined) => void;
};

export const Traveler = ({ npc, setSelectedNpc }: NpcComponentProps) => {
  const {
    setup: {
      components: { ArrivalTime, Position },
      systemCalls: { npc_travel },
    },
    account: { account },
  } = useDojo();

  const [loading, setLoading] = useState(false);

  const { realmEntityId } = useRealmStore();
  const { nextBlockTimestamp } = useBlockchainStore();

  const arrivalTime = useArrivalTimeByEntityId(npc.entityId, ArrivalTime);

  const getNpcTravelInfo = () => {
    const npcPositionEntityId = runQuery([HasValue(Position, { entity_id: BigInt(npc.entityId.toString()) })]);
    const npcPosition = getComponentValue(Position, npcPositionEntityId.values().next().value);

    const destinationRealmId = getRealmIdByPosition(npcPosition!);
    const destinationRealmName = getRealmNameById(destinationRealmId!);
    const orderName = getRealmOrderNameById(destinationRealmId!);

    const npcArrivalTimeEntityId = runQuery([HasValue(ArrivalTime, { entity_id: BigInt(npc.entityId.toString()) })]);
    const npcArrivalTime = getComponentValue(ArrivalTime, npcArrivalTimeEntityId.values().next().value);

    const alreadyArrived = npcArrivalTime!.arrives_at < nextBlockTimestamp!;

    const travelingStatus =
      npc.currentRealmEntityId != 0 ? "Currently in" : alreadyArrived ? "At the gates of" : "Traveling to";

    const travelingDurationStatus = alreadyArrived ? "Has been there for: " : "Arrives in:";

    const timeLeftForTravelOrSpentInRealm = formatSecondsLeftInDaysHours(
      alreadyArrived
        ? nextBlockTimestamp! - npcArrivalTime!.arrives_at
        : npcArrivalTime!.arrives_at - nextBlockTimestamp!,
    );

    return (
      <>
        <div className="flex items-center ml-2 -mt-2 italic">
          <span>{travelingStatus}:</span>
          <OrderIcon className="mx-1" order={orderName} size="xs" />
          <span className="text-gold">{destinationRealmName}</span>
        </div>
        <div className="flex ml-auto -mt-2 italic">
          <span>{travelingDurationStatus}</span>{" "}
          <span className="ml-1 text-gold">{timeLeftForTravelOrSpentInRealm}</span>
        </div>
      </>
    );
  };

  const bringBack = (): void => {
    if (npc.entityId) {
      setLoading(true);
      npc_travel({
        signer: account,
        npc_entity_id: npc.entityId,
        to_realm_entity_id: realmEntityId!,
      });
      setLoading(false);
      setSelectedNpc(undefined);
    }
  };

  const isDisabled = arrivalTime > nextBlockTimestamp!;
  const extraButtons: any = [
    <Button
      key="bringBackButton"
      disabled={isDisabled}
      isLoading={loading}
      size="md"
      className="ml-auto h-6"
      onClick={bringBack}
      variant="outline"
      withoutSound
    >
      <ArrowSquare className={clsx("mr-1", isDisabled && "fill-gray-gold", !isDisabled && "fill-gold")} />
      {`Bring back`}
    </Button>,
  ];
  return (
    <>
      <NpcComponent
        npc={npc}
        setSelectedNpc={setSelectedNpc}
        getDisplayedInfo={getNpcTravelInfo()}
        extraButtons={extraButtons}
      />
    </>
  );
};
