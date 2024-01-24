import { useMemo, useState } from "react";
import { useCombat } from "../../../../../hooks/helpers/useCombat";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { getEntityIdFromKeys } from "../../../../../utils/utils";
import { Defence } from "../../combat/defence/Defence";
import { useComponentValue } from "@dojoengine/react";
import { useDojo } from "../../../../../DojoContext";
import AttacksComponent from "../../combat/defence/AttacksComponent";
import { ManageSoldiersPopupTabs } from "../../combat/raids/ManageSoldiersPopupTabs";
import { HealPopup } from "../../combat/HealPopup";
import { LevelIndex, useLevel } from "../../../../../hooks/helpers/useLevel";
import { getComponentValue } from "@dojoengine/recs";
import { useHyperstructure } from "../../../../../hooks/helpers/useHyperstructure";
import { LaborBuilding } from "./LaborBuilding";
import { Guild } from "@bibliothecadao/eternum";
import { LaborResourceBuildPopup } from "./LaborResourceBuildPopup";
import Button from "../../../../../elements/Button";
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

  const hasGuild = true;

  return hasGuild ? (
    <div className="relative flex flex-col p-2 min-h-[120px]">
      {showPopup && selectedLaborResource && (
        <LaborResourceBuildPopup resourceId={selectedLaborResource} onClose={() => setShowPopup(false)} />
      )}
      <div className="flex flex-col p-2">
        <LaborBuilding
          guild={Guild.Harvesters}
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
