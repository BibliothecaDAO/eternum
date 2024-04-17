import { useState } from "react";
import clsx from "clsx";
import useUIStore from "@/hooks/store/useUIStore";
import { WorldMapBuildingType } from "@/dojo/modelManager/types";
import Button from "@/ui/elements/Button";
import { useDojo } from "@/hooks/context/DojoContext";

export const SelectWorldMapBuilding = () => {
  const buildingTypes = ["Banks"];

  const { worldMapBuilding, setWorldMapBuilding, clickedHex } = useUIStore();
  const {
    account: { account },
    setup: {
      systemCalls: { create_bank },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const handleSelectBuilding = (buildingType: WorldMapBuildingType) => {
    setWorldMapBuilding(buildingType);
  };

  const onBuild = () => {
    // build the building
    if (worldMapBuilding && clickedHex) {
      // build the building
      setIsLoading(true);
      create_bank({ coord: { x: clickedHex.col, y: clickedHex.row }, owner_fee_scaled: 0, signer: account })
        .then(() => setIsLoading(false))
        .catch(() => setIsLoading(false));
    }
  };

  return (
    <div className="grid grid-cols-3 gap-4 p-2">
      {buildingTypes.map((buildingType, index) => (
        <div
          key={index}
          className={clsx(
            "border border-gold text-gold rounded-md overflow-hidden text-ellipsis p-2 cursor-pointer hover:bg-gold hover:text-brown h-16 w-32",
            {
              "bg-gold !text-brown": worldMapBuilding === buildingType,
            },
          )}
          onClick={() => {
            if (worldMapBuilding === buildingType) {
              setWorldMapBuilding(undefined);
            } else {
              handleSelectBuilding(buildingType as WorldMapBuildingType);
            }
          }}
        >
          {buildingType}
        </div>
      ))}
      <div>
        <Button isLoading={isLoading} onClick={onBuild}>
          Build
        </Button>
      </div>
    </div>
  );
};
