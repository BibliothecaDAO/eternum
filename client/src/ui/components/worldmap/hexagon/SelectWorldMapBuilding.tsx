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
import { useExplore } from "@/hooks/helpers/useExplore";
import { useStructures } from "@/hooks/helpers/useStructures";

// fixed = 5%
const BANK_OWNER_FEE = 922337203685477580n;

const BUILD_IMAGES_PREFIX = "/images/buildings/construction/";
const BUILDING_IMAGES_PATH = {
  [WorldBuildingType.Bank]: BUILD_IMAGES_PREFIX + "banks.png",
  [WorldBuildingType.Settlement]: BUILD_IMAGES_PREFIX + "hyperstructure.png",
  [WorldBuildingType.Hyperstructure]: BUILD_IMAGES_PREFIX + "hyperstructure.png",
};

const RESTRICTION_INFO = {
  [WorldBuildingType.Bank]: "Only on explored hexes. Cannot build on top of other buildings",
  [WorldBuildingType.Settlement]: "TBD",
  [WorldBuildingType.Hyperstructure]: "TBD",
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

const BUILDING_DESCRIPTION = {
  [WorldBuildingType.Bank]: "Build an AMM",
  [WorldBuildingType.Settlement]: "Expands your Base, and allows leasing of land to other players",
  [WorldBuildingType.Hyperstructure]: "Allows the creation of new lands",
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
    setWorldMapBuilding(buildingType);
  };

  const onBuild = () => {
    // build the building
    if (worldMapBuilding && clickedHex) {
      // build the building
      setIsLoading(true);
      create_bank({
        realm_entity_id: entityId,
        coord: { x: clickedHex.contractPos.col, y: clickedHex.contractPos.row },
        owner_fee_scaled: BANK_OWNER_FEE,
        signer: account,
      }).finally(() => setIsLoading(false));
    }
  };

  const { isExplored } = useExplore();
  const { hasStructures } = useStructures();

  const canBuild = (worldBuildingType: WorldBuildingType) => {
    return (
      BUILDING_UNBLOCKED[worldBuildingType] &&
      multiplyByPrecision(BUILDING_COST[worldBuildingType]) <= lordsBalance &&
      clickedHex &&
      isExplored(clickedHex.contractPos.col, clickedHex.contractPos.row) &&
      !hasStructures(clickedHex.contractPos.col, clickedHex.contractPos.row)
    );
  };

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="grid grid-cols-2 gap-2">
        {buildingTypes.map((buildingType, index) => {
          const building = WorldBuildingType[buildingType as keyof typeof WorldBuildingType];
          const isCanBuild = canBuild(building);
          return (
            <div
              key={index}
              className={clsx(
                "border-2 border-gold hover:border-gold/50 transition-all duration-200 text-gold rounded-lg overflow-hidden text-ellipsis p-2 cursor-pointer h-24 relative",
                {
                  "!border-lightest !text-lightest": worldMapBuilding === building,
                },
                {
                  "opacity-30 cursor-not-allowed": !isCanBuild,
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
                  isCanBuild && handleSelectBuilding(building);
                }
              }}
            >
              <div className="absolute bottom-0 left-0 right-0 font-bold text-xs px-2 py-1 bg-black/50">
                {buildingType}
              </div>
              <InfoIcon
                onMouseEnter={() => {
                  setTooltip({
                    content: (
                      <div>
                        <CostInfo cost={BUILDING_COST[building]} lordsBalance={lordsBalance} />
                        <RestrictionInfo restriction={RESTRICTION_INFO[building]} />
                        <div className="text-xs p-2 w-12">{BUILDING_DESCRIPTION[building]}</div>
                      </div>
                    ),
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
        <Button variant="primary" className="w-full mt-2" isLoading={isLoading} onClick={onBuild}>
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

const RestrictionInfo = ({ restriction }: { restriction: string }) => {
  return (
    <div className="flex flex-col text-white text-sm p-2">
      <div className="mt-3">Restriction</div>
      <div className="font-bold">{restriction}</div>
    </div>
  );
};
