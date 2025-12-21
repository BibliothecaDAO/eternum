import { usePlayResourceSound } from "@/audio";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { formatTimeRemaining } from "@/ui/features/economy/resources/entity-resource-table/utils";

import Button from "@/ui/design-system/atoms/button";
import { Tabs } from "@/ui/design-system/atoms/tab";
import { Headline } from "@/ui/design-system/molecules/headline";
import { HintModalButton } from "@/ui/design-system/molecules/hint-modal-button";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { HintSection } from "@/ui/features/progression/hints/hint-modal";
import { ProductionStatusBadge } from "@/ui/shared";
import { adjustWonderLordsCost, currencyIntlFormat, getEntityIdFromKeys } from "@/ui/utils/utils";

import {
  Biome,
  configManager,
  divideByPrecision,
  getBalance,
  getBlockTimestamp,
  getBuildingCosts,
  getBuildingCount,
  getConsumedBy,
  getIsBlitz,
  getRealmInfo,
  hasEnoughPopulationForBuilding,
  ResourceManager,
  ResourceIdToMiningType,
  TileManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import {
  BUILDINGS_CENTER,
  BiomeType,
  BuildingType,
  BuildingTypeToString,
  findResourceById,
  getBuildingFromResource,
  getNeighborHexes,
  ID,
  isEconomyBuilding,
  ResourceMiningTypes,
  ResourcesIds,
  TroopType,
} from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getComponentValue } from "@dojoengine/recs";
import clsx from "clsx";
import { InfoIcon, Trash } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const ARMY_TYPES = ["Archery", "Stable", "Barracks"] as const;
type ArmyTypeLabel = (typeof ARMY_TYPES)[number];
type ArmyGroup = {
  armyType: ArmyTypeLabel;
  buildings: string[];
  isRecommended: boolean;
  bonus?: number;
};

const buildablePositionsCache = new Map<number, Array<{ col: number; row: number }>>();

const generateBuildablePositions = (radius: number) => {
  const cached = buildablePositionsCache.get(radius);
  if (cached) return cached;
  const positions: Array<{ col: number; row: number }> = [];
  const seen = new Set<string>();

  const addPosition = (col: number, row: number) => {
    const key = `${col},${row}`;
    if (seen.has(key)) return;
    positions.push({ col, row });
    seen.add(key);
  };

  const start = { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] };
  addPosition(start.col, start.row);

  let currentLayer = [start];
  for (let i = 0; i < radius; i++) {
    const nextLayer: Array<{ col: number; row: number }> = [];
    currentLayer.forEach((pos) => {
      getNeighborHexes(pos.col, pos.row).forEach((neighbor) => {
        const key = `${neighbor.col},${neighbor.row}`;
        if (!seen.has(key)) {
          addPosition(neighbor.col, neighbor.row);
          nextLayer.push(neighbor);
        }
      });
    });
    currentLayer = nextLayer;
  }

  buildablePositionsCache.set(radius, positions);
  return positions;
};

type ResourceProductionStatus = {
  resourceId: ResourcesIds;
  isProducing: boolean;
  timeRemainingSeconds: number | null;
  productionPerSecond: number | null;
  outputRemaining: number | null;
  totalBuildings: number;
  activeBuildings: number;
  calculatedAt: number;
};

export const SelectPreviewBuildingMenu = ({ className, entityId }: { className?: string; entityId: number }) => {
  const dojo = useDojo();

  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const [timerTick, setTimerTick] = useState(0);

  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const previewBuilding = useUIStore((state) => state.previewBuilding);
  const useSimpleCost = useUIStore((state) => state.useSimpleCost);
  const setUseSimpleCost = useUIStore((state) => state.setUseSimpleCost);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);

  const realm = getRealmInfo(getEntityIdFromKeys([BigInt(entityId)]), dojo.setup.components);
  const structureBuildings = useComponentValue(
    dojo.setup.components.StructureBuildings,
    getEntityIdFromKeys([BigInt(entityId)]),
  );
  const resourceData = useComponentValue(dojo.setup.components.Resource, getEntityIdFromKeys([BigInt(entityId)]));
  const currentTime = useMemo(() => Date.now(), [timerTick]);
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  const currentDefaultTickRef = useRef(currentDefaultTick);
  currentDefaultTickRef.current = currentDefaultTick;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const interval = window.setInterval(() => setTimerTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const occupiedSpotsRef = useRef<Set<string>>(new Set());
  const vacatedSpotsRef = useRef<Set<string>>(new Set());
  const [pendingBuilds, setPendingBuilds] = useState<Record<string, boolean>>({});
  const [pendingDestroys, setPendingDestroys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    occupiedSpotsRef.current.clear();
    vacatedSpotsRef.current.clear();
  }, [entityId]);

  useEffect(() => {
    if (!realm?.position) return;

    const outerCol = Number(realm.position.x);
    const outerRow = Number(realm.position.y);
    const tileManager = new TileManager(dojo.setup.components, dojo.setup.systemCalls, {
      col: outerCol,
      row: outerRow,
    });

    const occupied = occupiedSpotsRef.current;
    const vacated = vacatedSpotsRef.current;

    Array.from(occupied).forEach((key) => {
      const [col, row] = key.split(",").map(Number);
      if (tileManager.isHexOccupied({ col, row })) {
        occupied.delete(key);
      }
    });

    Array.from(vacated).forEach((key) => {
      const [col, row] = key.split(",").map(Number);
      if (!tileManager.isHexOccupied({ col, row })) {
        vacated.delete(key);
      }
    });
  }, [dojo.setup.components, dojo.setup.systemCalls, realm?.position?.x, realm?.position?.y, structureBuildings]);
  const hasAvailableBuildingTile = useMemo(() => {
    if (!realm?.position) return true;

    const outerCol = Number(realm.position.x);
    const outerRow = Number(realm.position.y);
    const tileManager = new TileManager(dojo.setup.components, dojo.setup.systemCalls, {
      col: outerCol,
      row: outerRow,
    });
    const buildRadius = Math.max(1, Number(tileManager.getRealmLevel(entityId)) + 1);
    const candidates = generateBuildablePositions(buildRadius);
    const centerKey = `${BUILDINGS_CENTER[0]},${BUILDINGS_CENTER[1]}`;
    const occupied = occupiedSpotsRef.current;
    const vacated = vacatedSpotsRef.current;

    return candidates.some((pos) => {
      const key = `${pos.col},${pos.row}`;
      if (key === centerKey) return false;
      if (occupied.has(key)) return false;
      if (vacated.has(key)) return true;
      return !tileManager.isHexOccupied({ col: pos.col, row: pos.row });
    });
  }, [
    dojo.setup.components,
    dojo.setup.systemCalls,
    entityId,
    realm?.position?.x,
    realm?.position?.y,
    pendingBuilds,
    pendingDestroys,
    structureBuildings,
  ]);
  const isRealmFull = !hasAvailableBuildingTile;

  const getBuildingCountFor = useCallback(
    (buildingType: BuildingType) => {
      if (!structureBuildings) return 0;
      const packedCounts = [
        structureBuildings.packed_counts_1 || 0n,
        structureBuildings.packed_counts_2 || 0n,
        structureBuildings.packed_counts_3 || 0n,
      ];
      return getBuildingCount(buildingType, packedCounts) || 0;
    },
    [structureBuildings],
  );

  const handleAutoBuild = useCallback(
    async (target: { type: BuildingType; resource?: ResourcesIds }) => {
      if (!realm?.position) {
        toast.error("Select a realm before building.");
        return;
      }
      const buildingKey = target.type.toString();
      const outerCol = Number(realm.position.x);
      const outerRow = Number(realm.position.y);
      const tileManager = new TileManager(dojo.setup.components, dojo.setup.systemCalls, {
        col: outerCol,
        row: outerRow,
      });
      const occupied = occupiedSpotsRef.current;
      const vacated = vacatedSpotsRef.current;
      let occupiedKey: string | null = null;
      let didBuild = false;

      setPendingBuilds((prev) => ({ ...prev, [buildingKey]: true }));

      try {
        const buildRadius = Math.max(1, Number(tileManager.getRealmLevel(entityId)) + 1);
        const candidates = generateBuildablePositions(buildRadius);
        const centerKey = `${BUILDINGS_CENTER[0]},${BUILDINGS_CENTER[1]}`;

        const availableSpot = candidates.find((pos) => {
          const key = `${pos.col},${pos.row}`;
          if (key === centerKey) return false;
          if (occupied.has(key)) return false;
          if (vacated.has(key)) return true;
          return !tileManager.isHexOccupied({ col: pos.col, row: pos.row });
        });

        if (!availableSpot) {
          toast.error("No empty building tiles available.");
          return;
        }

        occupiedKey = `${availableSpot.col},${availableSpot.row}`;
        occupied.add(occupiedKey);
        vacated.delete(occupiedKey);

        await tileManager.placeBuilding(
          dojo.account.account,
          entityId,
          target.type,
          { col: availableSpot.col, row: availableSpot.row },
          useSimpleCost,
        );
        didBuild = true;

        setPreviewBuilding(null);
        setSelectedBuildingHex({
          outerCol,
          outerRow,
          innerCol: availableSpot.col,
          innerRow: availableSpot.row,
        });
      } catch (error) {
        console.error("Failed to auto-build", error);
        toast.error("Building failed. Please try again.");
      } finally {
        if (occupiedKey && !didBuild) {
          occupied.delete(occupiedKey);
        }
        setPendingBuilds((prev) => {
          const next = { ...prev };
          delete next[buildingKey];
          return next;
        });
      }
    },
    [
      dojo.account.account,
      dojo.setup.components,
      dojo.setup.systemCalls,
      entityId,
      realm?.position,
      setPreviewBuilding,
      setSelectedBuildingHex,
      useSimpleCost,
    ],
  );

  const handleDestroyBuilding = useCallback(
    async (target: { type: BuildingType; resource?: ResourcesIds }) => {
      if (!realm?.position) {
        toast.error("Select a realm before destroying.");
        return;
      }

      const buildingKey = target.type.toString();
      const outerCol = Number(realm.position.x);
      const outerRow = Number(realm.position.y);
      const tileManager = new TileManager(dojo.setup.components, dojo.setup.systemCalls, {
        col: outerCol,
        row: outerRow,
      });

      const existing = tileManager.existingBuildings().find((building) => building.category === target.type);
      if (!existing) {
        toast.error("No building of this type found to destroy.");
        return;
      }

      const occupied = occupiedSpotsRef.current;
      const vacated = vacatedSpotsRef.current;
      const destroyedKey = `${existing.col},${existing.row}`;

      setPendingDestroys((prev) => ({ ...prev, [buildingKey]: true }));

      try {
        await tileManager.destroyBuilding(dojo.account.account, entityId, existing.col, existing.row);
        vacated.add(destroyedKey);
        occupied.delete(destroyedKey);
        if (
          previewBuilding?.type === target.type &&
          (!target.resource || previewBuilding?.resource === target.resource)
        ) {
          setPreviewBuilding(null);
        }
      } catch (error) {
        console.error("Failed to destroy building", error);
        toast.error("Destroy failed. Please try again.");
      } finally {
        setPendingDestroys((prev) => {
          const next = { ...prev };
          delete next[buildingKey];
          return next;
        });
      }
    },
    [
      dojo.account.account,
      dojo.setup.components,
      dojo.setup.systemCalls,
      entityId,
      previewBuilding?.resource,
      previewBuilding?.type,
      realm?.position,
      setPreviewBuilding,
    ],
  );

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

  const isBlitz = getIsBlitz();

  const buildingTypes = useMemo(
    () =>
      Object.keys(BuildingType).filter(
        (key) =>
          isNaN(Number(key)) &&
          key !== "Resource" &&
          key !== "Castle" &&
          key !== "Bank" &&
          key !== "FragmentMine" &&
          key !== "None" &&
          key !== "Settlement" &&
          key !== "Hyperstructure" &&
          key !== "Storehouse" &&
          (isBlitz ? key !== "ResourceFish" : true),
      ),
    [isBlitz],
  );

  const producedResourceIds = useMemo<ResourcesIds[]>(() => {
    const ids = new Set<ResourcesIds>();
    buildingTypes.forEach((key) => {
      const building = BuildingType[key as keyof typeof BuildingType];
      const produced = configManager.getResourceBuildingProduced(building);
      if (produced !== undefined && produced !== null) {
        ids.add(produced as ResourcesIds);
      }
    });
    return Array.from(ids);
  }, [buildingTypes]);

  const productionStatusByResource = useMemo(() => {
    const map = new Map<ResourcesIds, ResourceProductionStatus>();
    if (!resourceData) return map;

    const calculatedAt = Date.now();

    producedResourceIds.forEach((resourceId) => {
      const productionInfo = ResourceManager.balanceAndProduction(resourceData, resourceId);
      if (!productionInfo?.production) return;

      const productionData = ResourceManager.calculateResourceProductionData(
        resourceId,
        productionInfo,
        currentDefaultTick || 0,
      );

      const totalBuildings = Number(productionInfo.production.building_count ?? 0);

      map.set(resourceId, {
        resourceId,
        isProducing: productionData.isProducing,
        timeRemainingSeconds: Number.isFinite(productionData.timeRemainingSeconds)
          ? productionData.timeRemainingSeconds
          : null,
        productionPerSecond: Number.isFinite(productionData.productionPerSecond)
          ? productionData.productionPerSecond
          : null,
        outputRemaining: Number.isFinite(productionData.outputRemaining) ? productionData.outputRemaining : null,
        totalBuildings,
        activeBuildings: productionData.isProducing ? (totalBuildings > 0 ? totalBuildings : 0) : 0,
        calculatedAt,
      });
    });

    return map;
  }, [currentDefaultTick, producedResourceIds, resourceData]);
  const productionStatusByResourceRef = useRef(productionStatusByResource);
  productionStatusByResourceRef.current = productionStatusByResource;

  const armyGroups = useMemo<ArmyGroup[]>(
    () =>
      ARMY_TYPES.reduce<ArmyGroup[]>((acc, armyType) => {
        const buildings = buildingTypes.filter((a) => {
          const building = BuildingType[a as keyof typeof BuildingType];
          const info = getMilitaryBuildingInfo(building);
          return info && info.type === armyType;
        });

        if (buildings.length === 0) {
          return acc;
        }

        const match = biomeRecommendation?.options.find((option) => option.armyType === armyType);
        const isRecommended = Boolean(
          biomeRecommendation?.hasDistinctBest &&
          biomeRecommendation.best.some((option) => option.armyType === armyType),
        );

        acc.push({ armyType, buildings, isRecommended, bonus: match?.bonus });
        return acc;
      }, []),
    [buildingTypes, biomeRecommendation],
  );

  const recommendedArmyType = useMemo<ArmyTypeLabel | null>(() => {
    const recommended = armyGroups.find((group) => group.isRecommended);
    return recommended ? recommended.armyType : null;
  }, [armyGroups]);

  const [selectedTab, setSelectedTab] = useState(1);
  const [selectedArmyType, setSelectedArmyType] = useState<ArmyTypeLabel | null>(null);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (armyGroups.length === 0) {
      if (selectedArmyType !== null) {
        setSelectedArmyType(null);
      }
      return;
    }

    if (selectedArmyType && armyGroups.some((group) => group.armyType === selectedArmyType)) {
      return;
    }

    setSelectedArmyType(recommendedArmyType ?? armyGroups[0].armyType);
  }, [armyGroups, recommendedArmyType, selectedArmyType]);

  const checkBalance = useCallback(
    (cost: any) =>
      Object.keys(cost).every((resourceId) => {
        const resourceCost = cost[Number(resourceId)];
        const balance = getBalance(
          entityId,
          resourceCost.resource,
          currentDefaultTickRef.current,
          dojo.setup.components,
        );
        return divideByPrecision(balance.balance) >= resourceCost.amount;
      }),
    [entityId, dojo.setup.components],
  );

  const activeArmyType = selectedArmyType ?? recommendedArmyType ?? armyGroups[0]?.armyType ?? null;

  const tabs = useMemo(
    () => [
      {
        key: "resources",
        label: (
          <div className="flex relative group flex-col items-center">
            <div className="resource-tab-selector">Resources</div>
          </div>
        ),
        component: () => (
          <div className="resource-cards-selector grid grid-cols-2 gap-2 p-2">
            {realm?.resources.map((resourceId) => {
              const resource = findResourceById(resourceId)!;
              const building = getBuildingFromResource(resourceId);

              const buildingCosts = getBuildingCosts(entityId, dojo.setup.components, building, useSimpleCost);

              if (!buildingCosts) return;

              const hasBalance = checkBalance(buildingCosts);
              const productionStatus = productionStatusByResourceRef.current.get(resourceId as ResourcesIds);

              const hasEnoughPopulation = hasEnoughPopulationForBuilding(realm, building);
              const isLaborLockedResource =
                useSimpleCost &&
                (resourceId === ResourcesIds.Dragonhide ||
                  resourceId === ResourcesIds.Mithral ||
                  resourceId === ResourcesIds.Adamantine);
              const canBuild = !isLaborLockedResource && hasBalance && realm?.hasCapacity && hasEnoughPopulation;
              const disabledReason = isRealmFull
                ? "Realm full"
                : isLaborLockedResource
                  ? "Switch to Resource mode to create this building."
                  : undefined;
              const disabled = isLaborLockedResource || isRealmFull;
              const buildKey = building.toString();
              const isPending = Boolean(pendingBuilds[buildKey]);
              const count = getBuildingCountFor(building);
              const destroyPending = Boolean(pendingDestroys[buildKey]);
              const destroyDisabled = count <= 0 || destroyPending;

              return (
                <BuildingCard
                  key={resourceId}
                  buildingId={building}
                  resourceId={resourceId}
                  onClick={() => {
                    if (!canBuild || isRealmFull) {
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
                  productionStatus={productionStatus}
                  currentTime={currentTimeRef.current}
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
                  disabled={disabled}
                  disabledReason={disabledReason}
                  count={count}
                  onBuild={() => handleAutoBuild({ type: building, resource: resourceId })}
                  buildDisabled={!canBuild || isPending || isRealmFull}
                  buildLoading={isPending}
                  onDestroy={() => handleDestroyBuilding({ type: building, resource: resourceId })}
                  destroyDisabled={destroyDisabled}
                  destroyLoading={destroyPending}
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
        component: () => (
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
                const buildingCosts = getBuildingCosts(entityId, dojo.setup.components, building, useSimpleCost);

                if (!buildingCosts) return;

                const hasBalance = checkBalance(buildingCosts);
                const producedResourceId = configManager.getResourceBuildingProduced(building) as
                  | ResourcesIds
                  | undefined;
                const productionStatus = producedResourceId
                  ? productionStatusByResourceRef.current.get(producedResourceId as ResourcesIds)
                  : undefined;

                const hasEnoughPopulation = hasEnoughPopulationForBuilding(realm, building);
                const canBuild =
                  building === BuildingType.WorkersHut
                    ? hasBalance
                    : hasBalance && realm?.hasCapacity && hasEnoughPopulation;
                const disabledReason = isRealmFull ? "Realm full" : undefined;
                const disabled = Boolean(disabledReason);
                const buildKey = building.toString();
                const isPending = Boolean(pendingBuilds[buildKey]);
                const count = getBuildingCountFor(building);
                const destroyPending = Boolean(pendingDestroys[buildKey]);
                const destroyDisabled = count <= 0 || destroyPending;

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
                    })}
                    key={index}
                    buildingId={building}
                    onClick={() => {
                      if (!canBuild || isRealmFull) {
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
                    isWorkersHut={isWorkersHut}
                    productionStatus={productionStatus}
                    currentTime={currentTimeRef.current}
                    toolTip={<BuildingInfo buildingId={building} entityId={entityId} useSimpleCost={useSimpleCost} />}
                    hasFunds={hasBalance}
                    hasPopulation={hasEnoughPopulation}
                    disabled={disabled}
                    disabledReason={disabledReason}
                    count={count}
                    onBuild={() => handleAutoBuild({ type: building })}
                    buildDisabled={!canBuild || isPending || isRealmFull}
                    buildLoading={isPending}
                    onDestroy={() => handleDestroyBuilding({ type: building })}
                    destroyDisabled={destroyDisabled}
                    destroyLoading={destroyPending}
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
        component: () => {
          if (armyGroups.length === 0) {
            return <div className="p-2 text-xs text-gold/60">No military buildings available.</div>;
          }

          const visibleGroups =
            activeArmyType !== null ? armyGroups.filter((group) => group.armyType === activeArmyType) : armyGroups;

          return (
            <div className="p-2 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {armyGroups.map((group) => {
                  const isActive = activeArmyType === group.armyType;
                  const bonusMultiplier = group.bonus ?? 1;
                  const bonusPercent = Math.round((bonusMultiplier - 1) * 100);
                  const bonusLabel = `${bonusPercent > 0 ? "+" : ""}${bonusPercent}%`;
                  const isPositiveBonus = bonusPercent > 0;
                  const isNegativeBonus = bonusPercent < 0;
                  return (
                    <button
                      key={group.armyType}
                      type="button"
                      className={clsx(
                        "h-8 rounded border px-3 py-1 text-xs transition-colors",
                        isActive
                          ? "border-gold/60 bg-gold/20 text-gold"
                          : "border-gold/30 bg-brown/20 text-gold/70 hover:border-gold/50",
                        group.isRecommended && !isActive && "border-emerald-500/40 text-emerald-200",
                      )}
                      onClick={() => setSelectedArmyType(group.armyType)}
                    >
                      <span className="flex items-center gap-1">
                        <span>{group.armyType}</span>
                        <span
                          className={clsx(
                            "text-[11px] font-semibold",
                            isPositiveBonus ? "text-emerald-300" : isNegativeBonus ? "text-red-400" : "text-gold/80",
                          )}
                        >
                          {bonusLabel}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3">
                {visibleGroups.map((group) => {
                  return (
                    <div
                      key={group.armyType}
                      className={clsx(
                        "border border-gold/15 rounded-md",
                        group.isRecommended && "border-emerald-500/40 shadow-emerald-500/10",
                      )}
                    >
                      <div className="grid grid-cols-2 gap-2 p-2">
                        {group.buildings
                          .slice()
                          .sort((a, b) => {
                            const buildingA = BuildingType[a as keyof typeof BuildingType];
                            const buildingB = BuildingType[b as keyof typeof BuildingType];
                            const infoA = getMilitaryBuildingInfo(buildingA);
                            const infoB = getMilitaryBuildingInfo(buildingB);
                            return (infoA?.tier || 0) - (infoB?.tier || 0);
                          })
                          .map((buildingType, index) => {
                            const building = BuildingType[buildingType as keyof typeof BuildingType];
                            const buildingCost =
                              getBuildingCosts(entityId, dojo.setup.components, building, useSimpleCost) ?? [];
                            const info = getMilitaryBuildingInfo(building);
                            const producedResourceId = configManager.getResourceBuildingProduced(building) as
                              | ResourcesIds
                              | undefined;
                            const productionStatus = producedResourceId
                              ? productionStatusByResourceRef.current.get(producedResourceId as ResourcesIds)
                              : undefined;

                            const hasBalance = checkBalance(buildingCost);
                            const hasEnoughPopulation = hasEnoughPopulationForBuilding(realm, building);
                            const isTierLockedInSimpleMode = useSimpleCost && (info?.tier ?? 0) > 1;
                            const canBuild =
                              !isTierLockedInSimpleMode && hasBalance && realm?.hasCapacity && hasEnoughPopulation;
                            const disabledReason = isRealmFull
                              ? "Realm full"
                              : isTierLockedInSimpleMode && info?.tier
                                ? `Switch to Resource mode to build Tier ${info.tier} military buildings.`
                                : undefined;
                            const buildKey = building.toString();
                            const isPending = Boolean(pendingBuilds[buildKey]);
                            const count = getBuildingCountFor(building);
                            const destroyPending = Boolean(pendingDestroys[buildKey]);
                            const destroyDisabled = count <= 0 || destroyPending;

                            return (
                              <BuildingCard
                                className={clsx("border border-gold/10", {
                                  "bg-emerald-900/5": canBuild,
                                  "border-emerald-700/5": canBuild,
                                  "ring-1 ring-emerald-500/30": group.isRecommended,
                                })}
                                key={index}
                                buildingId={building}
                                onClick={() => {
                                  if (!canBuild || isRealmFull) return;
                                  if (previewBuilding?.type === building) {
                                    setPreviewBuilding(null);
                                  } else {
                                    setPreviewBuilding({ type: building });
                                  }
                                }}
                                active={previewBuilding?.type === building}
                                buildingName={`${BuildingTypeToString[building]}`}
                                resourceName={
                                  ResourcesIds[
                                    configManager.getResourceBuildingProduced(building)
                                  ] as keyof typeof ResourcesIds
                                }
                                productionStatus={productionStatus}
                                currentTime={currentTimeRef.current}
                                toolTip={
                                  <BuildingInfo
                                    buildingId={building}
                                    entityId={entityId}
                                    useSimpleCost={useSimpleCost}
                                  />
                                }
                                hasFunds={hasBalance}
                                hasPopulation={hasEnoughPopulation}
                                disabled={isTierLockedInSimpleMode || isRealmFull}
                                disabledReason={disabledReason}
                                count={count}
                                onBuild={() => handleAutoBuild({ type: building })}
                                buildDisabled={!canBuild || isPending || isRealmFull}
                                buildLoading={isPending}
                                onDestroy={() => handleDestroyBuilding({ type: building })}
                                destroyDisabled={destroyDisabled}
                                destroyLoading={destroyPending}
                              />
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        },
      },
    ],
    [
      realm,
      entityId,
      previewBuilding,
      playResourceSound,
      useSimpleCost,
      armyGroups,
      activeArmyType,
      pendingBuilds,
      pendingDestroys,
      handleAutoBuild,
      handleDestroyBuilding,
      getBuildingCountFor,
      checkBalance,
    ],
  );

  useEffect(() => {
    const currentKey = tabs[selectedTab]?.key;
    if (!currentKey) return;
    setVisitedTabs((prev) => {
      if (prev.has(currentKey)) return prev;
      const next = new Set(prev);
      next.add(currentKey);
      return next;
    });
  }, [selectedTab, tabs]);

  return (
    <div className={`${className}`}>
      <div className="flex justify-between items-center px-3 py-2 gap-3 border-b border-gold/20">
        <h6>Building Costs</h6>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center cursor-pointer">
            <span className={`mr-2 text-xs ${useSimpleCost ? "text-gold/50" : ""}`}>Resource</span>
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={useSimpleCost}
                onChange={() => setUseSimpleCost(!useSimpleCost)}
              />
              <div className="w-9 h-5 bg-brown/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gold after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold/30"></div>
            </div>
            <span className={`ml-2 text-xs ${useSimpleCost ? "" : "text-gold/50"}`}>Labor</span>
          </label>
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
          {tabs.map((tab, index) => {
            const shouldRender = visitedTabs.has(tab.key) || selectedTab === index;
            return <Tabs.Panel key={index}>{shouldRender ? tab.component() : null}</Tabs.Panel>;
          })}
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
  isWorkersHut,
  productionStatus,
  currentTime,
  toolTip,
  hasFunds = true,
  hasPopulation = true,
  resourceId,
  className,
  disabled = false,
  disabledReason,
  badge,
  onBuild,
  buildDisabled,
  buildLoading,
  count = 0,
  onDestroy,
  destroyDisabled,
  destroyLoading,
}: {
  buildingId: BuildingType;
  onClick: () => void;
  active: boolean;
  buildingName: string;
  resourceName?: string;
  isWorkersHut?: boolean;
  productionStatus?: ResourceProductionStatus;
  currentTime?: number;
  toolTip: React.ReactElement;
  hasFunds?: boolean;
  hasPopulation?: boolean;
  resourceId?: ResourcesIds;
  className?: string;
  disabled?: boolean;
  disabledReason?: string;
  badge?: React.ReactNode;
  onBuild?: () => void;
  buildDisabled?: boolean;
  buildLoading?: boolean;
  count?: number;
  onDestroy?: () => void;
  destroyDisabled?: boolean;
  destroyLoading?: boolean;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const isDisabled = disabled;
  const lacksRequirements = !hasFunds || !hasPopulation;
  const showDisabledMessage = isDisabled && disabledReason;
  const effectiveRemainingSeconds =
    productionStatus && currentTime
      ? productionStatus.timeRemainingSeconds !== null
        ? Math.max(productionStatus.timeRemainingSeconds - (currentTime - productionStatus.calculatedAt) / 1000, 0)
        : null
      : (productionStatus?.timeRemainingSeconds ?? null);
  const effectiveOutputRemaining =
    productionStatus &&
    currentTime &&
    productionStatus.outputRemaining !== null &&
    productionStatus.productionPerSecond !== null &&
    Number.isFinite(productionStatus.productionPerSecond)
      ? Math.max(
          productionStatus.outputRemaining -
            ((currentTime - productionStatus.calculatedAt) / 1000) * productionStatus.productionPerSecond,
          0,
        )
      : (productionStatus?.outputRemaining ?? null);
  const outputLabel =
    productionStatus?.isProducing && effectiveOutputRemaining !== null
      ? currencyIntlFormat(effectiveOutputRemaining, Math.abs(effectiveOutputRemaining) >= 1000 ? 1 : 0)
      : undefined;
  const totalProductionBuildings =
    productionStatus && productionStatus.totalBuildings > 0 ? productionStatus.totalBuildings : count;
  const activeProductionBuildings =
    productionStatus?.isProducing && productionStatus.activeBuildings > 0
      ? productionStatus.activeBuildings
      : productionStatus?.isProducing
        ? totalProductionBuildings
        : 0;
  const formattedRemaining =
    productionStatus?.isProducing && effectiveRemainingSeconds !== null
      ? formatTimeRemaining(Math.ceil(effectiveRemainingSeconds))
      : null;
  const productionBadge =
    productionStatus && resourceName ? (
      <ProductionStatusBadge
        resourceLabel={resourceName}
        tooltipText={
          productionStatus.isProducing
            ? `${activeProductionBuildings}/${totalProductionBuildings} producing${
                formattedRemaining ? ` • ${formattedRemaining} left` : ""
              }`
            : `Idle (${totalProductionBuildings} building${totalProductionBuildings !== 1 ? "s" : ""})`
        }
        isProducing={productionStatus.isProducing}
        timeRemainingSeconds={effectiveRemainingSeconds}
        size="md"
        showTooltip={false}
        cornerTopLeft={totalProductionBuildings > 0 ? `${totalProductionBuildings}` : undefined}
        cornerTopRight={outputLabel}
        cornerBottomRight={formattedRemaining ?? undefined}
      />
    ) : null;

  const handleClick = () => {
    if (isDisabled) return;
    onClick();
  };

  return (
    <div
      onClick={handleClick}
      className={clsx(
        "overflow-hidden text-ellipsis cursor-pointer relative h-36 min-w-20 hover:bg-gold/20 rounded",
        {
          "!border-lightest": active,
          "cursor-not-allowed hover:bg-gold/10": isDisabled,
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
      <div className="absolute top-2 left-2 right-2 z-10 flex items-start justify-between gap-2">
        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            disabled={Boolean(buildDisabled || isDisabled || lacksRequirements)}
            onClick={(event) => {
              event.stopPropagation();
              if (buildDisabled || isDisabled || lacksRequirements) return;
              onBuild?.();
            }}
            className={clsx(
              "flex items-center justify-center rounded-md border border-amber-500/80 bg-amber-400/90 px-2.5 py-1 text-[10px] font-semibold text-black shadow transition",
              !buildDisabled && !isDisabled && !lacksRequirements && "hover:translate-y-[-1px] hover:bg-amber-300",
              (buildDisabled || isDisabled || lacksRequirements) && "opacity-60 cursor-not-allowed",
            )}
          >
            {buildLoading ? "…" : "Build"}
          </button>
          {onDestroy && (
            <button
              type="button"
              disabled={Boolean(destroyDisabled)}
              onClick={(event) => {
                event.stopPropagation();
                if (destroyDisabled) return;
                onDestroy();
              }}
              className={clsx(
                "flex items-center justify-center rounded-md border border-red-700/80 bg-red-900/90 px-2.5 py-1 text-[10px] font-semibold text-white shadow transition",
                !destroyDisabled && "hover:translate-y-[-1px] hover:bg-red-800",
                destroyDisabled && "opacity-60 cursor-not-allowed",
              )}
              aria-label="Destroy building"
            >
              {destroyLoading ? "…" : <Trash className="w-3 h-3" />}
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isWorkersHut && (
            <span className="inline-flex items-center justify-center rounded-full bg-black/80 px-2 py-0.5 text-[10px] font-semibold text-gold/90 shadow-md border border-gold/30">
              {count}
            </span>
          )}
          {productionBadge ||
            (resourceName && (
              <div className="rounded p-1 bg-brown/40">
                <ResourceIcon withTooltip={false} resource={resourceName} size="lg" />
              </div>
            ))}
          {badge && <div>{badge}</div>}
        </div>
      </div>
      {(lacksRequirements || showDisabledMessage) && (
        <div className="absolute inset-0 bg-brown/60 p-4 text-xs flex justify-center text-center">
          {showDisabledMessage ? (
            <div className="self-center text-gold/90 leading-tight">{disabledReason}</div>
          ) : (
            <div className="self-center flex items-center space-x-2">
              {!hasFunds && <ResourceIcon tooltipText="Need More Resources" resource="Silo" size="lg" />}
              {!hasPopulation && <ResourceIcon tooltipText="Need More Housing" resource="House" size="lg" />}
            </div>
          )}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 p-2 space-y-2">
        <div className="flex items-center justify-between">
          <h6 className="truncate text-left">{buildingName}</h6>
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
            className="w-4 h-4"
          />
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
          {resourceProducedName && perTick !== 0 && (
            <div>
              <h6 className="text-gold/70 text-xs uppercase tracking-wider mb-1">Produced</h6>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-semibold text-green-400">+{perTick}</span>
                <ResourceIcon withTooltip={false} className="self-center" resource={resourceProducedName} size="sm" />
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
      ) : resourceProduced !== undefined && !useSimpleCost ? ( // Show only if production exists and not labor mode
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
