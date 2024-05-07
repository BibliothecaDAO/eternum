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
  RESOURCE_INFORMATION,
  RESOURCE_INPUTS,
  ResourcesIds,
  findResourceById,
} from "@bibliothecadao/eternum";

import useRealmStore from "@/hooks/store/useRealmStore";
import { useGetRealm } from "@/hooks/helpers/useRealm";
import { useMemo } from "react";
import { unpackResources } from "@/ui/utils/packedData";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { ReactComponent as InfoIcon } from "@/assets/icons/common/info.svg";
import { usePlayResourceSound } from "@/hooks/useUISound";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { BUILDING_COSTS } from "@bibliothecadao/eternum";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import { Headline } from "@/ui/elements/Headline";

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

  const { playResourceSound } = usePlayResourceSound();

  const buildingTypes = Object.keys(BuildingType).filter(
    (key) =>
      isNaN(Number(key)) &&
      key !== "Resource" &&
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

  const checkBalance = (cost: any) =>
    Object.keys(cost).every((resourceId) => {
      const resourceCost = cost[Number(resourceId)];
      const balance = getBalance(realmEntityId, resourceCost.resource);
      return balance.balance >= resourceCost.amount;
    });

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-2 gap-2 p-2">
        {realmResourceIds.map((resourceId) => {
          const resource = findResourceById(resourceId)!;

          const cost = BUILDING_COSTS[BuildingType.Resource];

          const hasBalance = checkBalance(cost);

          return (
            <div
              style={{
                backgroundImage: `url(${BUILDING_IMAGES_PATH[BuildingType.Resource]})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
              key={resourceId}
              onClick={() => {
                if (!hasBalance) {
                  return;
                }
                if (selectedResource === resourceId) {
                  setResourceId(null);
                } else {
                  setResourceId(resourceId);
                  playResourceSound(resourceId);
                }

                if (previewBuilding === BuildingType.Resource && selectedResource === resourceId) {
                  setPreviewBuilding(null);
                } else {
                  handleSelectBuilding(BuildingType.Resource);
                }
              }}
              className={clsx(
                "border-2 border-gold hover:border-gold/50 transition-all duration-200 text-gold rounded-lg overflow-hidden text-ellipsis  cursor-pointer relative h-24 ",
                {
                  "!border-lightest !text-lightest": selectedResource === resourceId,
                },
              )}
            >
              {!hasBalance && <div className="absolute w-full h-full bg-black/50 text-red p-4 text-xs"></div>}
              <div className="absolute bottom-0 left-0 right-0 font-bold text-xs px-2 py-1 bg-black/50">
                <span>{resource?.trait}</span>
              </div>
              <div className="flex relative flex-col items-start text-xs font-bold p-2">
                <ResourceIcon resource={resource?.trait} size="lg" />

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
                  className="w-4 h-4 absolute top-2 right-2"
                />
              </div>
            </div>
          );
        })}
        {buildingTypes.map((buildingType, index) => {
          const building = BuildingType[buildingType as keyof typeof BuildingType];

          const cost = BUILDING_COSTS[building];
          const hasBalance = checkBalance(cost);

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
              )}
              style={{
                backgroundImage: `url(${BUILDING_IMAGES_PATH[building]})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
              onClick={() => {
                if (!hasBalance) {
                  return;
                }
                if (previewBuilding === building) {
                  setPreviewBuilding(null);
                } else {
                  setResourceId(null);
                  handleSelectBuilding(building);
                }
              }}
            >
              {!hasBalance && <div className="absolute w-full h-full bg-black/50 text-red p-4 text-xs"></div>}

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
    </div>
  );
};

export const ResourceInfo = ({ resourceId }: { resourceId: number }) => {
  const cost = RESOURCE_INPUTS[resourceId];

  const buildingCost = BUILDING_COSTS[BuildingType.Resource];

  const population = BUILDING_POPULATION[BuildingType.Resource];

  const capacity = BUILDING_CAPACITY[BuildingType.Resource];

  const information = RESOURCE_INFORMATION[resourceId];

  return (
    <div className="flex flex-col text-gold text-sm p-1 space-y-1">
      <h5 className="text-center">
        <ResourceIcon resource={findResourceById(resourceId)?.trait || ""} size="md" /> +10 per cycle
      </h5>

      <Headline className="py-3">Building</Headline>

      {population !== 0 && <div>Increases Population: +{population}</div>}

      {capacity !== 0 && <div>Increases Capacity: +{capacity}</div>}
      <Headline className="py-3">Input Costs</Headline>
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
      <Headline className="py-3">Fixed Costs</Headline>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.keys(buildingCost).map((resourceId, index) => {
          return (
            <ResourceCost
              key={index}
              resourceId={buildingCost[Number(resourceId)].resource}
              amount={buildingCost[Number(resourceId)].amount / 1000}
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
    <div className="p-2 text-sm text-gold">
      {/* <div className="w-32 my-2">{information}</div> */}
      <Headline className="py-3">Building </Headline>

      {population !== 0 && <div>Increases Population: +{population}</div>}

      {capacity !== 0 && <div>Increases Capacity: +{capacity}</div>}

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
      <Headline className="py-3">Cost</Headline>
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

export const SelectPreviewBuildingMenu = () => {
  const { setPreviewBuilding, previewBuilding, selectedResource, setResourceId, isDestroyMode, setIsDestroyMode } =
    useUIStore();

  const { playResourceSound } = usePlayResourceSound();

  const buildingTypes = Object.keys(BuildingType).filter(
    (key) =>
      isNaN(Number(key)) &&
      key !== "Resource" &&
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

  const checkBalance = (cost: any) =>
    Object.keys(cost).every((resourceId) => {
      const resourceCost = cost[Number(resourceId)];
      const balance = getBalance(realmEntityId, resourceCost.resource);
      return balance.balance >= resourceCost.amount;
    });

  return (
    <div className="flex flex-col -mt-44">
      <div className="grid grid-cols-7 gap-2 p-2">
        {realmResourceIds.map((resourceId) => {
          const resource = findResourceById(resourceId)!;

          const cost = BUILDING_COSTS[BuildingType.Resource];

          const hasBalance = checkBalance(cost);

          return (
            <BuildingCard
              key={resourceId}
              buildingId={BuildingType.Resource}
              onClick={() => {
                if (!hasBalance) {
                  return;
                }
                if (selectedResource === resourceId) {
                  setResourceId(null);
                } else {
                  setResourceId(resourceId);
                  playResourceSound(resourceId);
                }

                if (previewBuilding === BuildingType.Resource && selectedResource === resourceId) {
                  setPreviewBuilding(null);
                } else {
                  handleSelectBuilding(BuildingType.Resource);
                }
              }}
              active={selectedResource === resourceId}
              name={resource?.trait}
              toolTip={<ResourceInfo resourceId={resourceId} />}
              canBuild={hasBalance}
            />
          );
        })}
        {buildingTypes.map((buildingType, index) => {
          const building = BuildingType[buildingType as keyof typeof BuildingType];

          const cost = BUILDING_COSTS[building];
          const hasBalance = checkBalance(cost);

          return (
            <BuildingCard
              key={index}
              buildingId={building}
              onClick={() => {
                if (!hasBalance) {
                  return;
                }
                if (previewBuilding === building) {
                  setPreviewBuilding(null);
                } else {
                  setResourceId(null);
                  handleSelectBuilding(building);
                }
              }}
              active={false}
              name={BuildingEnumToString[building]}
              toolTip={<BuildingInfo buildingId={building} />}
              canBuild={hasBalance}
            />
          );
        })}
        <div
          className={clsx(
            "border border-order-giants/50 text-white hover:border-order-giants/85 hover:text-order-giants/85 flex justify-center items-center transition-all duration-20 bg-order-giants/80 overflow-hidden text-ellipsis  cursor-pointer h-24 relative p-2 ",
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
    </div>
  );
};

export const BuildingCard = ({
  buildingId,
  onClick,
  active,
  name,
  toolTip,
  canBuild,
}: {
  buildingId: BuildingType;
  onClick: () => void;
  active: boolean;
  name: string;
  toolTip: React.ReactElement;
  canBuild?: boolean;
}) => {
  const { setTooltip } = useUIStore();
  return (
    <div
      style={{
        backgroundImage: `url(${BUILDING_IMAGES_PATH[buildingId as BuildingType]})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      onClick={onClick}
      className={clsx(
        " hover:border-gold border border-transparent transition-all duration-200 text-gold overflow-hidden text-ellipsis  cursor-pointer relative h-24 ",
        {
          "!border-lightest !text-lightest": active,
        },
      )}
    >
      {!canBuild && (
        <div className="absolute w-full h-full bg-black/50 text-white/60 p-4 text-xs pt-4 flex justify-center">
          <div className="self-center">no resources</div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 font-bold text-xs px-2 py-1 bg-black/50 ">
        <div className="truncate">{name}</div>
      </div>
      <div className="flex relative flex-col items-start text-xs font-bold p-2">
        {buildingId === BuildingType.Resource && <ResourceIcon resource={name} size="lg" />}

        <InfoIcon
          onMouseEnter={() => {
            setTooltip({
              content: toolTip,
              position: "right",
            });
          }}
          onMouseLeave={() => {
            setTooltip(null);
          }}
          className="w-4 h-4 absolute top-2 right-2"
        />
      </div>
    </div>
  );
};
