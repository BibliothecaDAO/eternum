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

  const travelingEntity = useUIStore((state) => state.travelingEntity);
  const setTravelingEntity = useUIStore((state) => state.setTravelingEntity);
  const selectedDestination = useUIStore((state) => state.selectedDestination);
  const moveCameraToTarget = useUIStore((state) => state.moveCameraToTarget);

  // calculate distance between selected destination and selected entity
  const [distance, travelTime, start] = useMemo(() => {
    if (!travelingEntity || !selectedDestination) return [undefined, undefined, undefined];
    const movable = getComponentValue(Movable, getEntityIdFromKeys([travelingEntity]));
    const position = getComponentValue(Position, getEntityIdFromKeys([travelingEntity]));
    if (!movable || !position) return [undefined, undefined, undefined];

    const start = { col: position.x, row: position.y };
    const end = { col: selectedDestination.col, row: selectedDestination.row };
    const speed = movable.sec_per_km;
    const hexSizeInKm = 1;

    // Calculate total distance
    const distance = Math.sqrt(Math.pow(end.col - start.col, 2) + Math.pow(end.row - start.row, 2)) * hexSizeInKm;

    // Calculate total travel time
    const totalTravelTime = distance * speed;

    return [distance, totalTravelTime, start];
  }, [travelingEntity, selectedDestination]);

  const onTravel = async () => {
    // travelingEntity
    if (!travelingEntity || !selectedDestination) return;
    setIsLoading(true);
    await travel({
      signer: account,
      travelling_entity_id: travelingEntity,
      destination_coord_x: selectedDestination.col,
      destination_coord_y: selectedDestination.row,
    });
    setTravelingEntity(undefined);
  };

  const onClose = () => {
    if (start) {
      // move camera back to the entity
      const startPos = getUIPositionFromColRow(start.col, start.row);
      moveCameraToTarget({ x: startPos.x, y: startPos.y, z: 0 });
    }
    setTravelingEntity(undefined);
  };

  return (
    <SecondaryPopup className={"absolute !left-1/2 !top-[70px]"} name="explore">
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Move your army</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"200px"} height={"80px"}>
        <div className="flex text-white text-xs justify-center my-1">
          <div className="flex flex-col items-center mr-2">
            <div className="text-gold">Distance </div>
            <div>{distance?.toFixed(2)} km</div>
          </div>
          <div className="flex flex-col items-center ml-2">
            <div className="text-gold">Travel Time</div>
            {travelTime && <div>{formatTimeLeftDaysHoursMinutes(travelTime)}</div>}
          </div>
        </div>
        <div className="flex mt-1 w-full items-center justify-center">
          <Button variant="primary" size="md" isLoading={isLoading} onClick={onTravel}>
            Travel
          </Button>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
