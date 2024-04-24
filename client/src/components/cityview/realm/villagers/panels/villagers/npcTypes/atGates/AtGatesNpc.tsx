import { Npc } from "../../../../types";
import Button from "../../../../../../../../elements/Button";
import { useState } from "react";
import { NpcComponent } from "../../../../NpcComponent";
import { useDojo } from "../../../../../../../../DojoContext";
import useRealmStore from "../../../../../../../../hooks/store/useRealmStore";
import { HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getRealmNameById, getRealmOrderNameById } from "../../../../../../../../utils/realms";
import { OrderIcon } from "../../../../../../../../elements/OrderIcon";
import { formatSecondsLeftInDaysHours } from "../../../../../labor/laborUtils";
import useBlockchainStore from "../../../../../../../../hooks/store/useBlockchainStore";
import { ReactComponent as ArrowSquare } from "../../../../../../../../assets/icons/npc/arrow_in.svg";

type NpcComponentProps = {
  npc: Npc;
  setSelectedNpc: (state: Npc) => void;
};

export const AtGatesNpc = ({ npc, setSelectedNpc }: NpcComponentProps) => {
  const {
    setup: {
      components: { ArrivalTime, EntityOwner, Realm },
      systemCalls: { welcome_npc },
    },
    account: { account },
  } = useDojo();

  const [loading, setLoading] = useState(false);
  const { realmEntityId } = useRealmStore();
  const { nextBlockTimestamp } = useBlockchainStore();

  const getNpcGatesInfo = () => {
    const npcOriginRealmEntity = runQuery([HasValue(EntityOwner, { entity_id: BigInt(npc.entityId.toString()) })]);
    const npcOriginRealm = getComponentValue(EntityOwner, npcOriginRealmEntity.values().next().value);

    const realmEntity = runQuery([HasValue(Realm, { entity_id: BigInt(npcOriginRealm!.entity_owner_id.toString()) })]);
    const realmId = getComponentValue(Realm, realmEntity.values().next().value);
    const orderName = getRealmOrderNameById(realmId!.realm_id);
    const realmName = getRealmNameById(realmId!.realm_id);

    let timeLeftForTravelOrSpentInRealm = "";

    const npcArrivalTimeEntityId = runQuery([HasValue(ArrivalTime, { entity_id: BigInt(npc.entityId.toString()) })]);
    const npcArrivalTime = getComponentValue(ArrivalTime, npcArrivalTimeEntityId.values().next().value);

    timeLeftForTravelOrSpentInRealm = formatSecondsLeftInDaysHours(nextBlockTimestamp! - npcArrivalTime!.arrives_at);

    return (
      <>
        <div className="flex items-center ml-2 -mt-2 italic">
          <span>From:</span>
          <OrderIcon className="mx-1" order={orderName} size="xs" />
          <span className="text-gold">{realmName}</span>
        </div>

        <div className="flex ml-auto -mt-2 italic">
          <span>Has been there for: </span> <span className="ml-1 text-gold">{timeLeftForTravelOrSpentInRealm}</span>
        </div>
      </>
    );
  };

  const welcomeIn = (): void => {
    if (npc.entityId) {
      setLoading(true);
      welcome_npc({ npc_entity_id: npc.entityId!, into_realm_entity_id: realmEntityId!, signer: account });
      setLoading(false);
    }
  };

  const extraButtons: any = [
    <Button size="md" isLoading={loading} className="ml-auto h-6" onClick={welcomeIn} variant="outline" withoutSound>
      <ArrowSquare className="mr-1 fill-gold" />
      {`Welcome in`}
    </Button>,
  ];
  return (
    <NpcComponent
      npc={npc}
      setSelectedNpc={setSelectedNpc}
      getDisplayedInfo={getNpcGatesInfo()}
      extraButtons={extraButtons}
    />
  );
};
