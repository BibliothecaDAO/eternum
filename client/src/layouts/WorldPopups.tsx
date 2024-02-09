import { HyperStructureInterface } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";
import { FeedHyperstructurePopup } from "../components/worldmap/hyperstructures/FeedHyperstructure";
import useUIStore from "../hooks/store/useUIStore";
import { ExploreMapPopup } from "../components/worldmap/explore/ExploreHexPopup";
import { useThree } from "@react-three/fiber";

export const WorldPopups = () => {
  const setClickedHex = useUIStore((state) => state.setClickedHex);
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

  const onCloseExplore = () => {
    setShowExplore(false);
    setClickedHex(undefined);
  };

  return (
    <div className="z-[100]">
      {/* {showFeedPopup && selectedHyperstructure && (
        <FeedHyperstructurePopup
          selectedHyperstructure={selectedHyperstructure}
          onClose={() => setShowFeedPopup(false)}
        />
      )} */}
      {showExplore && <ExploreMapPopup onClose={onCloseExplore}></ExploreMapPopup>}
    </div>
  );
};
