import clsx from "clsx";

import useUIStore from "@/hooks/store/useUIStore";
import { BUILDING_INFORMATION, BuildingType, RESOURCE_INPUTS, findResourceById } from "@bibliothecadao/eternum";
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
  const { setPreviewBuilding, previewBuilding, selectedResource, setResourceId, setTooltip } = useUIStore();
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
      key !== "Walls" &&
      key !== "Storehouse",
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

  return (
    <div className="flex flex-col overflow-hidden" ref={parent}>
      <div className="grid grid-cols-2 gap-2 p-2">
        {buildingTypes.map((buildingType, index) => {
          const building = BuildingType[buildingType as keyof typeof BuildingType];
          return (
            <div
              key={index}
              className={clsx(
                "border-2 border-gold hover:border-gold/50 transition-all duration-200 text-gold rounded-lg overflow-hidden text-ellipsis p-2 cursor-pointer h-24 relative",
                {
                  "!border-lightest !text-lightest": previewBuilding === building,
                },
              )}
              style={{
                backgroundImage: `url(${BUILDING_IMAGES_PATH[building]})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
              onClick={() => {
                if (previewBuilding === building) {
                  setPreviewBuilding(null);
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

export const ResourceInfo = ({ resourceId }: { resourceId: number }) => {
  const cost = RESOURCE_INPUTS[resourceId];

  return (
    <div className="flex flex-col text-white text-sm p-1 space-y-1">
      <h5 className="text-center">+10 per day</h5>
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
  return (
    <div>
      <div className="p-2 text-xs w-32">{information}</div>
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
