import { HyperStructureInterface } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";
import { FeedHyperstructurePopup } from "../components/worldmap/hyperstructures/FeedHyperstructure";
import useUIStore from "../hooks/store/useUIStore";
import { ExploreMapPopup } from "../components/worldmap/explore/ExploreHexPopup";

export const Popups = () => {
  const [showFeedPopup, setShowFeedPopup] = useState(false);
  const [selectedHyperstructure, setSelectedHyperstructure] = useState<HyperStructureInterface | undefined>(undefined);
  const [showExplore, setShowExplore] = useState(false);

  const clickedHex = useUIStore((state) => state.clickedHex);

  useEffect(() => {
    if (clickedHex) {
      // check if hex is unexplored

      setShowExplore(true);
    }
  }, [clickedHex]);

  return (
    <>
      {/* {showFeedPopup && selectedHyperstructure && (
        <FeedHyperstructurePopup
          selectedHyperstructure={selectedHyperstructure}
          onClose={() => setShowFeedPopup(false)}
        />
      )} */}
      {showExplore && (
        <ExploreMapPopup
          onClose={() => {
            setShowExplore(false);
          }}
        ></ExploreMapPopup>
      )}
    </>
  );
};
