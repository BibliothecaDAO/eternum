import { useState } from "react";
import clsx from "clsx";
import useUIStore from "@/hooks/store/useUIStore";
import { WorldMapBuildingType } from "@/dojo/modelManager/types";
import Button from "@/ui/elements/Button";
import { useDojo } from "@/hooks/context/DojoContext";

export const SelectWorldMapBuilding = () => {
  const buildingTypes = ["Banks"];

  const { worldMapBuilding, setWorldMapBuilding } = useUIStore();
  const {
    setup: {
      systemCalls: {},
    },
  } = useDojo();

  const handleSelectBuilding = (buildingType: WorldMapBuildingType) => {
    setWorldMapBuilding(buildingType);
  };

  console.log(worldMapBuilding);

  const onBuild = () => {
    // build the building
    if (worldMapBuilding) {
      // build the building
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
        <Button
          onClick={() => {
            // build the building
          }}
        >
          Build
        </Button>
      </div>
    </div>
  );
};
