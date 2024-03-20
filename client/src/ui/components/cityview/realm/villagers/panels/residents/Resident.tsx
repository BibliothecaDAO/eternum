import { Npc } from "../../types";
import Button from "../../../../../../elements/Button";
import { useState } from "react";
import { TravelNpcPopup } from "./TravelNpcPopup";
import { NpcComponent } from "../../NpcComponent";
type NpcComponentProps = {
  npc: Npc;
};

export const Resident = ({ npc }: NpcComponentProps) => {
  const [showTravel, setShowTravel] = useState(false);

  const onClose = (): void => {
    setShowTravel(false);
  };
  const extraButtons: any = [
    <Button
      size="xs"
      className="ml-auto"
      onClick={() => {
        setShowTravel(true);
      }}
      variant="outline"
      withoutSound
    >
      {`Travel`}
    </Button>,
  ];
  return (
    <>
      {showTravel && <TravelNpcPopup npc={npc} onClose={onClose} />}
      <NpcComponent npc={npc} extraButtons={extraButtons} />
    </>
  );
};
