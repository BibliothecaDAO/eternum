import { useState } from "react";
import { useDojo } from "../../../../../DojoContext";
import { LaborBuilding } from "./LaborBuilding";
import { LaborResourceBuildPopup } from "./LaborResourceBuildPopup";
import { ChooseBuilding } from "./ChooseBuilding";

type LaborBuildingsPanelProps = {};

export const LaborBuildingsPanel = ({}: LaborBuildingsPanelProps) => {
  const {
    setup: {
      components: {},
    },
  } = useDojo();

  const [showPopup, setShowPopup] = useState(false);

  const [selectedLaborResource, setSelectedLaborResource] = useState<number | undefined>(undefined);

  const guild = 0;
  const hasGuild = true;

  return hasGuild ? (
    <div className="relative flex flex-col p-2 min-h-[120px]">
      {showPopup && selectedLaborResource && (
        <LaborResourceBuildPopup guild={guild} resourceId={selectedLaborResource} onClose={() => setShowPopup(false)} />
      )}
      <div className="flex flex-col p-2">
        <LaborBuilding
          guild={guild}
          selectedLaborResource={selectedLaborResource}
          setSelectedLaborResource={setSelectedLaborResource}
          setShowPopup={setShowPopup}
        />
      </div>
    </div>
  ) : (
    <ChooseBuilding />
  );
};
