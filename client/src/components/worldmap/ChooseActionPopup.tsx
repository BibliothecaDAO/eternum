import { useMemo, useState } from "react";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import useUIStore from "../../hooks/store/useUIStore";
import { useDojo } from "../../DojoContext";
import { formatTimeLeftDaysHoursMinutes, getUIPositionFromColRow } from "../../utils/utils";
import { SecondaryPopup } from "../../elements/SecondaryPopup";
import Button from "../../elements/Button";
import { TravelPopup } from "./traveling/TravelPopup";
import { ExploreMapPopup } from "./explore/ExploreHexPopup";

type ChooseActionPopupProps = {};

export const ChooseActionPopup = ({}: ChooseActionPopupProps) => {
  const setSelectedEntity = useUIStore((state) => state.setSelectedEntity);
  const setIsTravelMode = useUIStore((state) => state.setIsTravelMode);
  const isTravelMode = useUIStore((state) => state.isTravelMode);
  const setIsExploreMode = useUIStore((state) => state.setIsExploreMode);
  const isExploreMode = useUIStore((state) => state.isExploreMode);
  const setIsAttackMode = useUIStore((state) => state.setIsAttackMode);
  const isAttackMode = useUIStore((state) => state.isAttackMode);

  const getTitle = () => {
    if (isTravelMode) return "Travel";
    if (isExploreMode) return "Explore";
    if (isAttackMode) return "Attack";
    return "Select Action";
  };

  const getHeadline = () => {
    if (isTravelMode || isExploreMode || isAttackMode) return "Select Hex";
    return "Choose an action";
  };

  const onTravel = () => setIsTravelMode(true);
  const onExplore = () => setIsExploreMode(true);
  const onAttack = () => setIsAttackMode(true);
  const onClose = () => {
    setIsAttackMode(false);
    setIsExploreMode(false);
    setIsTravelMode(false);
    setSelectedEntity(undefined);
  };

  return (
    <SecondaryPopup className={"absolute !left-1/2 !top-[70px]"} name="explore">
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">{getTitle()}</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"250px"} height={isExploreMode ? "230px" : "80px"}>
        <div className="flex flex-col items-center mr-2">
          <div className="text-gold">{getHeadline()}</div>
        </div>
        {isTravelMode && <TravelPopup />}
        {isExploreMode && <ExploreMapPopup />}
        {!isTravelMode && !isExploreMode && !isAttackMode && (
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
        )}
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
