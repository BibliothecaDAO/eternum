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
  hasEnoughPopulationForBuilding,
  ID,
  isEconomyBuilding,
  ResourceIdToMiningType,
  ResourceMiningTypes,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import clsx from "clsx";
import { ChevronDown, ChevronUp, InfoIcon } from "lucide-react";
import React, { useMemo, useState } from "react";

export const SelectPreviewBuildingMenu = ({ className, entityId }: { className?: string; entityId: number }) => {
  const dojo = useDojo();

  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const previewBuilding = useUIStore((state) => state.previewBuilding);
  const useSimpleCost = useUIStore((state) => state.useSimpleCost);
  const setUseSimpleCost = useUIStore((state) => state.setUseSimpleCost);

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

  // Add this state for expanded sections
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});

  const toggleArmyType = (armyType: string) => {
    setExpandedTypes((prev) => ({
      ...prev,
      [armyType]: !prev[armyType],
    }));
  };

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

              const complexBuildingCosts = getBuildingCosts(entityId, dojo.setup.components, building, useSimpleCost);
              if (!complexBuildingCosts) return;
              const cost = [...complexBuildingCosts, ...configManager.complexSystemResourceInputs[resourceId]];

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
                  toolTip={
                    <ResourceInfo
                      buildingId={building}
                      resourceId={resourceId}
                      entityId={entityId}
                      useSimpleCost={useSimpleCost}
                    />
                  }
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
              .sort((a, b) => {
                const buildingA = BuildingType[a as keyof typeof BuildingType];
                const buildingB = BuildingType[b as keyof typeof BuildingType];

                if (buildingA === BuildingType.ResourceWheat) return -1;
                if (buildingB === BuildingType.ResourceWheat) return 1;
                if (buildingA === BuildingType.ResourceFish) return -1;
                if (buildingB === BuildingType.ResourceFish) return 1;
                return 0;
              })
              .map((buildingType, index) => {
                const building = BuildingType[buildingType as keyof typeof BuildingType];

                const isWorkersHut = building === BuildingType.WorkersHut;
                const isStorehouse = building === BuildingType.Storehouse;

                const complexBuildingCosts = getBuildingCosts(entityId, dojo.setup.components, building, useSimpleCost);

                if (!complexBuildingCosts) return;

                const hasBalance = checkBalance(complexBuildingCosts);
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
                      configManager.getResourceBuildingProduced(building)
                        ? (ResourcesIds[
                            configManager.getResourceBuildingProduced(building)
                          ] as keyof typeof ResourcesIds)
                        : undefined
                    }
                    toolTip={<BuildingInfo buildingId={building} entityId={entityId} useSimpleCost={useSimpleCost} />}
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
          <div className="p-2 space-y-2">
            {["Archery", "Stable", "Barracks"].map((armyType) => {
              const militaryBuildings = buildingTypes.filter((a) => {
                const building = BuildingType[a as keyof typeof BuildingType];
                const info = getMilitaryBuildingInfo(building);
                return info && info.type === armyType;
              });

              if (militaryBuildings.length === 0) return null;

              return (
                <div key={armyType} className="border border-gold/20 rounded-md">
                  <button
                    className="flex w-full justify-between items-center p-2 bg-gold/10 cursor-pointer hover:bg-gold/20 transition-colors"
                    onClick={() => toggleArmyType(armyType)}
                  >
                    <div className="flex items-center">
                      <h4 className="text-gold font-medium">{armyType}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center text-xs text-gold/70 bg-gold/10 rounded-md px-2 py-0.5">
                        {militaryBuildings.map((buildingType, idx) => {
                          const building = BuildingType[buildingType as keyof typeof BuildingType];
                          const info = getMilitaryBuildingInfo(building);
                          if (info?.resourceId) {
                            return (
                              <ResourceIcon
                                key={idx}
                                resource={findResourceById(info.resourceId)?.trait || ""}
                                size="xs"
                                className="mr-1"
                              />
                            );
                          }
                          return null;
                        })}
                        {militaryBuildings.length} buildings
                      </div>
                      <div className="text-gold ml-2">
                        {expandedTypes[armyType] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </button>

                  {expandedTypes[armyType] && (
                    <div className="grid grid-cols-2 gap-2 p-2">
                      {militaryBuildings
                        .sort((a, b) => {
                          const buildingA = BuildingType[a as keyof typeof BuildingType];
                          const buildingB = BuildingType[b as keyof typeof BuildingType];
                          const infoA = getMilitaryBuildingInfo(buildingA);
                          const infoB = getMilitaryBuildingInfo(buildingB);
                          return (infoA?.tier || 0) - (infoB?.tier || 0);
                        })
                        .map((buildingType, index) => {
                          const building = BuildingType[buildingType as keyof typeof BuildingType];
                          const buildingCost = getBuildingCosts(
                            entityId,
                            dojo.setup.components,
                            building,
                            useSimpleCost,
                          );
                          const info = getMilitaryBuildingInfo(building);

                          const hasBalance = checkBalance(buildingCost);
                          const hasEnoughPopulation = hasEnoughPopulationForBuilding(realm, building);
                          const canBuild = hasBalance && realm?.hasCapacity && hasEnoughPopulation;

                          return (
                            <BuildingCard
                              className={clsx("border border-gold/10", {
                                "bg-emerald-900/20": canBuild,
                                "border-emerald-700/50": canBuild,
                              })}
                              key={index}
                              buildingId={building}
                              onClick={() => {
                                if (!canBuild) return;
                                if (previewBuilding?.type === building) {
                                  setPreviewBuilding(null);
                                } else {
                                  setPreviewBuilding({ type: building });
                                }
                              }}
                              active={previewBuilding?.type === building}
                              buildingName={`${BuildingTypeToString[building]} (T${info?.tier})`}
                              resourceName={
                                ResourcesIds[
                                  configManager.getResourceBuildingProduced(building)
                                ] as keyof typeof ResourcesIds
                              }
                              toolTip={
                                <BuildingInfo buildingId={building} entityId={entityId} useSimpleCost={useSimpleCost} />
                              }
                              hasFunds={hasBalance}
                              hasPopulation={hasEnoughPopulation}
                            />
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ),
      },
    ],
    [realm, entityId, selectedTab, previewBuilding, playResourceSound, useSimpleCost],
  );

  return (
    <div className={`${className}`}>
      <div className="flex justify-between items-center px-3 py-2 bg-brown/30 border-b border-gold/20">
        <div className="text-gold text-sm font-medium">Building Costs</div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center cursor-pointer">
            <span className={`mr-2 text-xs ${useSimpleCost ? "text-gold/50" : "text-gold"}`}>Pro</span>
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={useSimpleCost}
                onChange={() => setUseSimpleCost(!useSimpleCost)}
              />
              <div className="w-9 h-5 bg-brown/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gold after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold/30"></div>
            </div>
            <span className={`ml-2 text-xs ${useSimpleCost ? "text-gold" : "text-gold/50"}`}>Lite</span>
          </label>
          <HintModalButton className="" section={HintSection.Buildings} />
        </div>
      </div>

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
  useSimpleCost = false,
}: {
  resourceId: ResourcesIds;
  buildingId: BuildingType;
  entityId: ID | undefined;
  isPaused?: boolean;
  hintModal?: boolean;
  useSimpleCost?: boolean;
}) => {
  const dojo = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  let cost = useSimpleCost
    ? configManager.simpleSystemResourceInputs[resourceId]
    : configManager.complexSystemResourceInputs[resourceId];

  const structure = getComponentValue(dojo.setup.components.Structure, getEntityIdFromKeys([BigInt(entityId || 0)]));
  if (resourceId == ResourcesIds.Donkey && structure?.metadata.has_wonder) {
    cost = adjustWonderLordsCost(cost);
  }

  const structureBuildings = useComponentValue(
    dojo.setup.components.StructureBuildings,
    getEntityIdFromKeys([BigInt(entityId || 0)]),
  );

  const buildingCost = useMemo(() => {
    return getBuildingCosts(entityId ?? 0, dojo.setup.components, buildingId, useSimpleCost) ?? [];
  }, [entityId, dojo.setup.components, buildingId, structureBuildings, useSimpleCost]);

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
  useSimpleCost = false,
}: {
  buildingId: BuildingType;
  entityId: ID | undefined;
  name?: string;
  hintModal?: boolean;
  isPaused?: boolean;
  useSimpleCost?: boolean;
}) => {
  const dojo = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const resourceProduced = configManager.getResourceBuildingProduced(buildingId);

  const buildingCost = getBuildingCosts(entityId ?? 0, dojo.setup.components, buildingId, useSimpleCost) || [];

  const buildingPopCapacityConfig = configManager.getBuildingCategoryConfig(buildingId);
  const population = buildingPopCapacityConfig.population_cost;
  const capacity = buildingPopCapacityConfig.capacity_grant;

  const extraStorehouseCapacityKg =
    buildingId === BuildingType.Storehouse ? configManager.getCapacityConfigKg(CapacityConfig.Storehouse) : 0;

  let ongoingCost =
    resourceProduced !== undefined
      ? (useSimpleCost
          ? configManager.simpleSystemResourceInputs[resourceProduced]
          : configManager.complexSystemResourceInputs[resourceProduced]) || []
      : [];

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
        {extraStorehouseCapacityKg !== 0 && (
          <div>
            <span className="w-full font-bold uppercase">Max resource capacity</span>
            <br />+{extraStorehouseCapacityKg.toLocaleString()} kg
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

// Helper function to determine military building type and tier
const getMilitaryBuildingInfo = (building: BuildingType) => {
  // Check for Crossbowman buildings
  if (building === BuildingType.ResourceCrossbowmanT1)
    return { type: "Archery", tier: 1, resourceId: ResourcesIds.Crossbowman };
  if (building === BuildingType.ResourceCrossbowmanT2)
    return { type: "Archery", tier: 2, resourceId: ResourcesIds.CrossbowmanT2 };
  if (building === BuildingType.ResourceCrossbowmanT3)
    return { type: "Archery", tier: 3, resourceId: ResourcesIds.CrossbowmanT3 };

  // Check for Paladin buildings
  if (building === BuildingType.ResourcePaladinT1) return { type: "Stable", tier: 1, resourceId: ResourcesIds.Paladin };
  if (building === BuildingType.ResourcePaladinT2)
    return { type: "Stable", tier: 2, resourceId: ResourcesIds.PaladinT2 };
  if (building === BuildingType.ResourcePaladinT3)
    return { type: "Stable", tier: 3, resourceId: ResourcesIds.PaladinT3 };

  // Check for Knight buildings
  if (building === BuildingType.ResourceKnightT1) return { type: "Barracks", tier: 1, resourceId: ResourcesIds.Knight };
  if (building === BuildingType.ResourceKnightT2)
    return { type: "Barracks", tier: 2, resourceId: ResourcesIds.KnightT2 };
  if (building === BuildingType.ResourceKnightT3)
    return { type: "Barracks", tier: 3, resourceId: ResourcesIds.KnightT3 };

  return null;
};
