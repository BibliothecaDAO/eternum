import { HyperStructureInterface } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";
import { FeedHyperstructurePopup } from "./hyperstructures/FeedHyperstructure";
import useUIStore from "../../hooks/store/useUIStore";
import { ChooseArmyActionPopup } from "./ChooseArmyActionPopup";

export const WorldPopups = () => {
  const [showFeedPopup, setShowFeedPopup] = useState(false);
  const [selectedHyperstructure, setSelectedHyperstructure] = useState<HyperStructureInterface | undefined>(undefined);

  // no more interaction when clicking on hex for now
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
      {selectedEntity && <ChooseArmyActionPopup />}
    </div>
  );
};
