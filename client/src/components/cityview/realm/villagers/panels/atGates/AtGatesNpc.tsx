import { Npc } from "../../types";
import Button from "../../../../../../elements/Button";
import { useState } from "react";
import { NpcComponent } from "../../NpcComponent";
import { useDojo } from "../../../../../../DojoContext";
import useRealmStore from "../../../../../../hooks/store/useRealmStore";

type NpcComponentProps = {
  npc: Npc;
};

export const AtGatesNpc = ({ npc }: NpcComponentProps) => {
  const [loading, setLoading] = useState(false);
  const {
    setup: {
      systemCalls: { welcome_npc },
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

  const extraButtons: any = [
    <Button size="xs" isLoading={loading} className="ml-auto" onClick={welcomeIn} variant="outline" withoutSound>
      {`Welcome in`}
    </Button>,
  ];
  return <NpcComponent npc={npc} extraButtons={extraButtons} />;
};
