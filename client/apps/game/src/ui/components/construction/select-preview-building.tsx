import { usePlayResourceSound } from "@/hooks/helpers/use-ui-sound";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { HintSection } from "@/ui/components/hints/hint-modal";
import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { Headline } from "@/ui/elements/headline";
import { HintModalButton } from "@/ui/elements/hint-modal-button";
import { ResourceCost } from "@/ui/elements/resource-cost";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { Tabs } from "@/ui/elements/tab";
import { adjustWonderLordsCost, getEntityIdFromKeys } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  BuildingType,
  BuildingTypeToString,
  CapacityConfig,
  configManager,
  divideByPrecision,
  findResourceById,
  getBalance,
  getBuildingCosts,
  getBuildingFromResource,
  getConsumedBy,
  getRealmInfo,
  gramToKg,
  hasEnoughPopulationForBuilding,
  ID,
  isEconomyBuilding,
  isMilitaryBuilding,
  ResourceIdToMiningType,
  ResourceMiningTypes,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import clsx from "clsx";
import { InfoIcon } from "lucide-react";
import React, { useMemo, useState } from "react";

export const SelectPreviewBuildingMenu = ({ className, entityId }: { className?: string; entityId: number }) => {
  const dojo = useDojo();

  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const previewBuilding = useUIStore((state) => state.previewBuilding);

  const realm = getRealmInfo(getEntityIdFromKeys([BigInt(entityId)]), dojo.setup.components);

  const { playResourceSound } = usePlayResourceSound();

  const buildingTypes = Object.keys(BuildingType).filter(
    (key) =>
      isNaN(Number(key)) &&
      key !== "Resource" &&
      key !== "Castle" &&
      key !== "Bank" &&
      key !== "FragmentMine" &&
      key !== "None" &&
      key !== "Settlement" &&
      key !== "Hyperstructure",
  );

  const checkBalance = (cost: any) =>
    Object.keys(cost).every((resourceId) => {
      const resourceCost = cost[Number(resourceId)];
      const balance = getBalance(entityId, resourceCost.resource, currentDefaultTick, dojo.setup.components);
      return divideByPrecision(balance.balance) >= resourceCost.amount;
    });

  const [selectedTab, setSelectedTab] = useState(1);

  const tabs = useMemo(
    () => [
      {
        key: "resources",
        label: (
          <div className="flex relative group flex-col items-center">
            <div className="resource-tab-selector">Resources</div>
          </div>
        ),
        component: (
          <div className="resource-cards-selector grid grid-cols-2 gap-2 p-2">
            {realm?.resources.map((resourceId) => {
              const resource = findResourceById(resourceId)!;
              const building = getBuildingFromResource(resourceId);

              const buildingCosts = getBuildingCosts(entityId, dojo.setup.components, building);
              if (!buildingCosts) return;
              const cost = [...buildingCosts, ...configManager.resourceInputs[resourceId]];

              const hasBalance = checkBalance(cost);

              const hasEnoughPopulation = hasEnoughPopulationForBuilding(
                realm,
                configManager.getBuildingCategoryConfig(building).population_cost,
              );

              const canBuild = hasBalance && realm?.hasCapacity && hasEnoughPopulation;

              return (
                <BuildingCard
                  key={resourceId}
                  buildingId={building}
                  resourceId={resourceId}
                  onClick={() => {
                    if (!canBuild) {
                      return;
                    }
                    if (previewBuilding?.type === building && previewBuilding?.resource === resourceId) {
                      setPreviewBuilding(null);
                    } else {
                      setPreviewBuilding({ type: building, resource: resourceId });
                      playResourceSound(resourceId);
                    }
                  }}
                  active={previewBuilding?.resource === resourceId}
                  buildingName={resource?.trait}
                  resourceName={resource?.trait}
                  toolTip={<ResourceInfo buildingId={building} resourceId={resourceId} entityId={entityId} />}
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
          <div className="economy-tab-selector flex relative group flex-col items-center">
            <div>Economic</div>
          </div>
        ),
        component: (
          <div className="economy-selector grid grid-cols-2 gap-2 p-2">
            {buildingTypes
              .filter((a) => isEconomyBuilding(BuildingType[a as keyof typeof BuildingType]))
              .map((buildingType, index) => {
                const building = BuildingType[buildingType as keyof typeof BuildingType];

                const isWorkersHut = building === BuildingType.WorkersHut;
                const isStorehouse = building === BuildingType.Storehouse;

                const buildingCosts = getBuildingCosts(entityId, dojo.setup.components, building);

                if (!buildingCosts) return;

                const hasBalance = checkBalance(buildingCosts);
                const hasEnoughPopulation = hasEnoughPopulationForBuilding(realm, building);
                const canBuild =
                  building === BuildingType.WorkersHut
                    ? hasBalance
                    : hasBalance && realm?.hasCapacity && hasEnoughPopulation;

                const isFarm = building === BuildingType.ResourceWheat;
                const isFishingVillage = building === BuildingType.ResourceFish;
                const isMarket = building === BuildingType.ResourceDonkey;

                return (
                  <BuildingCard
                    className={clsx({
                      "farm-card-selector": isFarm,
                      "fish-card-selector": isFishingVillage,
                      "workers-hut-card-selector": isWorkersHut,
                      "market-card-selector": isMarket,
                      "storehouse-card-selector": isStorehouse,
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
                        if (building === BuildingType.ResourceWheat) {
                          playResourceSound(ResourcesIds.Wheat);
                        }
                        if (building === BuildingType.ResourceFish) {
                          playResourceSound(ResourcesIds.Fish);
                        }
                      }
                    }}
                    active={previewBuilding?.type === building}
                    buildingName={BuildingTypeToString[building]}
                    resourceName={
                      isFishingVillage
                        ? ResourcesIds[ResourcesIds.Fish]
                        : isFarm
                          ? ResourcesIds[ResourcesIds.Wheat]
                          : undefined
                    }
                    toolTip={<BuildingInfo buildingId={building} entityId={entityId} />}
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
          <div className="military-tab-selector flex relative group flex-col items-center">
            <div>Military</div>
          </div>
        ),
        component: (
          <div className="grid grid-cols-2 gap-2 p-2">
            {" "}
            {buildingTypes
              .filter((a) => isMilitaryBuilding(BuildingType[a as keyof typeof BuildingType]))
              .map((buildingType, index) => {
                const building = BuildingType[buildingType as keyof typeof BuildingType];
                const buildingCost = getBuildingCosts(entityId, dojo.setup.components, building);

                const hasBalance = checkBalance(buildingCost);

                const hasEnoughPopulation = hasEnoughPopulationForBuilding(realm, building);
                const canBuild = hasBalance && realm?.hasCapacity && hasEnoughPopulation;

                const isBarracks = building === BuildingType.ResourceKnightT1;
                const isArcheryRange = building === BuildingType.ResourceCrossbowmanT1;
                const isStable = building === BuildingType.ResourcePaladinT1;

                return (
                  <BuildingCard
                    className={clsx({
                      "barracks-card-selector": isBarracks,
                      "archery-card-selector": isArcheryRange,
                      "stable-card-selector": isStable,
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
                    buildingName={BuildingTypeToString[building]}
                    resourceName={
                      ResourcesIds[configManager.getResourceBuildingProduced(building)] as keyof typeof ResourcesIds
                    }
                    toolTip={<BuildingInfo buildingId={building} entityId={entityId} />}
                    hasFunds={hasBalance}
                    hasPopulation={hasEnoughPopulation}
                  />
                );
              })}
          </div>
        ),
      },
    ],
    [realm, entityId, selectedTab, previewBuilding, playResourceSound],
  );

  return (
    <div className={`${className}`}>
      <HintModalButton className="absolute top-1 right-1" section={HintSection.Buildings} />
      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: any) => {
          setSelectedTab(index);
        }}
        className="construction-panel-selector h-full"
      >
        <Tabs.List className="construction-tabs-selector">
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
        "text-gold bg-brown/30 overflow-hidden text-ellipsis cursor-pointer relative h-36 min-w-20 hover:bg-gold/20 rounded-xl",
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
        <div className="absolute w-full h-full bg-brown/70 p-4 text-xs flex justify-center">
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
        <div className="rounded p-1 bg-brown/10">
          {resourceName && <ResourceIcon withTooltip={false} resource={resourceName} size="lg" />}
        </div>
      </div>
    </div>
  );
};

export const ResourceInfo = ({
  resourceId,
  buildingId,
  entityId,
  isPaused,
  hintModal = false,
}: {
  resourceId: ResourcesIds;
  buildingId: BuildingType;
  entityId: ID | undefined;
  isPaused?: boolean;
  hintModal?: boolean;
}) => {
  const dojo = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  let cost = configManager.resourceInputs[resourceId];

  const structure = getComponentValue(dojo.setup.components.Structure, getEntityIdFromKeys([BigInt(entityId || 0)]));
  if (resourceId == ResourcesIds.Donkey && structure?.metadata.has_wonder) {
    cost = adjustWonderLordsCost(cost);
  }

  const structureBuildings = useComponentValue(
    dojo.setup.components.StructureBuildings,
    getEntityIdFromKeys([BigInt(entityId || 0)]),
  );

  const buildingCost = useMemo(() => {
    return getBuildingCosts(entityId ?? 0, dojo.setup.components, buildingId) ?? [];
  }, [entityId, dojo.setup.components, buildingId, structureBuildings]);

  const buildingPopCapacityConfig = configManager.getBuildingCategoryConfig(buildingId);
  const population = buildingPopCapacityConfig.population_cost;
  const capacity = buildingPopCapacityConfig.capacity_grant;

  const amountProducedPerTick = divideByPrecision(configManager.getResourceOutputs(resourceId));

  const consumedBy = useMemo(() => {
    return getConsumedBy(resourceId);
  }, [resourceId]);

  const resourceById = useMemo(() => {
    return findResourceById(resourceId)?.trait;
  }, [resourceId]);

  return (
    <div className="flex flex-col text-gold text-sm p-2 space-y-1">
      <Headline className="pb-3">
        <div className=" flex gap-4">
          <ResourceIcon className="self-center" resource={resourceById || ""} size="md" /> <div>Building </div>
          {hintModal && <HintModalButton section={HintSection.Buildings} />}
        </div>{" "}
      </Headline>

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

        {resourceById && (
          <div className="uppercase">
            <div className="w-full font-bold">Produces</div>

            <div className="flex gap-2">
              + {amountProducedPerTick}
              <ResourceIcon className="self-center" resource={resourceById || ""} size="md" />
              {resourceById || ""} per/s
            </div>
          </div>
        )}
      </div>

      <div className="font-bold uppercase">consumed per/s</div>
      <div className="grid grid-cols-2 gap-2">
        {Object.keys(cost).map((resourceId) => {
          const balance = getBalance(
            entityId || 0,
            cost[Number(resourceId)].resource,
            currentDefaultTick,
            dojo.setup.components,
          );

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

      <div className="pt-2 font-bold uppercase">Building Creation Cost</div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.keys(buildingCost).map((resourceId, index) => {
          const balance = getBalance(
            entityId || 0,
            buildingCost[Number(resourceId)].resource,
            currentDefaultTick,
            dojo.setup.components,
          );
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
  name = BuildingTypeToString[buildingId as keyof typeof BuildingTypeToString],
  hintModal = false,
  isPaused,
}: {
  buildingId: BuildingType;
  entityId: ID | undefined;
  name?: string;
  hintModal?: boolean;
  isPaused?: boolean;
}) => {
  const dojo = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const resourceProduced = configManager.getResourceBuildingProduced(buildingId);

  const buildingCost = getBuildingCosts(entityId ?? 0, dojo.setup.components, buildingId) || [];

  const buildingPopCapacityConfig = configManager.getBuildingCategoryConfig(buildingId);
  const population = buildingPopCapacityConfig.population_cost;
  const capacity = buildingPopCapacityConfig.capacity_grant;

  const carryCapacity =
    buildingId === BuildingType.Storehouse ? configManager.getCapacityConfig(CapacityConfig.Storehouse) : 0;

  let ongoingCost = resourceProduced !== undefined ? configManager.resourceInputs[resourceProduced] || [] : [];

  const structure = getComponentValue(dojo.setup.components.Structure, getEntityIdFromKeys([BigInt(entityId || 0)]));

  if (buildingId == BuildingType.ResourceDonkey && structure?.metadata.has_wonder && ongoingCost.length > 0) {
    ongoingCost = adjustWonderLordsCost(ongoingCost);
  }

  const perTick =
    resourceProduced !== undefined ? divideByPrecision(configManager.getResourceOutputs(resourceProduced)) || 0 : 0;

  const usedIn = useMemo(() => {
    return getConsumedBy(resourceProduced);
  }, [resourceProduced]);

  return (
    <div className="flex flex-col text-gold text-sm p-2 space-y-1">
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
        {carryCapacity !== 0 && (
          <div>
            <span className="w-full font-bold uppercase">Max resource capacity</span>
            <br />+{gramToKg(carryCapacity).toLocaleString()} kg
          </div>
        )}
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

      {ongoingCost.length > 0 ? (
        <>
          <div className="font-bold uppercase">consumed per/s</div>
          <div className="grid grid-cols-2 gap-2">
            {resourceProduced !== 0 &&
              Object.keys(ongoingCost).map((resourceId, index) => {
                const balance = getBalance(
                  entityId || 0,
                  ongoingCost[Number(resourceId)].resource,
                  currentDefaultTick,
                  dojo.setup.components,
                );
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
          <div className="pt-2 font-bold uppercase">Building Creation Cost</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.keys(buildingCost).map((resourceId, index) => {
              const balance = getBalance(
                entityId || 0,
                buildingCost[Number(resourceId)].resource,
                currentDefaultTick,
                dojo.setup.components,
              );
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
