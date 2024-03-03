import { useMemo, useState } from "react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import useUIStore from "../../hooks/store/useUIStore";
import { useDojo } from "../../DojoContext";
import { formatTimeLeftDaysHoursMinutes, getUIPositionFromColRow } from "../../utils/utils";
import { SecondaryPopup } from "../../elements/SecondaryPopup";
import Button from "../../elements/Button";

type ChooseActionPopupProps = {};

export const ChooseActionPopup = ({}: ChooseActionPopupProps) => {
  const setSelectedEntity = useUIStore((state) => state.setSelectedEntity);
  const setIsTravelMode = useUIStore((state) => state.setIsTravelMode);
  const setIsExploreMode = useUIStore((state) => state.setIsExploreMode);
  const setIsAttackMode = useUIStore((state) => state.setIsAttackMode);

  //   const setTravelingEntity = useUIStore((state) => state.setSelectedEntity);
  //   const moveCameraToTarget = useUIStore((state) => state.moveCameraToTarget);

  const onTravel = async () => {
    setIsTravelMode(true);
  };

  const onExplore = async () => {
    setIsExploreMode(true);
  };

  const onAttack = async () => {
    setIsAttackMode(true);
  };

  const onClose = () => {
    setSelectedEntity(undefined);
  };

  return (
    <SecondaryPopup className={"absolute !left-1/2 !top-[70px]"} name="explore">
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Choose an action</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"250px"} height={"80px"}>
        <div className="flex flex-col items-center mr-2">
          <div className="text-gold">Choose Action </div>
        </div>
        <div className="flex w-full items-center justify-center mt-1">
          <div className="flex mt-1 w-[80%] items-center justify-between">
            <Button variant="primary" size="md" onClick={onTravel} className="">
              Travel
            </Button>
            <Button variant="primary" size="md" onClick={onExplore} className="">
              Explore
            </Button>
            <Button variant="primary" size="md" disabled={true} onClick={onAttack} className="">
              Attack
            </Button>
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
