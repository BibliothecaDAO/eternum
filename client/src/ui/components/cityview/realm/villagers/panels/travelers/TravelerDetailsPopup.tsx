import { useState } from "react";
import { SecondaryPopup } from "../../../../../../elements/SecondaryPopup";
import Button from "../../../../../../elements/Button";
import { useDojo } from "../../../../../../DojoContext";
import { Entity, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "../../../../../../utils/utils";
import { Headline } from "../../../../../../elements/Headline";
import { Npc } from "../../types";
import { getRealmIdByPosition, getRealmNameById } from "../../../../../../utils/realms";
import useBlockchainStore from "../../../../../../hooks/store/useBlockchainStore";
import { formatSecondsLeftInDaysHours } from "../../../labor/laborUtils";

type TravelerDetailsPopupProps = {
  npc: Npc;
  onClose: () => void;
};

export const TravelerDetailsPopup = ({ npc, onClose }: TravelerDetailsPopupProps) => {
  const {
    setup: {
      components: { Position, ArrivalTime },
    },
  } = useDojo();

  const { nextBlockTimestamp } = useBlockchainStore();

  const getDisplayedInfo = () => {
    const npcPositionEntityId = runQuery([HasValue(Position, { entity_id: BigInt(npc.entityId.toString()) })]);
    const npcPosition = getComponentValue(Position, npcPositionEntityId.values().next().value);

    const destinationRealmId = getRealmIdByPosition(npcPosition!);
    const destinationRealmName = getRealmNameById(destinationRealmId!);

    const npcArrivalTimeEntityId = runQuery([HasValue(ArrivalTime, { entity_id: BigInt(npc.entityId.toString()) })]);
    const npcArrivalTime = getComponentValue(ArrivalTime, npcArrivalTimeEntityId.values().next().value);

    const alreadyArrived = npcArrivalTime!.arrives_at < nextBlockTimestamp!;

    const travelingStatus =
      npc.currentRealmEntityId != 0 ? "Currently in" : alreadyArrived ? "At the gates of" : "Traveling to";

    const travelingDurationStatus = alreadyArrived ? "Has been there for: " : "Time left to destination:";

    const timeLeftForTravelOrSpentInRealm = formatSecondsLeftInDaysHours(
      alreadyArrived
        ? nextBlockTimestamp! - npcArrivalTime!.arrives_at
        : npcArrivalTime!.arrives_at - nextBlockTimestamp!,
    );

    return (
      <>
        <p>
          <span>{travelingStatus}:</span> <span className="text-white">{destinationRealmName}</span>{" "}
        </p>
        <p>
          <span>{travelingDurationStatus}</span> <span className="text-white">{timeLeftForTravelOrSpentInRealm}</span>{" "}
        </p>
      </>
    );
  };

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">{npc.fullName}</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body height={"340px"}>
        <div className="flex flex-col items-center p-2">
          <Headline className="mb-3">Traveler</Headline>
          <div className="flex flex-col text-gold text-xxs w-1/2">{getDisplayedInfo()}</div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
