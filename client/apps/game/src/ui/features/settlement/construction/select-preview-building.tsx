import { usePlayResourceSound } from "@/audio";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { BUILDING_IMAGES_PATH } from "@/ui/config";

import { Tabs } from "@/ui/design-system/atoms/tab";
import { Headline } from "@/ui/design-system/molecules/headline";
import { HintModalButton } from "@/ui/design-system/molecules/hint-modal-button";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { formatBiomeBonus } from "@/ui/features/military";
import { HintSection } from "@/ui/features/progression/hints/hint-modal";
import { adjustWonderLordsCost, getEntityIdFromKeys } from "@/ui/utils/utils";

import {
  Biome,
  configManager,
  divideByPrecision,
  getBalance,
  getBlockTimestamp,
  getBuildingCosts,
  getConsumedBy,
  getIsBlitz,
  getRealmInfo,
  hasEnoughPopulationForBuilding,
  ResourceIdToMiningType,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import {
  BiomeType,
  BuildingType,
  BuildingTypeToString,
  CapacityConfig,
  findResourceById,
  getBuildingFromResource,
  ID,
  isEconomyBuilding,
  ResourceMiningTypes,
  ResourcesIds,
  TroopType,
} from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import clsx from "clsx";
import { ChevronDown, ChevronUp, InfoIcon } from "lucide-react";
import React, { useMemo, useState } from "react";

const ARMY_TYPES = ["Archery", "Stable", "Barracks"] as const;
type ArmyTypeLabel = (typeof ARMY_TYPES)[number];

const formatBiomeLabel = (biome: BiomeType | string | null | undefined) => {
  if (!biome) return "";

  const label = biome.toString();
  return label
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
};

export const SelectPreviewBuildingMenu = ({ className, entityId }: { className?: string; entityId: number }) => {
  const dojo = useDojo();

  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const previewBuilding = useUIStore((state) => state.previewBuilding);
  const useSimpleCost = useUIStore((state) => state.useSimpleCost);
  const setUseSimpleCost = useUIStore((state) => state.setUseSimpleCost);

  const realm = getRealmInfo(getEntityIdFromKeys([BigInt(entityId)]), dojo.setup.components);

  const realmBiome = useMemo<BiomeType | null>(() => {
    if (!realm?.position) return null;

    return Biome.getBiome(Number(realm.position.x), Number(realm.position.y)) as BiomeType;
  }, [realm?.position?.x, realm?.position?.y]);

  const biomeRecommendation = useMemo(() => {
    if (!realmBiome) return null;

    const armyOptions: Array<{
      armyType: ArmyTypeLabel;
      troopType: TroopType;
      troopLabel: string;
      resourceName: string;
    }> = [
      {
        armyType: "Archery",
        troopType: TroopType.Crossbowman,
        troopLabel: "Crossbowmen",
        resourceName: "Crossbowman",
      },
      {
        armyType: "Stable",
        troopType: TroopType.Paladin,
        troopLabel: "Paladins",
        resourceName: "Paladin",
      },
      {
        armyType: "Barracks",
        troopType: TroopType.Knight,
        troopLabel: "Knights",
        resourceName: "Knight",
      },
    ];

    const options = armyOptions.map((option) => ({
      ...option,
      bonus: configManager.getBiomeCombatBonus(option.troopType, realmBiome),
    }));

    const bonuses = options.map((option) => option.bonus);
    const maxBonus = Math.max(...bonuses);
    const minBonus = Math.min(...bonuses);
    const best = options.filter((option) => option.bonus === maxBonus);

    return {
      biome: realmBiome,
      options,
      best,
      maxBonus,
      minBonus,
      hasDistinctBest: maxBonus !== minBonus,
    };
  }, [realmBiome]);

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
      key !== "Hyperstructure" &&
      (getIsBlitz() ? key !== "ResourceFish" : true),
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

              const buildingCosts = getBuildingCosts(entityId, dojo.setup.components, building, useSimpleCost);

              if (!buildingCosts || buildingCosts.length === 0) return;

              const hasBalance = checkBalance(buildingCosts);

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

                const buildingCosts = getBuildingCosts(entityId, dojo.setup.components, building, useSimpleCost);

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
            {biomeRecommendation && (
              <div className="border border-gold/20 rounded-md bg-gold/10 p-3">
                <div className="text-[11px] uppercase tracking-wider text-gold/60 font-semibold">Biome Advantage</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gold/80">
                  {biomeRecommendation.hasDistinctBest ? (
                    <>
                      <span>
                        {biomeRecommendation.best.length > 1
                          ? `Best choices for ${formatBiomeLabel(biomeRecommendation.biome)} biome:`
                          : `Best choice for ${formatBiomeLabel(biomeRecommendation.biome)} biome:`}
                      </span>
                      {biomeRecommendation.best.map((option) => (
                        <div
                          key={option.armyType}
                          className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-900/20 px-2 py-1"
                        >
                          <ResourceIcon resource={option.resourceName} size="xs" />
                          <span className="text-emerald-200 font-semibold">{option.armyType}</span>
                          <span className="text-[11px] text-emerald-200">{formatBiomeBonus(option.bonus)}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <span className="text-gold/60">
                      All army types fight equally well in the {formatBiomeLabel(biomeRecommendation.biome)} biome.
                    </span>
                  )}
                </div>
              </div>
            )}
            {ARMY_TYPES.map((armyType) => {
              const militaryBuildings = buildingTypes.filter((a) => {
                const building = BuildingType[a as keyof typeof BuildingType];
                const info = getMilitaryBuildingInfo(building);
                return info && info.type === armyType;
              });

              if (militaryBuildings.length === 0) return null;

              const match = biomeRecommendation?.options.find((option) => option.armyType === armyType);
              const isRecommended = Boolean(
                biomeRecommendation?.hasDistinctBest &&
                  biomeRecommendation.best.some((option) => option.armyType === armyType),
              );

              return (
                <div
                  key={armyType}
                  className={clsx(
                    "border border-gold/20 rounded-md",
                    isRecommended && "border-emerald-500/40 shadow-emerald-500/10",
                  )}
                >
                  <button
                    className={clsx(
                      "flex w-full justify-between items-center p-2 bg-gold/5 cursor-pointer hover:bg-gold/20 transition-colors",
                      isRecommended && "bg-emerald-900/20 hover:bg-emerald-900/30",
                    )}
                    onClick={() => toggleArmyType(armyType)}
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{armyType}</h4>
                      {isRecommended && (
                        <span className="text-[10px] uppercase tracking-wider text-emerald-200 border border-emerald-500/40 bg-emerald-900/40 rounded px-2 py-0.5">
                          Recommended
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {match && (
                        <span
                          className={clsx("text-xs font-semibold", isRecommended ? "text-emerald-200" : "text-gold/60")}
                        >
                          {formatBiomeBonus(match.bonus)}
                        </span>
                      )}
                      <div className="flex items-center text-xs text-gold/70 bg-gold/5 rounded-md px-2 py-0.5">
                        {militaryBuildings[0] &&
                          (() => {
                            const building = BuildingType[militaryBuildings[0] as keyof typeof BuildingType];
                            const info = getMilitaryBuildingInfo(building);
                            if (info?.resourceId) {
                              return (
                                <ResourceIcon
                                  resource={findResourceById(info.resourceId)?.trait || ""}
                                  size="xs"
                                  className="mr-1"
                                />
                              );
                            }
                            return null;
                          })()}
                        {militaryBuildings.length} buildings
                      </div>
                      <div className="ml-2">
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

                          if (!buildingCost || buildingCost?.length === 0) return null;

                          return (
                            <BuildingCard
                              className={clsx("border border-gold/10", {
                                "bg-emerald-900/5": canBuild,
                                "border-emerald-700/5": canBuild,
                                "ring-1 ring-emerald-500/30": isRecommended,
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
    [
      realm,
      entityId,
      selectedTab,
      previewBuilding,
      playResourceSound,
      useSimpleCost,
      expandedTypes,
      biomeRecommendation,
    ],
  );

  return (
    <div className={`${className}`}>
      <div className="flex justify-between items-center px-3 py-2  border-b border-gold/20">
        <h6>Building Costs</h6>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center cursor-pointer">
            <span className={`mr-2 text-xs ${useSimpleCost ? "text-gold/50" : ""}`}>Standard</span>
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={useSimpleCost}
                onChange={() => setUseSimpleCost(!useSimpleCost)}
              />
              <div className="w-9 h-5 bg-brown/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gold after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold/30"></div>
            </div>
            <span className={`ml-2 text-xs ${useSimpleCost ? "" : "text-gold/50"}`}>Simple</span>
          </label>
          <HintModalButton className="" section={HintSection.Buildings} />
        </div>
      </div>

      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: any) => {
          setSelectedTab(index);
        }}
        className="construction-panel-selector h-full mt-2"
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
        " overflow-hidden  text-ellipsis cursor-pointer relative h-36 min-w-20 hover:bg-gold/20 rounded",
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
        <div className="absolute w-full h-full bg-brown/50 p-4 text-xs flex justify-center">
          <div className="self-center flex items-center space-x-2">
            {!hasFunds && <ResourceIcon tooltipText="Need More Resources" resource="Silo" size="lg" />}
            {!hasPopulation && <ResourceIcon tooltipText="Need More Housing" resource="House" size="lg" />}
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <h6 className="truncate">{buildingName}</h6>
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
    <div className="flex flex-col p-3 space-y-3 text-sm  ">
      <Headline className="pb-2 border-b border-gold/20 mb-2 ">
        <div className="flex justify-between items-center w-full gap-3">
          <div className="flex items-center gap-2">
            <ResourceIcon className="self-center" resource={resourceById || ""} size="md" />
            <h6 className="">{resourceById} Production</h6>
          </div>
          {hintModal && <HintModalButton section={HintSection.Buildings} />}
        </div>
      </Headline>

      {isPaused && (
        <div className="py-2 px-3 bg-red/20 text-red-200 rounded font-bold"> ⚠️ Building Production Paused </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {resourceById && (
          <div>
            <h6 className="text-gold/70 text-xs uppercase tracking-wider mb-1">Produces</h6>
            <div className="flex items-center gap-2 mt-1">
              <h6 className="text-lg font-semibold text-green-400">+{amountProducedPerTick}</h6>
              <ResourceIcon className="self-center" resource={resourceById || ""} size="xl" />
              <h6 className="text-gold/80">{resourceById || ""}</h6>
            </div>
          </div>
        )}
        <div>
          {population !== 0 && (
            <div className="mb-2">
              <h6 className="text-gold/70 text-xs uppercase tracking-wider mb-1">Population Cost</h6>
              <h6 className="text-gold text-lg font-semibold">+{population}</h6>
            </div>
          )}

          {capacity !== 0 && (
            <div>
              <h6 className="text-gold/70 text-xs uppercase tracking-wider mb-1">Max Pop. Capacity Grant</h6>
              <h6 className="text-gold text-lg font-semibold">+{capacity}</h6>
            </div>
          )}
        </div>
      </div>

      {Object.keys(cost).length > 0 && (
        <>
          <h6 className="text-gold/70 text-xs uppercase tracking-wider pt-2 border-t border-gold/10">Cost</h6>
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
                  type="horizontal"
                  resourceId={cost[Number(resourceId)].resource}
                  amount={cost[Number(resourceId)].amount}
                  balance={balance.balance}
                  size="lg"
                />
              );
            })}
          </div>
        </>
      )}

      {Object.keys(buildingCost).length > 0 && (
        <>
          <h6 className="text-gold/70 text-xs uppercase tracking-wider pt-2 border-t border-gold/10">
            Building Creation Cost
          </h6>
          <div className="grid grid-cols-2 gap-2">
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
                  type="horizontal"
                  resourceId={buildingCost[Number(resourceId)].resource}
                  amount={buildingCost[Number(resourceId)].amount}
                  balance={balance.balance}
                  size="lg"
                />
              );
            })}
          </div>
        </>
      )}

      {consumedBy.length > 0 && (
        <>
          <h6 className="text-gold/70 text-xs uppercase tracking-wider pt-2 border-t border-gold/10 flex items-center gap-2">
            <ResourceIcon className="self-center" resource={resourceById || ""} size="lg" /> Consumed By
          </h6>
          <div className="flex flex-row space-x-2 mt-1">
            {React.Children.toArray(
              consumedBy.map((resourceId) => (
                <ResourceIcon key={resourceId} resource={findResourceById(resourceId || 0)?.trait || ""} size="sm" />
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
  const resourceProducedName = resourceProduced ? findResourceById(resourceProduced)?.trait : undefined;

  const buildingCost = getBuildingCosts(entityId ?? 0, dojo.setup.components, buildingId, useSimpleCost) || [];

  const buildingPopCapacityConfig = configManager.getBuildingCategoryConfig(buildingId);
  const population = buildingPopCapacityConfig.population_cost;
  const capacity = buildingPopCapacityConfig.capacity_grant;

  const extraStorehouseCapacityKg =
    buildingId === BuildingType.Storehouse ? configManager.getCapacityConfigKg(CapacityConfig.Storehouse) : 0;

  let ongoingCost: any[] = [];
  if (resourceProduced !== undefined) {
    const costs = useSimpleCost
      ? configManager.simpleSystemResourceInputs[resourceProduced]
      : configManager.complexSystemResourceInputs[resourceProduced];
    if (costs) {
      ongoingCost = Object.values(costs); // Convert object to array
    }
  }

  const structure = getComponentValue(dojo.setup.components.Structure, getEntityIdFromKeys([BigInt(entityId || 0)]));

  // Ensure ongoingCost is an array before attempting to use adjustWonderLordsCost
  if (
    buildingId == BuildingType.ResourceDonkey &&
    structure?.metadata.has_wonder &&
    Array.isArray(ongoingCost) &&
    ongoingCost.length > 0
  ) {
    ongoingCost = adjustWonderLordsCost(ongoingCost);
  }

  const perTick =
    resourceProduced !== undefined ? divideByPrecision(configManager.getResourceOutputs(resourceProduced)) || 0 : 0;

  const usedIn = useMemo(() => {
    return getConsumedBy(resourceProduced);
  }, [resourceProduced]);

  return (
    <div className="flex flex-col p-3 space-y-3 text-sm">
      <Headline className="pb-2 border-b border-gold/20 mb-2">
        <div className="flex justify-between items-center w-full gap-3">
          <div className="flex items-center gap-2">
            <h6>{name}</h6>
          </div>
          {hintModal && <HintModalButton section={HintSection.Buildings} />}
        </div>
      </Headline>

      {isPaused && (
        <div className="py-2 px-3 bg-red/20 text-red-200 rounded font-bold"> ⚠️ Building Production Paused </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          {population !== 0 && (
            <div className="mb-2">
              <h6 className="text-gold/70 text-xs uppercase tracking-wider mb-1">Population Cost</h6>
              <span className="text-gold text-lg font-semibold">+{population}</span>
            </div>
          )}
          {capacity !== 0 && (
            <div>
              <h6 className="text-gold/70 text-xs uppercase tracking-wider mb-1">Max Population Grant</h6>
              <span className="text-gold text-lg font-semibold">+{capacity}</span>
            </div>
          )}
        </div>
        <div>
          {extraStorehouseCapacityKg !== 0 && (
            <div className="mb-2">
              <h6 className="text-gold/70 text-xs uppercase tracking-wider mb-1">Max Resource Capacity</h6>
              <span className="text-gold text-lg font-semibold">+{extraStorehouseCapacityKg.toLocaleString()} kg</span>
            </div>
          )}
          {resourceProducedName && perTick !== 0 && (
            <div>
              <h6 className="text-gold/70 text-xs uppercase tracking-wider mb-1">Produced</h6>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-semibold text-green-400">+{perTick}</span>
                <ResourceIcon className="self-center" resource={resourceProducedName} size="sm" />
                <span className="text-gold/80">{resourceProducedName}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {Array.isArray(ongoingCost) && ongoingCost.length > 0 ? (
        <>
          <h6 className="text-gold/70 text-xs uppercase tracking-wider pt-2 border-t border-gold/10">Cost</h6>
          <div className="grid grid-cols-2 gap-2">
            {ongoingCost.map((costItem, index) => {
              if (!costItem || costItem.resource === undefined) return null; // Add check for undefined
              const balance = getBalance(entityId || 0, costItem.resource, currentDefaultTick, dojo.setup.components);
              return (
                <ResourceCost
                  key={`ongoing-cost-${index}`}
                  type="horizontal"
                  className="!text-xs"
                  resourceId={costItem.resource}
                  amount={costItem.amount}
                  balance={balance.balance}
                />
              );
            })}
          </div>
        </>
      ) : resourceProduced !== undefined && !useSimpleCost ? ( // Show only if production exists and not simple mode
        <div className="text-gold/70 italic text-xs pt-2 border-t border-gold/10">
          No ongoing resource costs in this mode.
        </div>
      ) : null}

      {Object.keys(buildingCost).length !== 0 && (
        <>
          <h6 className="text-gold/70 text-xs uppercase tracking-wider pt-2 border-t border-gold/10">
            Building Creation Cost
          </h6>
          <div className="grid grid-cols-2 gap-2">
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
                  className="!text-xs"
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
          <h6 className="text-gold/70 text-xs uppercase tracking-wider pt-2 border-t border-gold/10">Consumed By</h6>
          <div className="flex flex-row space-x-2 mt-1">
            {React.Children.toArray(
              usedIn.map((resourceId) => (
                <ResourceIcon key={resourceId} resource={findResourceById(resourceId || 0)?.trait || ""} size="sm" />
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
