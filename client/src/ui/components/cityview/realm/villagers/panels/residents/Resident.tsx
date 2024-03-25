import { Npc } from "../../types";
import Button from "../../../../../../elements/Button";
import { useState } from "react";
import { TravelNpcPopup } from "./TravelNpcPopup";
import { NpcComponent } from "../../NpcComponent";
import { useDojo } from "../../../../../../DojoContext";

type NpcComponentProps = {
  npc: Npc;
  native: boolean;
};

export const Resident = ({ npc, native }: NpcComponentProps) => {
  const [loading, setLoading] = useState(false);
  const [showTravel, setShowTravel] = useState(false);
  const {
    setup: {
      systemCalls: { kick_out_npc },
    },
    account: { account },
  } = useDojo();

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
        isLoading={loading}
        size="xs"
        className="ml-auto"
        onClick={() => {
          setShowTravel(true);
        }}
        variant="outline"
        withoutSound
      >
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
      <NpcComponent npc={npc} extraButtons={extraButtons} />
    </>
  );
};
