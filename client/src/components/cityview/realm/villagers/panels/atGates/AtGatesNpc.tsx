import { Npc } from "../../types";
import Button from "../../../../../../elements/Button";
import { useState } from "react";
import { NpcComponent } from "../../NpcComponent";
import { useDojo } from "../../../../../../DojoContext";
import useRealmStore from "../../../../../../hooks/store/useRealmStore";
type NpcComponentProps = {
  npc: Npc;
  native: boolean;
};

export const AtGatesNpc = ({ npc, native }: NpcComponentProps) => {
  const [loading, setLoading] = useState(false);
  const {
    setup: {
      systemCalls: { npc_travel, welcome_npc },
    },
    account: { account },
  } = useDojo();

  const { realmEntityId } = useRealmStore();

  const welcomeIn = (): void => {
    if (npc.entityId) {
      setLoading(true);
      welcome_npc({ npc_entity_id: npc.entityId!, into_realm_entity_id: realmEntityId!, signer: account });
      setLoading(false);
    }
  };

  const kickOut = (): void => {
    if (npc.entityId) {
      setLoading(true);
      npc_travel({
        signer: account,
        npc_entity_id: npc.entityId,
        to_realm_entity_id: realmEntityId!,
      });
      setLoading(false);
    }
  };

  const isForeigner = !native;
  const extraButtons: any = [
    <Button size="xs" className="ml-auto" onClick={welcomeIn} variant="outline" withoutSound>
      {`Welcome in`}
    </Button>,
    isForeigner && (
      <Button isLoading={loading} size="xs" className="ml-auto" onClick={kickOut} variant="outline" withoutSound>
        {`Deny Entrance`}
      </Button>
    ),
  ];
  return <NpcComponent npc={npc} extraButtons={extraButtons} />;
};
