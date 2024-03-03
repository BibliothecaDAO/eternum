import { useMemo, useState } from "react";
import { useDojo } from "../../../DojoContext";
import Button from "../../../elements/Button";
import useUIStore from "../../../hooks/store/useUIStore";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { SecondaryPopup } from "../../../elements/SecondaryPopup";
import { formatTimeLeftDaysHoursMinutes, getUIPositionFromColRow } from "../../../utils/utils";

type TravelPopupProps = {};

export const TravelPopup = ({}: TravelPopupProps) => {
  const {
    account: { account },
    setup: {
      components: { Movable, Position },
      systemCalls: { travel },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const setIsTravelMode = useUIStore((state) => state.setIsTravelMode);
  const travelingEntity = useUIStore((state) => state.selectedEntity);
  const setTravelingEntity = useUIStore((state) => state.setSelectedEntity);
  const setAnimationPath = useUIStore((state) => state.setAnimationPath);
  const selectedPath = useUIStore((state) => state.selectedPath);
  const setSelectedPath = useUIStore((state) => state.setSelectedPath);
  const selectedDestination = useUIStore((state) => state.selectedDestination);

  const onCancelSelection = () => {
    setSelectedPath(undefined);
  };

  const onCancelTravel = () => {
    setIsTravelMode(false);
  };

  const onTravel = async () => {
    // travelingEntity
    if (!travelingEntity || !selectedDestination) return;
    setIsLoading(true);
    await travel({
      signer: account,
      travelling_entity_id: travelingEntity.id,
      destination_coord_x: selectedDestination.col,
      destination_coord_y: selectedDestination.row,
    });
    selectedPath && setAnimationPath({ id: selectedPath.id, path: selectedPath.path });
    // reset the state
    setTravelingEntity(undefined);
    setSelectedPath(undefined);
    setIsTravelMode(false);
  };

  const onClose = () => {
    // if (start) {
    //   // move camera back to the entity
    //   const startPos = getUIPositionFromColRow(start.col, start.row);
    //   moveCameraToTarget({ x: startPos.x, y: startPos.y, z: 0 });
    // }
    setIsTravelMode(false);
  };

  return (
    <SecondaryPopup className={"absolute !left-1/2 !top-[70px]"} name="explore">
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Move your army</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"250px"} height={"80px"}>
        <div className="flex flex-col items-center mr-2">
          <div className="text-gold">Choose Hex </div>
        </div>
        <div className="flex w-full items-center justify-center mt-1">
          <div className="flex mt-1 w-[80%] items-center justify-between">
            <Button variant="primary" size="md" isLoading={isLoading} onClick={onTravel} className="ml-3">
              Travel
            </Button>
            {selectedPath && (
              <Button variant="primary" size="md" onClick={onCancelSelection} className="mr-3">
                Cancel Selection
              </Button>
            )}
            {!selectedPath && (
              <Button variant="primary" size="md" onClick={onCancelTravel} className="mr-3">
                Cancel
              </Button>
            )}
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
