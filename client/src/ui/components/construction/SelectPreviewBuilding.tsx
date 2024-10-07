import clsx from "clsx";

import useUIStore from "@/hooks/store/useUIStore";
import { Tabs } from "@/ui/elements/tab";
import {
  BUILDING_CAPACITY,
  BUILDING_POPULATION,
  BUILDING_RESOURCE_PRODUCED,
  BuildingEnumToString,
  BuildingType,
  EternumGlobalConfig,
  findResourceById,
  ID,
  RESOURCE_BUILDING_COSTS_SCALED,
  RESOURCE_INPUTS_SCALED,
  RESOURCE_OUTPUTS,
  ResourcesIds,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/eternum";

import { ReactComponent as InfoIcon } from "@/assets/icons/common/info.svg";
import { useQuestClaimStatus } from "@/hooks/helpers/useQuests";
import { useGetRealm } from "@/hooks/helpers/useRealm";
import { getResourceBalance } from "@/hooks/helpers/useResources";
import { useQuestStore } from "@/hooks/store/useQuestStore";

import { ClientComponents } from "@/dojo/createClientComponents";
import { DojoResult, useDojo } from "@/hooks/context/DojoContext";
import { usePlayResourceSound } from "@/hooks/useUISound";
import { ResourceMiningTypes } from "@/types";
import { QuestId } from "@/ui/components/quest/questDetails";
import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { Headline } from "@/ui/elements/Headline";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { unpackResources } from "@/ui/utils/packedData";
import { hasEnoughPopulationForBuilding } from "@/ui/utils/realms";
import { getEntityIdFromKeys, isResourceProductionBuilding, ResourceIdToMiningType } from "@/ui/utils/utils";
import { BUILDING_COSTS_SCALED } from "@bibliothecadao/eternum";
import { Component, getComponentValue } from "@dojoengine/recs";
import React, { useMemo, useState } from "react";
import { HintSection } from "../hints/HintModal";

// TODO: THIS IS TERRIBLE CODE, PLEASE REFACTOR

export const SelectPreviewBuildingMenu = () => {
  const dojo = useDojo();

  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const previewBuilding = useUIStore((state) => state.previewBuilding);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const selectedQuest = useQuestStore((state) => state.selectedQuest);

  const { realm } = useGetRealm(structureEntityId);

  const { getBalance } = getResourceBalance();
  const { playResourceSound } = usePlayResourceSound();
  const { questClaimStatus } = useQuestClaimStatus();

  const buildingTypes = Object.keys(BuildingType).filter(
    (key) =>
      isNaN(Number(key)) &&
      key !== "Resource" &&
      key !== "Castle" &&
      key !== "Bank" &&
      key !== "FragmentMine" &&
      key !== "None" &&
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
      const balance = getBalance(structureEntityId, resourceCost.resource);
      return balance.balance / EternumGlobalConfig.resources.resourcePrecision >= resourceCost.amount;
    });

  const [selectedTab, setSelectedTab] = useState(1);

  const tabs = useMemo(
    () => [
      {
        key: "resources",
        label: (
          <div className="flex relative group flex-col items-center">
            <div
              className={clsx({
                "animate-pulse  border-b border-gold": selectedTab !== 0 && selectedQuest?.id === QuestId.BuildResource,
              })}
            >
              Resources
            </div>
          </div>
        ),
        component: (
          <div className="grid grid-cols-2 gap-2 p-2">
            {realmResourceIds.map((resourceId) => {
              const resource = findResourceById(resourceId)!;

              const buildingCosts = getResourceBuildingCosts(structureEntityId, dojo, resourceId);
              if (!buildingCosts) return;
              const cost = [...buildingCosts, ...RESOURCE_INPUTS_SCALED[resourceId]];

              const hasBalance = checkBalance(cost);

              const hasEnoughPopulation = hasEnoughPopulationForBuilding(
                realm,
                BUILDING_POPULATION[BuildingType.Resource],
              );

              const canBuild = hasBalance && realm?.hasCapacity && hasEnoughPopulation;

              return (
                <BuildingCard
                  className={clsx({
                    hidden: !questClaimStatus[QuestId.BuildFarm],
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
                    }
                  }}
                  active={previewBuilding?.resource === resourceId}
                  buildingName={resource?.trait}
                  resourceName={resource?.trait}
                  toolTip={<ResourceInfo resourceId={resourceId} entityId={structureEntityId} />}
                  hasFunds={hasBalance}
                  hasPopulation={hasEnoughPopulation}
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
          <div className="grid grid-cols-2 gap-2 p-2">
            {buildingTypes
              .filter(
                (a) =>
                  a !== BuildingType[BuildingType.Barracks] &&
                  a !== BuildingType[BuildingType.ArcheryRange] &&
                  a !== BuildingType[BuildingType.Stable],
              )
              .map((buildingType, index) => {
                const building = BuildingType[buildingType as keyof typeof BuildingType];

                const buildingCosts = getBuildingCosts(structureEntityId, dojo, building);
                if (!buildingCosts) return;

                const hasBalance = checkBalance(buildingCosts);

                const hasEnoughPopulation = hasEnoughPopulationForBuilding(realm, building);
                const canBuild =
                  BuildingType.WorkersHut == building
                    ? hasBalance
                    : hasBalance && realm?.hasCapacity && hasEnoughPopulation;

                const isFarm = building === BuildingType["Farm"];
                const isFishingVillage = building === BuildingType["FishingVillage"];
                const isWorkersHut = building === BuildingType["WorkersHut"];
                const isMarket = building === BuildingType["Market"];

                return (
                  <BuildingCard
                    className={clsx({
                      hidden: !isFarm && !questClaimStatus[QuestId.BuildResource],
                      "animate-pulse":
                        (isFarm && selectedQuest?.id === QuestId.BuildFarm) ||
                        (isWorkersHut && selectedQuest?.id === QuestId.BuildWorkersHut) ||
                        (isMarket && selectedQuest?.id === QuestId.Market),
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
                        if (building === BuildingType.Farm) {
                          playResourceSound(ResourcesIds.Wheat);
                        }
                        if (building === BuildingType.FishingVillage) {
                          playResourceSound(ResourcesIds.Fish);
                        }
                      }
                    }}
                    active={previewBuilding?.type === building}
                    buildingName={BuildingEnumToString[building]}
                    resourceName={isFishingVillage ? "Fish" : isFarm ? "Wheat" : undefined}
                    toolTip={<BuildingInfo buildingId={building} entityId={structureEntityId} />}
                    hasFunds={hasBalance}
                    hasPopulation={hasEnoughPopulation}
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
          <div className="grid grid-cols-2 gap-2 p-2">
            {" "}
            {buildingTypes
              .filter(
                (a) =>
                  a === BuildingType[BuildingType.Barracks] ||
                  a === BuildingType[BuildingType.ArcheryRange] ||
                  a === BuildingType[BuildingType.Stable],
              )
              .map((buildingType, index) => {
                const building = BuildingType[buildingType as keyof typeof BuildingType];
                const buildingCost = getBuildingCosts(structureEntityId, dojo, building);

                const hasBalance = checkBalance(buildingCost);

                const hasEnoughPopulation = hasEnoughPopulationForBuilding(realm, building);
                const canBuild = hasBalance && realm.hasCapacity && hasEnoughPopulation;

                const isBarracks = building === BuildingType.Barracks;
                const isArcheryRange = building === BuildingType.ArcheryRange;
                const isStable = building === BuildingType.Stable;

                return (
                  <BuildingCard
                    className={clsx({
                      hidden: !questClaimStatus[QuestId.BuildResource],
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
                    buildingName={BuildingEnumToString[building]}
                    resourceName={
                      isBarracks ? "Knight" : isArcheryRange ? "Crossbowman" : isStable ? "Paladin" : undefined
                    }
                    toolTip={<BuildingInfo buildingId={building} entityId={structureEntityId} />}
                    hasFunds={hasBalance}
                    hasPopulation={hasEnoughPopulation}
                  />
                );
              })}
          </div>
        ),
      },
    ],
    [realm, structureEntityId, realmResourceIds, selectedTab, previewBuilding, playResourceSound],
  );

  return (
    <>
      <HintModalButton className="absolute top-1 right-1" section={HintSection.Buildings} />
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
    </>
  );
};

const BuildingCard = ({
  buildingId,
  onClick,
  active,
  buildingName,
  resourceName,
  toolTip,
  hasFunds,
  hasPopulation,
  resourceId,
  className,
}: {
  buildingId: BuildingType;
  onClick: () => void;
  active: boolean;
  buildingName: string;
  resourceName?: string;
  toolTip: React.ReactElement;
  hasFunds?: boolean;
  hasPopulation?: boolean;
  resourceId?: ResourcesIds;
  className?: string;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  return (
    <div
      onClick={onClick}
      className={clsx(
        "text-gold bg-black/30 overflow-hidden text-ellipsis cursor-pointer relative h-36 min-w-20 hover:bg-gold/20 rounded-xl",
        {
          "!border-lightest": active,
        },
        className,
      )}
    >
      <img
        src={
          resourceId
            ? BUILDING_IMAGES_PATH[ResourceIdToMiningType[resourceId as ResourcesIds] as ResourceMiningTypes]
            : BUILDING_IMAGES_PATH[buildingId as keyof typeof BUILDING_IMAGES_PATH]
        }
        alt={buildingName}
        className="absolute inset-0 w-full h-full object-contain"
      />
      {(!hasFunds || !hasPopulation) && (
        <div className="absolute w-full h-full bg-black/70 p-4 text-xs flex justify-center">
          <div className="self-center flex items-center space-x-2">
            {!hasFunds && <ResourceIcon tooltipText="Need More Resources" resource="Silo" size="lg" />}
            {!hasPopulation && <ResourceIcon tooltipText="Need More Housing" resource="House" size="lg" />}
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <div className="truncate">{buildingName}</div>
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
      <div className="flex relative flex-col items-end p-2 rounded">
        <div className="rounded p-1 bg-black/10">
          {isResourceProductionBuilding(buildingId) && resourceName && (
            <ResourceIcon withTooltip={false} resource={resourceName} size="lg" />
          )}
        </div>
      </div>
    </div>
  );
};

export const ResourceInfo = ({
  resourceId,
  entityId,
  isPaused,
}: {
  resourceId: number;
  entityId: ID | undefined;
  isPaused?: boolean;
}) => {
  const dojo = useDojo();
  const cost = RESOURCE_INPUTS_SCALED[resourceId];

  const buildingCost = getResourceBuildingCosts(entityId ?? 0, dojo, resourceId) ?? [];
  const population = BUILDING_POPULATION[BuildingType.Resource];

  const capacity = BUILDING_CAPACITY[BuildingType.Resource];

  const amountProducedPerTick = RESOURCE_OUTPUTS[resourceId];

  const { getBalance } = getResourceBalance();

  const consumedBy = useMemo(() => {
    return getConsumedBy(resourceId);
  }, [resourceId]);

  return (
    <div className="flex flex-col text-gold text-sm p-2 space-y-1">
      <Headline className="py-3">Resource Building </Headline>

      {isPaused && <div className="py-3 font-bold"> ⚠️ Building Production Paused </div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          {population !== 0 && (
            <div className="font-bold uppercase">
              <span className="font-bold">Population </span> <br />+{population}{" "}
            </div>
          )}

          {capacity !== 0 && (
            <div className="pt-3 uppercase">
              <span className="font-bold">Max population capacity </span>
              <br /> +{capacity}
            </div>
          )}
        </div>

        {findResourceById(resourceId)?.trait && (
          <div className="uppercase">
            <div className="w-full font-bold">Produces</div>

            <div className="flex gap-2">
              + {amountProducedPerTick}
              <ResourceIcon className="self-center" resource={findResourceById(resourceId)?.trait || ""} size="md" />
              {findResourceById(resourceId)?.trait || ""} per/s
            </div>
          </div>
        )}
      </div>

      <div className="font-bold uppercase">consumed per/s</div>
      <div className="grid grid-cols-2 gap-2">
        {Object.keys(cost).map((resourceId) => {
          const balance = getBalance(entityId || 0, cost[Number(resourceId)].resource);

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

      <div className="pt-2 font-bold uppercase">One Time Cost</div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.keys(buildingCost).map((resourceId, index) => {
          const balance = getBalance(entityId || 0, buildingCost[Number(resourceId)].resource);
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
      {consumedBy.length > 0 && (
        <>
          <div className="pt-1 font-bold uppercase ">Consumed by</div>
          <div className="flex flex-row">
            {React.Children.toArray(
              consumedBy.map((resourceId) => (
                <ResourceIcon key={resourceId} resource={findResourceById(resourceId || 0)?.trait || ""} size="md" />
              )),
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const BuildingInfo = ({
  buildingId,
  entityId,
  name = BuildingEnumToString[buildingId],
  hintModal = false,
  isPaused,
}: {
  buildingId: number;
  entityId: ID | undefined;
  name?: string;
  hintModal?: boolean;
  isPaused?: boolean;
}) => {
  const dojo = useDojo();

  const buildingCost = getBuildingCosts(entityId ?? 0, dojo, buildingId) || [];

  const population = BUILDING_POPULATION[buildingId] || 0;
  const capacity = BUILDING_CAPACITY[buildingId] || 0;
  const resourceProduced = BUILDING_RESOURCE_PRODUCED[buildingId];
  const ongoingCost = RESOURCE_INPUTS_SCALED[resourceProduced] || 0;

  const perTick = RESOURCE_OUTPUTS[resourceProduced] || 0;

  const { getBalance } = getResourceBalance();

  const usedIn = useMemo(() => {
    return getConsumedBy(resourceProduced);
  }, [resourceProduced]);

  return (
    <div className="p-2 text-sm">
      <Headline className="pb-3">
        <div className="flex gap-2">
          <div className="self-center">{name}</div>
          {hintModal && <HintModalButton section={HintSection.Buildings} />}
        </div>
      </Headline>

      {isPaused && <div className="py-3 font-bold">⚠️ Building Production Paused</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          {population !== 0 && (
            <div className="font-bold uppercase">
              <span className="font-bold">Population</span>
              <br />+{population}
            </div>
          )}
          {capacity !== 0 && (
            <div className="pt-3 uppercase">
              <span className="font-bold">Max population capacity</span>
              <br />+{capacity}
            </div>
          )}
        </div>
        {resourceProduced !== 0 && (
          <div className="uppercase">
            <div className="w-full font-bold">Produces</div>
            <div className="flex gap-2">
              +{perTick}
              <ResourceIcon
                className="self-center"
                resource={findResourceById(resourceProduced)?.trait || ""}
                size="md"
              />
              {findResourceById(resourceProduced)?.trait || ""}
            </div>
          </div>
        )}
      </div>

      {ongoingCost && ongoingCost.length ? (
        <>
          <div className="font-bold uppercase">consumed per/s</div>
          <div className="grid grid-cols-2 gap-2">
            {resourceProduced !== 0 &&
              ongoingCost &&
              Object.keys(ongoingCost).map((resourceId, index) => {
                const balance = getBalance(entityId || 0, ongoingCost[Number(resourceId)].resource);
                return (
                  <ResourceCost
                    key={`ongoing-cost-${index}`}
                    type="horizontal"
                    resourceId={ongoingCost[Number(resourceId)].resource}
                    amount={ongoingCost[Number(resourceId)].amount}
                    balance={balance.balance}
                  />
                );
              })}
          </div>
        </>
      ) : null}

      {buildingCost.length !== 0 && (
        <>
          <div className="pt-2 font-bold uppercase">One Time Cost</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.keys(buildingCost).map((resourceId, index) => {
              const balance = getBalance(entityId || 0, buildingCost[Number(resourceId)].resource);
              return (
                <ResourceCost
                  key={`fixed-cost-${index}`}
                  type="horizontal"
                  resourceId={buildingCost[Number(resourceId)].resource}
                  amount={buildingCost[Number(resourceId)].amount}
                  balance={balance.balance}
                />
              );
            })}
          </div>
        </>
      )}

      {usedIn.length > 0 && (
        <>
          <div className="pt-3 pb-1 font-bold uppercase">Consumed by</div>
          <div className="flex flex-row">
            {React.Children.toArray(
              usedIn.map((resourceId) => (
                <ResourceIcon key={resourceId} resource={findResourceById(resourceId || 0)?.trait || ""} size="md" />
              )),
            )}
          </div>
        </>
      )}
    </div>
  );
};

const getConsumedBy = (resourceProduced: ResourcesIds) => {
  return Object.entries(RESOURCE_INPUTS_SCALED)
    .map(([resourceId, inputs]) => {
      const resource = inputs.find(
        (input: { resource: number; amount: number }) => input.resource === resourceProduced,
      );
      if (resource) {
        return Number(resourceId);
      }
    })
    .filter(Boolean);
};

const getResourceBuildingCosts = (realmEntityId: ID, dojo: DojoResult, resourceId: ResourcesIds) => {
  const buildingGeneralConfig = getComponentValue(
    dojo.setup.components.BuildingGeneralConfig,
    getEntityIdFromKeys([WORLD_CONFIG_ID]),
  );

  if (!buildingGeneralConfig) {
    return;
  }
  const buildingType = resourceIdToBuildingCategory(resourceId);

  const buildingQuantity = getBuildingQuantity(
    realmEntityId,
    buildingType ?? 0,
    dojo.setup.components.BuildingQuantityv2,
  );

  let updatedCosts: {
    resource: ResourcesIds;
    amount: number;
  }[] = [];

  RESOURCE_BUILDING_COSTS_SCALED[Number(buildingType)].forEach((cost) => {
    const baseCost = cost.amount;
    const percentageAdditionalCost = (baseCost * (buildingGeneralConfig.base_cost_percent_increase / 100)) / 100;
    const scaleFactor = Math.max(0, buildingQuantity ?? 0 - 1);
    const totalCost = baseCost + scaleFactor * scaleFactor * percentageAdditionalCost;
    updatedCosts.push({ resource: cost.resource, amount: totalCost });
  });
  return updatedCosts;
};

const getBuildingCosts = (realmEntityId: ID, dojo: DojoResult, buildingCategory?: BuildingType) => {
  const buildingGeneralConfig = getComponentValue(
    dojo.setup.components.BuildingGeneralConfig,
    getEntityIdFromKeys([WORLD_CONFIG_ID]),
  );

  if (!buildingGeneralConfig) {
    return;
  }

  const buildingQuantity = getBuildingQuantity(
    realmEntityId,
    buildingCategory ?? 0,
    dojo.setup.components.BuildingQuantityv2,
  );

  let updatedCosts: {
    resource: ResourcesIds;
    amount: number;
  }[] = [];

  BUILDING_COSTS_SCALED[Number(buildingCategory)].forEach((cost) => {
    const baseCost = cost.amount;
    const percentageAdditionalCost = (baseCost * (buildingGeneralConfig.base_cost_percent_increase / 100)) / 100;
    const scaleFactor = Math.max(0, buildingQuantity ?? 0 - 1);
    const totalCost = baseCost + scaleFactor * scaleFactor * percentageAdditionalCost;
    updatedCosts.push({ resource: cost.resource, amount: totalCost });
  });
  return updatedCosts;
};

const getBuildingQuantity = (
  outerEntityId: ID,
  buildingCategory: BuildingType,
  buildingQuantityComponent: Component<ClientComponents["BuildingQuantityv2"]["schema"]>,
) => {
  const buildingQuantity = getComponentValue(
    buildingQuantityComponent,
    getEntityIdFromKeys([BigInt(outerEntityId), BigInt(buildingCategory)]),
  );
  return buildingQuantity?.value;
};

const resourceIdToBuildingCategory = (resourceId: ResourcesIds): BuildingType => {
  if (resourceId === ResourcesIds.Wheat) {
    return BuildingType.Farm;
  }
  if (resourceId === ResourcesIds.Fish) {
    return BuildingType.FishingVillage;
  }
  if (resourceId > 0 && resourceId < 22) {
    return BuildingType.Resource;
  }
  if (resourceId === ResourcesIds.Donkey) {
    return BuildingType.Market;
  }
  if (resourceId === ResourcesIds.Knight) {
    return BuildingType.Barracks;
  }
  if (resourceId === ResourcesIds.Crossbowman) {
    return BuildingType.ArcheryRange;
  }
  if (resourceId === ResourcesIds.Paladin) {
    return BuildingType.Stable;
  }
  return BuildingType.None;
};
