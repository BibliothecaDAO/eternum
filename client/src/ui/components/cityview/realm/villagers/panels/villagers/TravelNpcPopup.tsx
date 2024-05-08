import { useState } from "react";
import Button from "../../../../../../elements/Button";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "../../../../../../utils/utils";
import { Headline } from "../../../../../../elements/Headline";
import { SelectNpcForTravelPanel } from "./SelectNpcForTravel";
import { useDojo } from "@/hooks/context/DojoContext";
import useNpcStore from "@/hooks/store/useNpcStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";

type TravelNpcPopupProps = {
  onClose: () => void;
};

export const TravelNpcPopup = ({ onClose }: TravelNpcPopupProps) => {
  const {
    setup: {
      components: { Position },
      systemCalls: { npc_travel },
    },
    account: { account },
  } = useDojo();

  const { npcInTravelPopup, setNpcInTravelPopup } = useNpcStore();
  const [selectedEntityId, setSelectedEntityId] = useState<bigint | undefined>();
  const [canTravel, setCanTravel] = useState(true);
  const [loading, setLoading] = useState(false);

  const destinationPosition = selectedEntityId
    ? getComponentValue(Position, getEntityIdFromKeys([BigInt(selectedEntityId)]))
    : undefined;

  const travel = async () => {
    if (destinationPosition && npcInTravelPopup?.entityId) {
      setLoading(true);
      npc_travel({
        signer: account,
        npc_entity_id: npcInTravelPopup.entityId,
        to_realm_entity_id: selectedEntityId!,
      });
      setLoading(false);
      onClose();
    }
  };

  return (
    <OSWindow onClick={() => setNpcInTravelPopup(null)} show={npcInTravelPopup !== null} title="Travel">
      <div className="flex flex-col items-center p-2">
        <Headline className="mb-3">Choose Destination</Headline>
        <div className="flex relative mt-1 justify-center text-xxs text-lightest w-full">
          <div className="flex flex-col w-full">
            <SelectNpcForTravelPanel
              selectedEntityId={selectedEntityId}
              setSelectedEntityId={setSelectedEntityId}
              setCanTravel={setCanTravel}
            />
            <div className="flex mt-3 flex-col items-end h-full">
              <div className="flex justify-end">
                {!loading && (
                  <Button
                    className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto"
                    onClick={onClose}
                    variant="outline"
                    withoutSound
                  >
                    {`Cancel`}
                  </Button>
                )}
                <Button
                  className="!px-[6px] !py-[2px] text-xxs ml-auto"
                  isLoading={loading}
                  onClick={travel}
                  disabled={!selectedEntityId || !canTravel}
                  variant="outline"
                  withoutSound
                >
                  {`Travel`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </OSWindow>
  );
};
