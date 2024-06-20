import clsx from "clsx";

import useUIStore from "@/hooks/store/useUIStore";
import {
  BASE_POPULATION_CAPACITY,
  BUILDING_CAPACITY,
  BUILDING_POPULATION,
  BUILDING_RESOURCE_PRODUCED,
  BuildingEnumToString,
  BuildingType,
  EternumGlobalConfig,
  RESOURCE_INFORMATION,
  RESOURCE_INPUTS_SCALED,
  RESOURCE_OUTPUTS_SCALED,
  ResourcesIds,
  findResourceById,
} from "@bibliothecadao/eternum";
import { Tabs } from "@/ui/elements/tab";

import useRealmStore from "@/hooks/store/useRealmStore";
import { useGetRealm } from "@/hooks/helpers/useRealm";
import React, { useMemo, useState } from "react";
import { unpackResources } from "@/ui/utils/packedData";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { ReactComponent as InfoIcon } from "@/assets/icons/common/info.svg";
import { usePlayResourceSound } from "@/hooks/useUISound";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { BUILDING_COSTS_SCALED } from "@bibliothecadao/eternum";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import { Headline } from "@/ui/elements/Headline";
import { ResourceIdToMiningType, ResourceMiningTypes } from "@/ui/utils/utils";
import { hasEnoughPopulationForBuilding } from "@/ui/utils/realms";
import { QuestNames, useQuests } from "@/hooks/helpers/useQuests";
import { BuildingThumbs } from "@/ui/modules/navigation/LeftNavigationModule";
import CircleButton from "@/ui/elements/CircleButton";
import { quests as questsPopup } from "@/ui/components/navigation/Config";
import { useModal } from "@/hooks/store/useModal";
import { HintModal } from "../hints/HintModal";

// TODO: THIS IS TERRIBLE CODE, PLEASE REFACTOR

const BUILD_IMAGES_PREFIX = "/images/buildings/construction/";
export const BUILDING_IMAGES_PATH = {
  [BuildingType.Castle]: "",
  [BuildingType.Bank]: "",
  [BuildingType.FragmentMine]: "",
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

  const togglePopup = useUIStore((state) => state.togglePopup);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);

  const { toggleModal } = useModal();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { currentQuest } = useQuests();

  const { realm } = useGetRealm(realmEntityId);

  const { getBalance } = useResourceBalance();
  const { playResourceSound } = usePlayResourceSound();

  const buildingTypes = Object.keys(BuildingType).filter(
    (key) =>
      isNaN(Number(key)) &&
      key !== "Resource" &&
      key !== "Castle" &&
      key !== "Bank" &&
      key !== "FragmentMine" &&
      key !== "None" &&
      key !== "DonkeyFarm" &&
      key !== "TradingPost" &&
      key !== "WatchTower" &&
      key !== "Walls" &&
      key !== "Settlement" &&
      key !== "Hyperstructure",
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

  const [selectedTab, setSelectedTab] = useState(1);

  const closePopups = () => {
    if (isPopupOpen(questsPopup)) {
      togglePopup(questsPopup);
    }
  };

  const tabs = useMemo(
    () => [
      {
        key: "resources",
        label: (
          <div className="flex relative group flex-col items-center">
            <div
              className={clsx({
                "animate-pulse  border-b border-gold":
                  selectedTab !== 0 && currentQuest?.name === QuestNames.BuildResource,
              })}
            >
              Resources
            </div>
          </div>
        ),
        component: (
          <div className="resources-cards-selector grid grid-cols-4 gap-2 p-2">
            {realmResourceIds.map((resourceId) => {
              const resource = findResourceById(resourceId)!;

              const cost = [...BUILDING_COSTS_SCALED[BuildingType.Resource], ...RESOURCE_INPUTS_SCALED[resourceId]];
              const hasBalance = checkBalance(cost);

              const hasEnoughPopulation = hasEnoughPopulationForBuilding(
                realm,
                BUILDING_POPULATION[BuildingType.Resource],
              );

              const canBuild = hasBalance && realm?.hasCapacity && hasEnoughPopulation;
              return (
                <BuildingCard
                  className={clsx({
                    hidden: currentQuest?.name === QuestNames.BuildFarm,
                  })}
                  key={resourceId}
                  buildingId={BuildingType.Resource}
                  resourceId={resourceId}
                  onClick={() => {
                    if (!canBuild) {
                      return;
                    }
                    if (previewBuilding?.type === BuildingType.Resource && previewBuilding?.resource === resourceId) {
                      setPreviewBuilding(null);
                    } else {
                      setPreviewBuilding({ type: BuildingType.Resource, resource: resourceId });
                      playResourceSound(resourceId);
                      closePopups();
                    }
                  }}
                  active={previewBuilding?.resource === resourceId}
                  name={resource?.trait}
                  toolTip={<ResourceInfo resourceId={resourceId} entityId={realmEntityId} />}
                  canBuild={canBuild}
                />
              );
            })}
          </div>
        ),
      },
      {
        key: "economic",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Economic</div>
          </div>
        ),
        component: (
          <div className="grid grid-cols-4 gap-2 p-2">
            {buildingTypes
              .filter((a) => a !== "Barracks" && a !== "ArcheryRange" && a !== "Stable")
              .map((buildingType, index) => {
                const building = BuildingType[buildingType as keyof typeof BuildingType];
                const cost = BUILDING_COSTS_SCALED[building];
                const hasBalance = checkBalance(cost);

                const hasEnoughPopulation = hasEnoughPopulationForBuilding(realm, building);
                const canBuild =
                  BuildingType.WorkersHut == building
                    ? hasBalance
                    : hasBalance && realm?.hasCapacity && hasEnoughPopulation;

                const isFarm = building === BuildingType["Farm"];
                const buildingSelectorClass = `${buildingType}-selector`;

                return (
                  <BuildingCard
                    className={clsx(
                      {
                        hidden:
                          (!isFarm && currentQuest?.name === QuestNames.BuildFarm) ||
                          currentQuest?.name === QuestNames.BuildResource,
                        "animate-pulse": isFarm && currentQuest?.name === QuestNames.BuildFarm,
                      },
                      `${buildingSelectorClass}`,
                    )}
                    key={index}
                    buildingId={building}
                    onClick={() => {
                      if (!canBuild) {
                        return;
                      }
                      if (previewBuilding?.type === building) {
                        setPreviewBuilding(null);
                      } else {
                        setPreviewBuilding({ type: building });
                        if (building === BuildingType.Farm) {
                          playResourceSound(ResourcesIds.Wheat);
                          closePopups();
                        }
                        if (building === BuildingType.FishingVillage) {
                          playResourceSound(ResourcesIds.Fish);
                        }
                      }
                    }}
                    active={previewBuilding?.type === building}
                    name={BuildingEnumToString[building]}
                    toolTip={<BuildingInfo buildingId={building} entityId={realmEntityId} />}
                    canBuild={canBuild}
                  />
                );
              })}
          </div>
        ),
      },
      {
        key: "military",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Military</div>
          </div>
        ),
        component: (
          <div className="grid grid-cols-4 gap-2 p-2">
            {" "}
            {buildingTypes
              .filter((a) => a === "Barracks" || a === "ArcheryRange" || a === "Stable")
              .map((buildingType, index) => {
                const building = BuildingType[buildingType as keyof typeof BuildingType];

                const cost = BUILDING_COSTS_SCALED[building];
                const hasBalance = checkBalance(cost);

                const hasEnoughPopulation = hasEnoughPopulationForBuilding(realm, building);
                const canBuild = hasBalance && realm.hasCapacity && hasEnoughPopulation;

                const buildingSelectorClass = `${buildingType}-selector`;

                return (
                  <BuildingCard
                    className={clsx(`${buildingSelectorClass}`, {
                      hidden:
                        currentQuest?.name === QuestNames.BuildFarm || currentQuest?.name === QuestNames.BuildResource,
                    })}
                    key={index}
                    buildingId={building}
                    onClick={() => {
                      if (!canBuild) {
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
                    canBuild={canBuild}
                  />
                );
              })}
          </div>
        ),
      },
    ],
    [realm, realmEntityId, realmResourceIds, selectedTab, previewBuilding, playResourceSound],
  );

  return (
    <div className="relative flex flex-col  bg-brown border-gradient border clip-angled">
      <CircleButton
        className="absolute top-1 right-1"
        onClick={() => toggleModal(<HintModal initialActiveSection={"Buildings & Bases"} />)}
        size={"sm"}
        image={BuildingThumbs.question}
      />
      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: any) => {
          setSelectedTab(index);
        }}
        className="h-full"
      >
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
  className,
}: {
  buildingId: BuildingType;
  onClick: () => void;
  active: boolean;
  name: string;
  toolTip: React.ReactElement;
  canBuild?: boolean;
  resourceId?: ResourcesIds;
  className?: string;
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
        "hover:opacity-90   text-gold overflow-hidden text-ellipsis  cursor-pointer relative h-32 min-w-20 clip-angled-sm hover:border-gradient border border-transparent",
        {
          "!border-lightest border-gradient border": active,
        },
        className,
      )}
    >
      {!canBuild && (
        <div className="absolute w-full h-full bg-black/50 text-white/60 p-4 text-xs  flex justify-center ">
          <div className="self-center">insufficient funds or population</div>
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
  const cost = RESOURCE_INPUTS_SCALED[resourceId];

  const buildingCost = BUILDING_COSTS_SCALED[BuildingType.Resource];

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
              amount={buildingCost[Number(resourceId)].amount}
              balance={balance.balance}
            />
          );
        })}
      </div>
    </div>
  );
};

export const BuildingInfo = ({
  buildingId,
  entityId,
  extraButtons = [],
  name = BuildingEnumToString[buildingId],
}: {
  buildingId: number;
  entityId: bigint | undefined;
  extraButtons?: React.ReactNode[];
  name?: string;
}) => {
  const cost = BUILDING_COSTS_SCALED[buildingId] || [];

  const population = BUILDING_POPULATION[buildingId] || 0;
  const capacity = BUILDING_CAPACITY[buildingId] || 0;
  const perTick = RESOURCE_OUTPUTS_SCALED[buildingId] || 0;
  const resourceProduced = BUILDING_RESOURCE_PRODUCED[buildingId];
  const ongoingCost = RESOURCE_INPUTS_SCALED[resourceProduced] || 0;

  const { getBalance } = useResourceBalance();

  return (
    <div className="p-2 text-sm text-gold">
      <Headline className="pb-3"> {name} </Headline>

      {resourceProduced !== 0 && (
        <div className=" flex flex-wrap">
          <div className="font-bold uppercase w-full text-xs">Produces </div>
          <div className="flex justify-between">
            +{perTick}
            <ResourceIcon
              className="self-center mx-1"
              resource={findResourceById(resourceProduced)?.trait || ""}
              size="md"
            />
            {findResourceById(resourceProduced)?.trait || ""}
          </div>
        </div>
      )}

      {population !== 0 ? (
        <div className="font-bold pt-3 ">
          <span className="uppercase text-xs">Population</span>
          <br /> +{population}
        </div>
      ) : (
        ""
      )}

      {capacity !== 0 ? (
        <div className="font-bold pt-3 ">
          <span className="uppercase text-xs">Capacity</span>
          <br /> +{capacity}
        </div>
      ) : (
        ""
      )}

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

      {cost.length != 0 && (
        <>
          <div className="pt-3 font-bold uppercase text-xs"> One time cost</div>
          <div className="grid grid-cols-1 gap-2 text-sm">
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
        </>
      )}
      <div className="flex justify-center">{...extraButtons}</div>
    </div>
  );
};
