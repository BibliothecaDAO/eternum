import clsx from "clsx";

import useUIStore from "@/hooks/store/useUIStore";
import {
  BUILDING_CAPACITY,
  BUILDING_INFORMATION,
  BUILDING_POPULATION,
  BUILDING_PRODUCTION_PER_TICK,
  BUILDING_RESOURCE_PRODUCED,
  BuildingEnumToString,
  BuildingType,
  RESOURCE_INPUTS,
  ResourcesIds,
  findResourceById,
} from "@bibliothecadao/eternum";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import useRealmStore from "@/hooks/store/useRealmStore";
import { useGetRealm } from "@/hooks/helpers/useRealm";
import { useMemo } from "react";
import { unpackResources } from "@/ui/utils/packedData";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { ReactComponent as InfoIcon } from "@/assets/icons/common/info.svg";
import { usePlayResourceSound } from "@/hooks/useUISound";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { BUILDING_COSTS } from "@bibliothecadao/eternum";
import { useProductionManager, useResourceBalance } from "@/hooks/helpers/useResources";

// TODO: THIS IS TERRIBLE CODE, PLEASE REFACTOR

const BUILD_IMAGES_PREFIX = "/images/buildings/construction/";
const BUILDING_IMAGES_PATH = {
  [BuildingType.None]: "",
  [BuildingType.Castle]: "",
  [BuildingType.Resource]: BUILD_IMAGES_PREFIX + "mine.png",
  [BuildingType.Farm]: BUILD_IMAGES_PREFIX + "farm.png",
  [BuildingType.FishingVillage]: BUILD_IMAGES_PREFIX + "fishing_village.png",
  [BuildingType.Barracks]: BUILD_IMAGES_PREFIX + "barracks.png",
  [BuildingType.Stable]: BUILD_IMAGES_PREFIX + "stable.png",
  [BuildingType.Market]: BUILD_IMAGES_PREFIX + "market.png",
  [BuildingType.ArcheryRange]: BUILD_IMAGES_PREFIX + "archery.png",
  [BuildingType.DonkeyFarm]: BUILD_IMAGES_PREFIX + "donkey_farm.png",
  [BuildingType.TradingPost]: BUILD_IMAGES_PREFIX + "trading_post.png",
  [BuildingType.WorkersHut]: BUILD_IMAGES_PREFIX + "workers_hut.png",
  [BuildingType.WatchTower]: BUILD_IMAGES_PREFIX + "watch_tower.png",
  [BuildingType.Walls]: BUILD_IMAGES_PREFIX + "walls.png",
  [BuildingType.Storehouse]: BUILD_IMAGES_PREFIX + "storehouse.png",
};

export const SelectPreviewBuilding = () => {
  const {
    setPreviewBuilding,
    previewBuilding,
    selectedResource,
    setResourceId,
    setTooltip,
    isDestroyMode,
    setIsDestroyMode,
  } = useUIStore();
  const [parent] = useAutoAnimate();
  const { playResourceSound } = usePlayResourceSound();

  const buildingTypes = Object.keys(BuildingType).filter(
    (key) =>
      isNaN(Number(key)) &&
      key !== "Castle" &&
      key !== "None" &&
      key !== "DonkeyFarm" &&
      key !== "TradingPost" &&
      key !== "WatchTower" &&
      key !== "Walls",
  );

  const realmEntityId = useRealmStore((state) => state.realmEntityId);
  const { realm } = useGetRealm(realmEntityId);

  let realmResourceIds = useMemo(() => {
    if (realm) {
      return unpackResources(BigInt(realm.resourceTypesPacked), realm.resourceTypesCount);
    } else {
      return [];
    }
  }, [realm]);

  const handleSelectBuilding = (buildingType: BuildingType) => {
    setPreviewBuilding(buildingType);
  };

  const { getBalance } = useResourceBalance();

  return (
    <div className="flex flex-col overflow-hidden" ref={parent}>
      <div className="grid grid-cols-2 gap-2 p-2">
        {buildingTypes.map((buildingType, index) => {
          const building = BuildingType[buildingType as keyof typeof BuildingType];

          const cost = BUILDING_COSTS[building];

          const hasBalance = Object.keys(cost).every((resourceId) => {
            const resourceCost = cost[Number(resourceId)];
            const balance = getBalance(realmEntityId, resourceCost.resource);
            return balance.balance >= resourceCost.amount;
          });

          return (
            <div
              key={index}
              className={clsx(
                "border-2 border-gold hover:border-gold/50 transition-all duration-200 text-gold rounded-lg overflow-hidden text-ellipsis  cursor-pointer h-24 relative  ",
                {
                  "!border-lightest !text-lightest": previewBuilding === building,
                },
                {
                  " cursor-not-allowed": (previewBuilding && previewBuilding !== building) || !hasBalance,
                },
                {},
              )}
              style={{
                backgroundImage: `url(${BUILDING_IMAGES_PATH[building]})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
              onClick={() => {
                if ((previewBuilding && previewBuilding !== building) || !hasBalance) {
                  return;
                }
                if (previewBuilding === building) {
                  setPreviewBuilding(null);
                } else {
                  handleSelectBuilding(building);
                }
              }}
            >
              {!hasBalance && (
                <div className="absolute w-full h-full bg-black/50 text-white p-4 text-xs">not enough resources</div>
              )}

              <div className="absolute bottom-0 left-0 right-0 font-bold text-xs px-2 py-1 bg-black/50">
                {BuildingEnumToString[building]}
              </div>
              <InfoIcon
                onMouseEnter={() => {
                  setTooltip({
                    content: <BuildingInfo buildingId={building} />,
                    position: "right",
                  });
                }}
                onMouseLeave={() => {
                  setTooltip(null);
                }}
                className="w-4 h-4 absolute top-2 right-2"
              />
            </div>
          );
        })}
        <div
          className={clsx(
            "border-2 border-order-giants/50 text-order-giants/50 hover:border-order-giants/85 hover:text-order-giants/85 flex justify-center items-center transition-all duration-20 rounded-lg overflow-hidden text-ellipsis  cursor-pointer h-24 relative",
            {
              "!text-order-giants !border-order-giants": isDestroyMode,
            },
          )}
          onClick={() => {
            if (previewBuilding) {
              setPreviewBuilding(null);
            }
            setIsDestroyMode(!isDestroyMode);
          }}
        >
          Destroy Building
        </div>
      </div>
      {previewBuilding == BuildingType.Resource && (
        <>
          <h5 className="w-full  p-2">Resources</h5>

          <div className="grid grid-cols-3 gap-2 p-2">
            {realmResourceIds.map((resourceId) => {
              const resource = findResourceById(resourceId)!;
              return (
                <div
                  key={resourceId}
                  onClick={() => {
                    if (selectedResource === resourceId) {
                      setResourceId(null);
                    } else {
                      setResourceId(resourceId);
                      playResourceSound(resourceId);
                    }
                  }}
                  className={clsx(
                    "border-2 border-gold hover:border-gold/50 transition-all duration-200 text-gold rounded-lg overflow-hidden text-ellipsis p-2 cursor-pointer relative",
                    {
                      "!border-lightest !text-lightest": selectedResource === resourceId,
                    },
                  )}
                >
                  <div className="flex relative flex-col items-start text-xs font-bold">
                    <ResourceIcon resource={resource?.trait} size="lg" />
                    <span>{resource?.trait}</span>
                    <InfoIcon
                      onMouseEnter={() => {
                        setTooltip({
                          content: <ResourceInfo resourceId={resourceId} />,
                          position: "right",
                        });
                      }}
                      onMouseLeave={() => {
                        setTooltip(null);
                      }}
                      className="w-4 h-4 absolute top-0 right-0"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export const ResourceInfo = ({ resourceId }: { resourceId: number }) => {
  const cost = RESOURCE_INPUTS[resourceId];

  return (
    <div className="flex flex-col text-white text-sm p-1 space-y-1">
      <h5 className="text-center">
        <ResourceIcon resource={findResourceById(resourceId)?.trait || ""} size="md" /> +10 per day
      </h5>
      <div className="font-bold text-center">Input Costs</div>
      <div className="grid grid-cols-2 gap-2">
        {Object.keys(cost).map((resourceId) => {
          return (
            <ResourceCost
              resourceId={cost[Number(resourceId)].resource}
              amount={cost[Number(resourceId)].amount / 1000}
            />
          );
        })}
      </div>
    </div>
  );
};

export const BuildingInfo = ({ buildingId }: { buildingId: number }) => {
  const cost = BUILDING_COSTS[buildingId];

  const information = BUILDING_INFORMATION[buildingId];

  const population = BUILDING_POPULATION[buildingId];

  const capacity = BUILDING_CAPACITY[buildingId];

  const perTick = BUILDING_PRODUCTION_PER_TICK[buildingId];

  const resourceProduced = BUILDING_RESOURCE_PRODUCED[buildingId];

  return (
    <div className="p-2 text-sm">
      <h6>Bonus</h6>

      <div>Population: +{population}</div>
      <div>Capacity: +{capacity}</div>
      {resourceProduced !== 0 && (
        <div className=" flex">
          <div>Produces: +{perTick}</div>

          <ResourceIcon
            className="self-center ml-3"
            resource={findResourceById(resourceProduced)?.trait || ""}
            size="md"
          />
        </div>
      )}
      <h6>Cost</h6>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.keys(cost).map((resourceId, index) => {
          return (
            <ResourceCost
              key={index}
              resourceId={cost[Number(resourceId)].resource}
              amount={cost[Number(resourceId)].amount / 1000}
            />
          );
        })}
      </div>
    </div>
  );
};
