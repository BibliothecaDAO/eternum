import { useState } from "react";
import clsx from "clsx";
import useUIStore from "@/hooks/store/useUIStore";
import { useDojo } from "@/hooks/context/DojoContext";
import { InfoIcon } from "lucide-react";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { WorldBuildingType } from "@bibliothecadao/eternum";
import Button from "@/ui/elements/Button";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import { divideByPrecision, multiplyByPrecision } from "@/ui/utils/utils";

const BUILD_IMAGES_PREFIX = "/images/buildings/construction/";
const BUILDING_IMAGES_PATH = {
  [WorldBuildingType.Bank]: BUILD_IMAGES_PREFIX + "mine.png",
  [WorldBuildingType.Settlement]: BUILD_IMAGES_PREFIX + "farm.png",
  [WorldBuildingType.Hyperstructure]: BUILD_IMAGES_PREFIX + "fishing_village.png",
};

const BUILDING_COST = {
  [WorldBuildingType.Bank]: 100,
  [WorldBuildingType.Settlement]: 100,
  [WorldBuildingType.Hyperstructure]: 100,
};

const BUILDING_UNBLOCKED = {
  [WorldBuildingType.Bank]: true,
  [WorldBuildingType.Settlement]: false,
  [WorldBuildingType.Hyperstructure]: false,
};

export const SelectWorldMapBuilding = ({ entityId }: any) => {
  const buildingTypes = Object.keys(WorldBuildingType).filter((type) => isNaN(Number(type)) && type !== "None");

  const { worldMapBuilding, setWorldMapBuilding, clickedHex, setTooltip } = useUIStore();
  const {
    account: { account },
    setup: {
      systemCalls: { create_bank },
    },
  } = useDojo();

  const { getBalance } = useResourceBalance();

  const lordsBalance = getBalance(entityId, 253).balance;

  const [isLoading, setIsLoading] = useState(false);

  const handleSelectBuilding = (buildingType: WorldBuildingType) => {
    if (
      !BUILDING_UNBLOCKED[buildingType] ||
      multiplyByPrecision(BUILDING_COST[buildingType]) > lordsBalance ||
      !clickedHex
    )
      return;
    setWorldMapBuilding(buildingType);
    console.log({ buildingType });
  };

  const onBuild = () => {
    // build the building
    if (worldMapBuilding && clickedHex) {
      // build the building
      setIsLoading(true);
      create_bank({
        realm_entity_id: entityId,
        coord: { x: clickedHex.col, y: clickedHex.row },
        owner_fee_scaled: 0,
        signer: account,
      }).finally(() => setIsLoading(false));
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
                {
                  "opacity-30 cursor-not-allowed":
                    !BUILDING_UNBLOCKED[building] || lordsBalance < multiplyByPrecision(BUILDING_COST[building]),
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
                    content: <CostInfo cost={BUILDING_COST[building]} lordsBalance={lordsBalance} />,
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

const CostInfo = ({ cost, lordsBalance }: { cost: number; lordsBalance: number }) => {
  return (
    <div className="flex flex-col text-white text-sm p-2">
      <div className="mt-3">Cost</div>
      <div className="font-bold flex space-x-2">
        <div className="text-order-giants">-{cost}</div> <ResourceIcon resource={"Lords"} size="xs" />
      </div>
      <div className="mt-3">Balance</div>
      <div className="font-bold flex space-x-2">
        <div className="text-order-brilliance">{divideByPrecision(lordsBalance)}</div>{" "}
        <ResourceIcon resource={"Lords"} size="xs" />
      </div>
    </div>
  );
};
