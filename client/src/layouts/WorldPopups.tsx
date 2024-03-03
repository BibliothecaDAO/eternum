import { HyperStructureInterface } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";
import { FeedHyperstructurePopup } from "../components/worldmap/hyperstructures/FeedHyperstructure";
import useUIStore from "../hooks/store/useUIStore";
import { ExploreMapPopup } from "../components/worldmap/explore/ExploreHexPopup";
import { TravelPopup } from "../components/worldmap/traveling/TravelPopup";
import { ChooseActionPopup } from "../components/worldmap/ChooseActionPopup";

export const WorldPopups = () => {
  const setClickedHex = useUIStore((state) => state.setClickedHex);
  const [showFeedPopup, setShowFeedPopup] = useState(false);
  const [selectedHyperstructure, setSelectedHyperstructure] = useState<HyperStructureInterface | undefined>(undefined);

  // select mode after selecting entity
  const isTravelMode = useUIStore((state) => state.isTravelMode);
  const setIsTravelMode = useUIStore((state) => state.setIsTravelMode);
  const isExploreMode = useUIStore((state) => state.isExploreMode);
  const setIsExploreMode = useUIStore((state) => state.setIsExploreMode);
  const isAttackMode = useUIStore((state) => state.isAttackMode);
  const setIsAttackMode = useUIStore((state) => state.setIsAttackMode);

  // no more interaction when clicking on hex for now
  // const clickedHex = useUIStore((state) => state.clickedHex);
  const selectedEntity = useUIStore((state) => state.selectedEntity);

  const clickedHyperstructure = useUIStore((state) => state.clickedHyperstructure);
  const setClickedHyperstructure = useUIStore((state) => state.setClickedHyperstructure);

  const onCloseHyperstructure = () => {
    setShowFeedPopup(false);
    setClickedHyperstructure(undefined);
  };

  useEffect(() => {
    if (clickedHyperstructure !== undefined) {
      // moveCameraToTarget(clickedHyperstructure.uiPosition);
      setSelectedHyperstructure(clickedHyperstructure);
      setShowFeedPopup(true);
    }
  }, [clickedHyperstructure]);

  return (
    <div className="z-[100]">
      {showFeedPopup && selectedHyperstructure && (
        <FeedHyperstructurePopup selectedHyperstructure={selectedHyperstructure} onClose={onCloseHyperstructure} />
      )}
      {selectedEntity && <ChooseActionPopup />}
      {isTravelMode && <TravelPopup />}
      {isExploreMode && <ExploreMapPopup />}
    </div>
  );
};
