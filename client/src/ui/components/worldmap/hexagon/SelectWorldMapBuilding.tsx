import { useState } from "react";
import clsx from "clsx";
import useUIStore from "@/hooks/store/useUIStore";
import { useDojo } from "@/hooks/context/DojoContext";
import { InfoIcon } from "lucide-react";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { WorldBuildingType } from "@bibliothecadao/eternum";
import Button from "@/ui/elements/Button";

const BUILD_IMAGES_PREFIX = "/images/buildings/construction/";
const BUILDING_IMAGES_PATH = {
  [WorldBuildingType.Bank]: BUILD_IMAGES_PREFIX + "mine.png",
  [WorldBuildingType.Settlement]: BUILD_IMAGES_PREFIX + "farm.png",
  [WorldBuildingType.Hyperstructure]: BUILD_IMAGES_PREFIX + "fishing_village.png",
};

export const SelectWorldMapBuilding = (entityId: any) => {
  const buildingTypes = Object.keys(WorldBuildingType).filter((type) => isNaN(Number(type)) && type !== "None");

  const { worldMapBuilding, setWorldMapBuilding, clickedHex, setTooltip } = useUIStore();
  const {
    account: { account },
    setup: {
      systemCalls: { create_bank },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const handleSelectBuilding = (buildingType: WorldBuildingType) => {
    setWorldMapBuilding(buildingType);
  };

  const onBuild = () => {
    // build the building
    if (worldMapBuilding && clickedHex) {
      // build the building
      setIsLoading(true);
      create_bank({ coord: { x: clickedHex.col, y: clickedHex.row }, owner_fee_scaled: 0, signer: account }).finally(
        () => setIsLoading(false),
      );
    }
  };

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="grid grid-cols-3 gap-2 p-2">
        {buildingTypes.map((buildingType, index) => {
          const building = WorldBuildingType[buildingType as keyof typeof WorldBuildingType];
          return (
            <div
              key={index}
              className={clsx(
                "border-2 border-gold hover:border-gold/50 transition-all duration-200 text-gold rounded-lg overflow-hidden text-ellipsis p-2 cursor-pointer h-16 relative",
                {
                  "!border-lightest !text-lightest": worldMapBuilding === building,
                },
              )}
              style={{
                backgroundImage: `url(${BUILDING_IMAGES_PATH[building]})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
              onClick={() => {
                if (worldMapBuilding === building) {
                  setWorldMapBuilding(null);
                } else {
                  handleSelectBuilding(building);
                }
              }}
            >
              <div className="absolute bottom-0 left-0 right-0 font-bold text-xs px-2 py-1 bg-black/50">
                {buildingType}
              </div>
              <InfoIcon
                onMouseEnter={() => {
                  setTooltip({
                    content: <MineInfo />,
                    position: "right",
                  });
                }}
                onMouseLeave={() => {
                  setTooltip(null);
                }}
                className="w-4 h-4 absolute top-0 right-0"
              />
            </div>
          );
        })}
      </div>
      <div>
        <Button isLoading={isLoading} onClick={onBuild}>
          Build
        </Button>
      </div>
    </div>
  );
};

const MineInfo = () => {
  return (
    <div className="flex flex-col text-white text-sm p-2">
      <div className="font-bold">Producing</div>
      <div className="flex space-x-2 font-bold">
        <div>+100</div> <ResourceIcon resource={"Ruby"} size="xs" />
        /tick
      </div>

      <div className="mt-3">Consuming</div>
      <div className="font-bold flex space-x-2">
        <div className="text-order-giants">-50</div> <ResourceIcon resource={"Wood"} size="xs" />
        /tick
      </div>
      <div className="font-bold flex space-x-2">
        <div className="text-order-giants">-50</div> <ResourceIcon resource={"Coal"} size="xs" />
        /tick
      </div>
    </div>
  );
};
