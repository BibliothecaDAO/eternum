import clsx from "clsx";

import useUIStore from "@/hooks/store/useUIStore";
import {
  BASE_POPULATION_CAPACITY,
  BUILDING_CAPACITY,
  BUILDING_INFORMATION,
  BUILDING_POPULATION,
  BUILDING_PRODUCTION_PER_TICK,
  BUILDING_RESOURCE_PRODUCED,
  BuildingEnumToString,
  BuildingType,
  EternumGlobalConfig,
  RESOURCE_INFORMATION,
  RESOURCE_INPUTS,
  ResourcesIds,
  findResourceById,
} from "@bibliothecadao/eternum";
import { Tabs } from "@/ui/elements/tab";

import useRealmStore from "@/hooks/store/useRealmStore";
import { useGetRealm } from "@/hooks/helpers/useRealm";
import { useMemo, useState } from "react";
import { unpackResources } from "@/ui/utils/packedData";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { ReactComponent as InfoIcon } from "@/assets/icons/common/info.svg";
import { usePlayResourceSound } from "@/hooks/useUISound";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { BUILDING_COSTS } from "@bibliothecadao/eternum";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import { Headline } from "@/ui/elements/Headline";
import Button from "@/ui/elements/Button";
import { ResourceIdToMiningType, ResourceMiningTypes } from "@/ui/utils/utils";

// TODO: THIS IS TERRIBLE CODE, PLEASE REFACTOR

const BUILD_IMAGES_PREFIX = "/images/buildings/construction/";
export const BUILDING_IMAGES_PATH = {
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
  [ResourceMiningTypes.Forge]: BUILD_IMAGES_PREFIX + "forge.png",
  [ResourceMiningTypes.Mine]: BUILD_IMAGES_PREFIX + "mine.png",
  [ResourceMiningTypes.LumberMill]: BUILD_IMAGES_PREFIX + "lumber_mill.png",
  [ResourceMiningTypes.Dragonhide]: BUILD_IMAGES_PREFIX + "dragonhide.png",
};

export const SelectPreviewBuildingMenu = () => {
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const previewBuilding = useUIStore((state) => state.previewBuilding);
  const isDestroyMode = useUIStore((state) => state.isDestroyMode);
  const setIsDestroyMode = useUIStore((state) => state.setIsDestroyMode);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { realm } = useGetRealm(realmEntityId);

  const { getBalance } = useResourceBalance();
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

  const realmResourceIds = useMemo(() => {
    if (realm) {
      return unpackResources(BigInt(realm.resourceTypesPacked), realm.resourceTypesCount);
    } else {
      return [];
    }
  }, [realm]);

  const checkBalance = (cost: any) =>
    Object.keys(cost).every((resourceId) => {
      const resourceCost = cost[Number(resourceId)];
      const balance = getBalance(realmEntityId, resourceCost.resource);
      return balance.balance >= resourceCost.amount * EternumGlobalConfig.resources.resourcePrecision;
    });

  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = useMemo(
    () => [
      {
        key: "resources",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Resources</div>
          </div>
        ),
        component: (
          <div className="grid grid-cols-8 gap-2 p-2">
            {realmResourceIds.map((resourceId) => {
              const resource = findResourceById(resourceId)!;
              const cost = BUILDING_COSTS[BuildingType.Resource];
              const hasBalance = checkBalance(cost);
              return (
                <BuildingCard
                  key={resourceId}
                  buildingId={BuildingType.Resource}
                  resourceId={resourceId}
                  onClick={() => {
                    if (!hasBalance) {
                      return;
                    }
                    if (previewBuilding?.type === BuildingType.Resource && previewBuilding?.resource === resourceId) {
                      setPreviewBuilding(null);
                    } else {
                      setPreviewBuilding({ type: BuildingType.Resource, resource: resourceId });
                      playResourceSound(resourceId);
                    }
                  }}
                  active={previewBuilding?.resource === resourceId}
                  name={resource?.trait}
                  toolTip={<ResourceInfo resourceId={resourceId} entityId={realmEntityId} />}
                  canBuild={hasBalance && realm.hasCapacity}
                />
              );
            })}
          </div>
        ),
      },
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Economic</div>
          </div>
        ),
        component: (
          <div className="grid grid-cols-8 gap-2 p-2">
            {buildingTypes
              .filter((a) => a !== "Barracks" && a !== "ArcheryRange" && a !== "Stable")
              .map((buildingType, index) => {
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
                      if (previewBuilding?.type === building) {
                        setPreviewBuilding(null);
                      } else {
                        setPreviewBuilding({ type: building });
                        if (building === BuildingType.Farm) {
                          playResourceSound(ResourcesIds.Wheat);
                        }
                        if (building === BuildingType.FishingVillage) {
                          playResourceSound(ResourcesIds.Fish);
                        }
                      }
                    }}
                    active={previewBuilding?.type === building}
                    name={BuildingEnumToString[building]}
                    toolTip={<BuildingInfo buildingId={building} entityId={realmEntityId} />}
                    canBuild={BuildingType.WorkersHut == building ? hasBalance : hasBalance && realm.hasCapacity}
                  />
                );
              })}
          </div>
        ),
      },
      {
        key: "mine",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Military</div>
          </div>
        ),
        component: (
          <div className="grid grid-cols-8 gap-2 p-2">
            {" "}
            {buildingTypes
              .filter((a) => a === "Barracks" || a === "ArcheryRange" || a === "Stable")
              .map((buildingType, index) => {
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
                      if (previewBuilding?.type === building) {
                        setPreviewBuilding(null);
                      } else {
                        setPreviewBuilding({ type: building });
                      }
                    }}
                    active={previewBuilding?.type === building}
                    name={BuildingEnumToString[building]}
                    toolTip={<BuildingInfo buildingId={building} entityId={realmEntityId} />}
                    canBuild={BuildingType.WorkersHut == building ? hasBalance : hasBalance && realm.hasCapacity}
                  />
                );
              })}
          </div>
        ),
      },
    ],
    [realmEntityId, realmResourceIds, selectedTab, previewBuilding, playResourceSound],
  );

  return (
    <div className="flex flex-col -mt-40 bg-brown/90 border-gradient border">
      <Tabs selectedIndex={selectedTab} onChange={(index: any) => setSelectedTab(index)} className="h-full">
        <Tabs.List>
          {tabs.map((tab, index) => (
            <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panels className="overflow-hidden">
          {tabs.map((tab, index) => (
            <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
          ))}
        </Tabs.Panels>
      </Tabs>
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
  resourceId,
}: {
  buildingId: BuildingType;
  onClick: () => void;
  active: boolean;
  name: string;
  toolTip: React.ReactElement;
  canBuild?: boolean;
  resourceId?: ResourcesIds;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  return (
    <div
      style={{
        backgroundImage: `url(${
          resourceId
            ? BUILDING_IMAGES_PATH[ResourceIdToMiningType[resourceId as ResourcesIds] as ResourceMiningTypes]
            : BUILDING_IMAGES_PATH[buildingId as BuildingType]
        })`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      onClick={onClick}
      className={clsx(
        " hover:border-gold border border-transparent transition-all duration-200 text-gold overflow-hidden text-ellipsis  cursor-pointer relative h-32 min-w-20 ",
        {
          "!border-lightest !text-lightest": active,
        },
      )}
    >
      {!canBuild && (
        <div className="absolute w-full h-full bg-black/50 text-white/60 p-4 text-xs  flex justify-center ">
          <div className="self-center">insufficient fund or population</div>
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

export const ResourceInfo = ({ resourceId, entityId }: { resourceId: number; entityId: bigint | undefined }) => {
  const cost = RESOURCE_INPUTS[resourceId];

  const buildingCost = BUILDING_COSTS[BuildingType.Resource];

  const population = BUILDING_POPULATION[BuildingType.Resource];

  const capacity = BUILDING_CAPACITY[BuildingType.Resource];

  const information = RESOURCE_INFORMATION[resourceId];

  const { getBalance } = useResourceBalance();

  return (
    <div className="flex flex-col text-gold text-sm p-1 space-y-1">
      <Headline className="py-3"> Building </Headline>

      {population !== 0 && <div className="font-bold">Increases Population: +{population}</div>}

      {capacity !== 0 && <div className=" pt-3 font-bold">Increases Capacity: +{capacity}</div>}

      {findResourceById(resourceId)?.trait && (
        <div className=" flex pt-3 font-bold">
          <div>Produces: +10</div>
          <ResourceIcon className="self-center ml-1" resource={findResourceById(resourceId)?.trait || ""} size="md" />
          {findResourceById(resourceId)?.trait || ""} every cycle
        </div>
      )}

      <div className="pt-3 font-bold">consumed per/s</div>
      <div className="grid grid-cols-2 gap-2">
        {Object.keys(cost).map((resourceId) => {
          const balance = getBalance(entityId || 0n, cost[Number(resourceId)].resource);

          return (
            <ResourceCost
              key={resourceId}
              resourceId={cost[Number(resourceId)].resource}
              amount={cost[Number(resourceId)].amount}
              balance={balance.balance}
            />
          );
        })}
      </div>

      <div className="pt-3 font-bold">One Time Cost</div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.keys(buildingCost).map((resourceId, index) => {
          const balance = getBalance(entityId || 0n, buildingCost[Number(resourceId)].resource);

          return (
            <ResourceCost
              key={index}
              resourceId={buildingCost[Number(resourceId)].resource}
              amount={buildingCost[Number(resourceId)].amount * 1000}
              balance={balance.balance}
            />
          );
        })}
      </div>
    </div>
  );
};

export const BuildingInfo = ({ buildingId, entityId }: { buildingId: number; entityId: bigint | undefined }) => {
  const cost = BUILDING_COSTS[buildingId];

  const information = BUILDING_INFORMATION[buildingId];
  const population = BUILDING_POPULATION[buildingId];
  const capacity = BUILDING_CAPACITY[buildingId];
  const perTick = BUILDING_PRODUCTION_PER_TICK[buildingId];
  const resourceProduced = BUILDING_RESOURCE_PRODUCED[buildingId];
  const ongoingCost = RESOURCE_INPUTS[resourceProduced];

  const { getBalance } = useResourceBalance();

  return (
    <div className="p-2 text-sm text-gold">
      <Headline className="py-3"> {BuildingEnumToString[buildingId]} </Headline>

      {resourceProduced !== 0 && (
        <div className=" flex">
          <div className="font-bold">Produces: +{perTick}</div>
          <ResourceIcon
            className="self-center mx-1"
            resource={findResourceById(resourceProduced)?.trait || ""}
            size="md"
          />
          {findResourceById(resourceProduced)?.trait || ""}
        </div>
      )}

      {population !== 0 ? <div className="font-bold pt-3 ">Increases Population: +{population}</div> : ""}

      {capacity !== 0 ? <div className="font-bold pt-3 ">Increases Capacity: +{capacity}</div> : ""}

      {ongoingCost && ongoingCost.length ? (
        <>
          <div className="pt-3 font-bold">Cost per cycle</div>
          <div className="grid grid-cols-2 gap-2">
            {resourceProduced !== 0 &&
              ongoingCost &&
              Object.keys(ongoingCost).map((resourceId, index) => {
                const balance = getBalance(entityId || 0n, ongoingCost[Number(resourceId)].resource);
                return (
                  <ResourceCost
                    key={index}
                    type="horizontal"
                    resourceId={ongoingCost[Number(resourceId)].resource}
                    amount={ongoingCost[Number(resourceId)].amount}
                    balance={balance.balance}
                  />
                );
              })}
          </div>
        </>
      ) : (
        ""
      )}

      <div className="pt-3 font-bold"> One time cost</div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.keys(cost).map((resourceId, index) => {
          const balance = getBalance(entityId || 0n, cost[Number(resourceId)].resource);
          return (
            <ResourceCost
              key={index}
              type="horizontal"
              resourceId={cost[Number(resourceId)].resource}
              amount={cost[Number(resourceId)].amount}
              balance={balance.balance}
            />
          );
        })}
      </div>
    </div>
  );
};
