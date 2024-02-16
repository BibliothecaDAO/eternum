import { useState } from "react";
import { useDojo } from "../../../DojoContext";
import Button from "../../../elements/Button";
import useUIStore from "../../../hooks/store/useUIStore";

type TravelPopupProps = {};

export const TravelPopup = ({}: TravelPopupProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { travel },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const travelingEntity = useUIStore((state) => state.travelingEntity);
  const setTravelingEntity = useUIStore((state) => state.setTravelingEntity);
  const selectedDestination = useUIStore((state) => state.selectedDestination);

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

  return (
    <div>
      {/* travel info */}
      <Button isLoading={isLoading} onClick={onTravel}>
        Travel
      </Button>
    </div>
  );
};
