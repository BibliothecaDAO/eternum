import { useMemo, useState } from "react";
import { useDojo } from "../../../DojoContext";
import Button from "../../../elements/Button";
import useUIStore from "../../../hooks/store/useUIStore";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { SecondaryPopup } from "../../../elements/SecondaryPopup";
import { findDirection, formatTimeLeftDaysHoursMinutes, getUIPositionFromColRow } from "../../../utils/utils";

type TravelPopupProps = {};

export const TravelPopup = ({}: TravelPopupProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { travel_hex },
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

  const directions = useMemo(() => {
    if (!selectedPath?.path) return [];
    const { path } = selectedPath;
    return path
      .map((_, i) => {
        if (path[i + 1] === undefined) return undefined;
        const direction = findDirection({ col: path[i].x, row: path[i].y }, { col: path[i + 1].x, row: path[i + 1].y });
        console.log({ direction });
        if (direction !== undefined) return direction;
      })
      .filter(Boolean) as number[];
  }, [selectedPath]);

  console.log({ directions });

  const onTravel = async () => {
    console.log({ test: "helrg", selectedPath, directions });
    // travelingEntity
    if (!travelingEntity || !selectedDestination) return;
    setIsLoading(true);
    await travel_hex({
      signer: account,
      travelling_entity_id: travelingEntity.id,
      directions,
    });
    selectedPath && setAnimationPath({ id: selectedPath.id, path: selectedPath.path });
    // reset the state
    setTravelingEntity(undefined);
    setSelectedPath(undefined);
    setIsTravelMode(false);
  };

  return (
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
  );
};
