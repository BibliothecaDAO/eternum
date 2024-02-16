import { HyperStructureInterface } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";
import { FeedHyperstructurePopup } from "../components/worldmap/hyperstructures/FeedHyperstructure";
import useUIStore from "../hooks/store/useUIStore";
import { ExploreMapPopup } from "../components/worldmap/explore/ExploreHexPopup";
import { TravelPopup } from "../components/worldmap/traveling/TravelPopup";

export const WorldPopups = () => {
  const setClickedHex = useUIStore((state) => state.setClickedHex);
  const [showFeedPopup, setShowFeedPopup] = useState(false);
  const [selectedHyperstructure, setSelectedHyperstructure] = useState<HyperStructureInterface | undefined>(undefined);
  const [showExplore, setShowExplore] = useState(false);

  const clickedHex = useUIStore((state) => state.clickedHex);
  const travelingEntity = useUIStore((state) => state.travelingEntity);

  useEffect(() => {
    if (clickedHex) {
      // check if hex is unexplored

      setShowExplore(true);
    }
  }, [clickedHex]);

  const onCloseExplore = () => {
    setShowExplore(false);
    setClickedHex(undefined);
  };

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
      {travelingEntity !== undefined && <TravelPopup />}
      {showExplore && <ExploreMapPopup onClose={onCloseExplore}></ExploreMapPopup>}
    </div>
  );
};
