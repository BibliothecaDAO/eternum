import { Npc } from "../../../../types";
import Button from "../../../../../../../../elements/Button";
import { useState } from "react";
import { TravelNpcPopup } from "./TravelNpcPopup";
import { NpcComponent } from "../../../../NpcComponent";
import { useDojo } from "../../../../../../../../DojoContext";
import { HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getRealmNameById, getRealmOrderNameById } from "../../../../../../../../utils/realms";
import { OrderIcon } from "../../../../../../../../elements/OrderIcon";
import { formatSecondsLeftInDaysHours } from "../../../../../labor/laborUtils";
import useBlockchainStore from "../../../../../../../../hooks/store/useBlockchainStore";
import { ReactComponent as ArrowSquare } from "../../../../../../../../assets/icons/npc/arrow_out.svg";

type NpcComponentProps = {
  npc: Npc;
  native: boolean;
  setSelectedNpc: (state: Npc) => void;
};

export const Resident = ({ npc, native, setSelectedNpc }: NpcComponentProps) => {
  const {
    setup: {
      components: { EntityOwner, Realm, ArrivalTime },
      systemCalls: { kick_out_npc },
    },
    account: { account },
  } = useDojo();

  const [loading, setLoading] = useState(false);

  const { nextBlockTimestamp } = useBlockchainStore();
  const [showTravel, setShowTravel] = useState(false);

  const getNpcResidencyInfo = () => {
    const npcOriginRealmEntity = runQuery([HasValue(EntityOwner, { entity_id: BigInt(npc.entityId.toString()) })]);
    const npcOriginRealm = getComponentValue(EntityOwner, npcOriginRealmEntity.values().next().value);

    let orderName = "";
    let realmName = "";
    if (npcOriginRealm) {
      const realmEntity = runQuery([
        HasValue(Realm, { entity_id: BigInt(npcOriginRealm!.entity_owner_id.toString()) }),
      ]);
      const realmId = getComponentValue(Realm, realmEntity.values().next().value);
      orderName = getRealmOrderNameById(realmId!.realm_id);
      realmName = getRealmNameById(realmId!.realm_id);
    }

    let timeLeftForTravelOrSpentInRealm = "";
    if (!native) {
      const npcArrivalTimeEntityId = runQuery([HasValue(ArrivalTime, { entity_id: BigInt(npc.entityId.toString()) })]);
      const npcArrivalTime = getComponentValue(ArrivalTime, npcArrivalTimeEntityId.values().next().value);

      if (npcArrivalTime) {
        timeLeftForTravelOrSpentInRealm = formatSecondsLeftInDaysHours(
          nextBlockTimestamp! - npcArrivalTime!.arrives_at,
        );
      }
    }
    return (
      <>
        <div className="flex items-center ml-2 -mt-2 italic text-xxs">
          <span>From:</span>
          <OrderIcon className="mx-1" order={orderName} size="xs" />
          <span className="text-gold">{realmName}</span>
        </div>
        {!native && (
          <div className="flex ml-auto -mt-2 italic">
            <span>Has been there for: </span> <span className="ml-1 text-gold">{timeLeftForTravelOrSpentInRealm}</span>
          </div>
        )}
      </>
    );
  };

  const onClose = (): void => {
    setShowTravel(false);
  };

  const kickOut = (): void => {
    if (npc.entityId) {
      setLoading(true);
      kick_out_npc({ signer: account, npc_entity_id: npc.entityId });
      setLoading(false);
    }
  };

  const extraButtons: any = [
    native ? (
      <Button
        key="travelButton"
        isLoading={loading}
        size="md"
        className="ml-auto h-6"
        onClick={() => {
          setShowTravel(true);
        }}
        variant="outline"
        withoutSound
      >
        <ArrowSquare className="h-3 mr-1 fill-gold" />
        {`Travel`}
      </Button>
    ) : (
      <Button isLoading={loading} size="xs" className="ml-auto" onClick={kickOut} variant="outline" withoutSound>
        {`Kick Out`}
      </Button>
    ),
  ];
  return (
    <>
      {showTravel && <TravelNpcPopup npc={npc} onClose={onClose} />}
      <NpcComponent
        setSelectedNpc={setSelectedNpc}
        npc={npc}
        getDisplayedInfo={getNpcResidencyInfo()}
        extraButtons={extraButtons}
      />
    </>
  );
};
