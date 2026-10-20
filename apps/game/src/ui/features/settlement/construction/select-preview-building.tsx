import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useStoredBiome } from "@/hooks/helpers/use-tile-at";
import { useCompactLane } from "@/hooks/helpers/use-compact-hud";
import { CompactBuildingCard } from "./compact-building-card";
import { getConstructionBuildingGroups } from "./construction-groups";
import { usePlayResourceSound } from "@/audio";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useLiveTooltip } from "@/hooks/store/use-tooltip-store";
import { AudioManager } from "@/audio/core/AudioManager";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { BuildingThumbnail } from "./building-thumbnail";
import { productionTimeLeft } from "@/ui/features/economy/resources/entity-resource-table/utils";

import { HudCard, HudChip, HudIconButton, HudPanel, HudSwitch, HudTabs } from "@/ui/design-system/kit/hud-elements";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ProductionStatusBadge } from "@/ui/shared";
import { resolveConstructionBuildability } from "@bibliothecadao/eternum/automation";
import { resolveBuildingRequirements } from "./construction-groups";
import { type ResourceRequirement } from "@/ui/design-system/molecules/requirement-chips";
import { buildRealmBuilding, resolveRealmHasAvailableBuildingTile } from "./realm-build-actions";
import { describeBuildingGives } from "./building-gives";
import { BuildingHover } from "./building-hover";
import {
  buildRealmBuildingSummary,
  getMilitaryBuildingInfo,
  MILITARY_BUILDING_GROUP_ORDER,
  RealmBuildingSummary,
} from "./realm-building-summary";

import {
  configManager,
  divideByPrecision,
  getBuildingCount,
  getRealmInfo,
  ResourceManager,
  resolveUseSimpleCost,
} from "@bibliothecadao/eternum";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { useGame } from "@/hooks/context/game-context";
import { useQuery } from "@/hooks/helpers/use-query";
import { useNativeRow, useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import {
  BuildingType,
  buildingName,
  getBuildingFromResource,
  ID,
  isEconomyBuilding,
  ResourcesIds,
  TroopType,
  formatAmount,
  formatPercent,
  resourceName,
} from "@bibliothecadao/types";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/ui/features/event-feed/notify";
import { getPlayerDisplayName } from "@/services/identity/player-profiles";

type ArmyTypeLabel = (typeof MILITARY_BUILDING_GROUP_ORDER)[number];
type ArmyGroup = {
  armyType: ArmyTypeLabel;
  buildings: string[];
  isRecommended: boolean;
  bonus?: number;
};

// Blitz-flavored resource ordering. T1 base resources come first, then the
// T2 troop resources in Paladin/Knight/Crossbow order, then T3 in the same
// order. Each entry carries the troop hint we render on the card so the
// player sees "this resource feeds Paladin T2" at a glance.
type ResourceTroopHint = { tier: 2 | 3; troopResource: ResourcesIds; troopLabel: string };
type ResourceTierSlot = {
  resourceId: ResourcesIds;
  troopHint?: ResourceTroopHint;
};
type ResourceTierGroup = {
  tier: 1 | 2 | 3;
  label: string;
  slots: ResourceTierSlot[];
};

const RESOURCE_TIER_GROUPS: ResourceTierGroup[] = [
  {
    tier: 1,
    label: "T1 · Basic resources",
    slots: [{ resourceId: ResourcesIds.Wood }, { resourceId: ResourcesIds.Coal }, { resourceId: ResourcesIds.Copper }],
  },
  {
    tier: 2,
    label: "T2 · Troop resources",
    slots: [
      {
        resourceId: ResourcesIds.Gold,
        troopHint: { tier: 2, troopResource: ResourcesIds.Paladin, troopLabel: "Paladin" },
      },
      {
        resourceId: ResourcesIds.ColdIron,
        troopHint: { tier: 2, troopResource: ResourcesIds.Knight, troopLabel: "Knight" },
      },
      {
        resourceId: ResourcesIds.Ironwood,
        troopHint: { tier: 2, troopResource: ResourcesIds.Crossbowman, troopLabel: "Crossbowman" },
      },
    ],
  },
  {
    tier: 3,
    label: "T3 · Elite resources",
    slots: [
      {
        resourceId: ResourcesIds.Dragonhide,
        troopHint: { tier: 3, troopResource: ResourcesIds.Paladin, troopLabel: "Paladin" },
      },
      {
        resourceId: ResourcesIds.Mithral,
        troopHint: { tier: 3, troopResource: ResourcesIds.Knight, troopLabel: "Knight" },
      },
      {
        resourceId: ResourcesIds.Adamantine,
        troopHint: { tier: 3, troopResource: ResourcesIds.Crossbowman, troopLabel: "Crossbowman" },
      },
    ],
  },
];

/** The cards of a group: one column on a phone, then two, then three across the Build window. */
const CARD_GRID = "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3";

type ResourceProductionStatus = {
  resourceId: ResourcesIds;
  isProducing: boolean;
  timeRemainingSeconds: number | null;
  productionPerSecond: number | null;
  outputRemaining: number | null;
  totalBuildings: number;
  activeBuildings: number;
};

export const SelectPreviewBuildingMenu = ({ entityId }: { entityId: number }) => {
  const game = useGame();
  useNativeRevision(["ResourceBalance", "ResourceProduction", "ResourceWeight", "Building", "RealmKnowledge"]);
  const lane = useCompactLane();
  const [summaryOpen, setSummaryOpen] = useState(false);

  const currentDefaultTick = useCurrentDefaultTick();
  const buildPendingRef = useRef(false);
  const [isBuildPending, setIsBuildPending] = useState(false);
  const [pendingAction, setPendingAction] = useState<"destroy" | "production" | null>(null);

  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const previewBuilding = useUIStore((state) => state.previewBuilding);
  const requestedSimpleCost = useUIStore((state) => state.useSimpleCost);
  const setUseSimpleCost = useUIStore((state) => state.setUseSimpleCost);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  const mode = useGameModeConfig();
  const useSimpleCost = resolveUseSimpleCost(configManager.buildingCostMode, requestedSimpleCost);
  const { isMapView } = useQuery();

  const structure = useNativeRow("Structure", { game_id: configManager.getActiveGameId(), entity_id: entityId });
  // What one more of each building gives, from the one output source (building-gives.ts).
  const givesOf = (building: BuildingType) =>
    structure
      ? describeBuildingGives(
          game.setup.store,
          structure,
          building,
          configManager.getBuildingCategoryConfig(building).capacity_grant,
        )
      : null;
  const structureBuildings = useNativeRow("StructureBuildings", {
    game_id: configManager.getActiveGameId(),
    entity_id: entityId,
  });
  const resourceData = useResourceManager(entityId);
  const realm = getRealmInfo(entityId, game.setup.store, getPlayerDisplayName);

  const existingBuildings = useMemo(
    () => (realm?.position ? requireActiveGameClient().views.buildingTiles(entityId).existingBuildings() : []),
    [entityId, realm?.position, structureBuildings],
  );
  const isDestroyLocked = pendingAction === "destroy";
  const isProductionLocked = pendingAction === "production";
  const hasAvailableBuildingTile = useMemo(() => {
    return resolveRealmHasAvailableBuildingTile({ entityId, realmPosition: realm?.position });
  }, [entityId, realm?.position?.x, realm?.position?.y, structure?.base?.level, structureBuildings]);
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
      if (buildPendingRef.current) return;
      buildPendingRef.current = true;
      setIsBuildPending(true);
      try {
        await buildRealmBuilding({
          entityId,
          realmPosition: realm?.position,
          realm,
          mode,
          target,
          useSimpleCost,
          onBuildSuccess: (selection) => {
            setPreviewBuilding(null);
            setSelectedBuildingHex(selection);
          },
        });
      } finally {
        buildPendingRef.current = false;
        setIsBuildPending(false);
      }
    },
    [entityId, realm, realm?.position, setPreviewBuilding, setSelectedBuildingHex, useSimpleCost, mode],
  );

  // One rule for a card click: the world view has no tile picker, so the click builds on the first free tile
  // and the panel stays open; the local view arms the placement preview and closes the panel.
  const selectBuildingCard = useCallback(
    (target: { type: BuildingType; resource?: ResourcesIds }, playSound: () => void) => {
      if (isMapView) {
        void handleAutoBuild(target);
        return;
      }
      const isActivePreview =
        previewBuilding?.type === target.type && (previewBuilding?.resource ?? undefined) === target.resource;
      if (isActivePreview) {
        setPreviewBuilding(null);
        return;
      }
      setPreviewBuilding(target.resource !== undefined ? target : { type: target.type });
      playSound();
      AudioManager.getInstance().play("ui.summon");
      setLeftNavigationView(LeftView.None);
    },
    [handleAutoBuild, isMapView, previewBuilding, setLeftNavigationView, setPreviewBuilding],
  );

  const handleDestroyBuilding = useCallback(
    async (target: { type: BuildingType; resource?: ResourcesIds }) => {
      if (!realm?.position) {
        toast.error("Select a realm before destroying.");
        return;
      }

      if (isDestroyLocked) return;
      const { views, actions } = requireActiveGameClient();
      const existing = views
        .buildingTiles(entityId)
        .existingBuildings()
        .find((building) => building.category === target.type);
      if (!existing) {
        toast.error("No building of this type found to destroy.");
        return;
      }
      setPendingAction("destroy");
      try {
        await actions.destroyBuilding({ structureId: entityId, hex: { col: existing.col, row: existing.row } });
        if (
          previewBuilding?.type === target.type &&
          (!target.resource || previewBuilding?.resource === target.resource)
        ) {
          setPreviewBuilding(null);
        }
      } catch (error) {
        console.error("Failed to destroy building", error);
        toast.failed(error, "Destroy failed. Please try again.");
      } finally {
        setPendingAction(null);
      }
    },
    [entityId, isDestroyLocked, previewBuilding?.resource, previewBuilding?.type, realm?.position, setPreviewBuilding],
  );

  const handlePauseResumeAll = useCallback(
    async (target: { type: BuildingType; resource?: ResourcesIds }) => {
      if (!realm?.position) {
        toast.error("Select a realm before managing production.");
        return;
      }

      if (isProductionLocked) return;
      const { views, actions } = requireActiveGameClient();
      const currentBuildings = views.buildingTiles(entityId).existingBuildings();
      const categoryBuildings = currentBuildings.filter((b) => b.category === target.type);

      if (categoryBuildings.length === 0) {
        toast.error("No buildings of this type found.");
        return;
      }
      setPendingAction("production");

      // Determine action: if any are active, pause all; if all paused, resume all
      const anyActive = categoryBuildings.some((b) => !b.paused);
      const action = anyActive ? "pause" : "resume";

      try {
        await Promise.all(
          categoryBuildings.map((building) => {
            const slot = { structureId: entityId, hex: { col: building.col, row: building.row } };
            if (action === "pause" && !building.paused) {
              return actions.pauseProduction(slot);
            } else if (action === "resume" && building.paused) {
              return actions.resumeProduction(slot);
            }
            return Promise.resolve();
          }),
        );
      } catch (error) {
        console.error(`Failed to ${action} production`, error);
        toast.failed(error, `Failed to ${action} production. Please try again.`);
      } finally {
        setPendingAction(null);
      }
    },
    [entityId, isProductionLocked, realm?.position],
  );

  const pausedByCategory = useMemo(() => {
    const counts = new Map<BuildingType, { total: number; paused: number }>();
    existingBuildings.forEach((building) => {
      const entry = counts.get(building.category) ?? { total: 0, paused: 0 };
      entry.total += 1;
      if (building.paused) entry.paused += 1;
      counts.set(building.category, entry);
    });

    const map = new Map<BuildingType, boolean>();
    counts.forEach((entry, category) => {
      map.set(category, entry.paused === entry.total);
    });

    return map;
  }, [existingBuildings]);

  const realmBiome =
    useStoredBiome(
      realm?.position ? Number(realm.position.x) : undefined,
      realm?.position ? Number(realm.position.y) : undefined,
    ) ?? null;

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

  const buildingTypes = useMemo(
    () =>
      getConstructionBuildingGroups(mode, realm?.resources ?? []).flatMap((group) =>
        group.buildings.map((type) => BuildingType[type]),
      ),
    [mode, realm?.resources],
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

    producedResourceIds.forEach((resourceId) => {
      const productionInfo = resourceData.current(resourceId);
      if (!productionInfo?.production) return;

      const productionData = ResourceManager.calculateResourceProductionData(
        resourceId,
        productionInfo,
        currentDefaultTick,
      );

      const totalBuildings = Number(productionInfo.production.building_count ?? 0);

      map.set(resourceId, {
        resourceId,
        isProducing: productionData.isProducing,
        timeRemainingSeconds: productionData.timeRemainingSeconds,
        productionPerSecond: Number.isFinite(productionData.productionPerSecond)
          ? productionData.productionPerSecond
          : null,
        outputRemaining: productionData.outputRemaining,
        totalBuildings,
        activeBuildings: productionData.isProducing ? (totalBuildings > 0 ? totalBuildings : 0) : 0,
      });
    });

    return map;
  }, [currentDefaultTick, producedResourceIds, resourceData]);
  const productionStatusByResourceRef = useRef(productionStatusByResource);
  productionStatusByResourceRef.current = productionStatusByResource;

  const armyGroups = useMemo<ArmyGroup[]>(
    () =>
      MILITARY_BUILDING_GROUP_ORDER.reduce<ArmyGroup[]>((acc, armyType) => {
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
    if (recommended) return recommended.armyType;

    if (armyGroups.length === 0) return null;

    const bestBonusGroup = armyGroups.reduce<ArmyGroup | null>((best, group) => {
      if (!best) return group;
      const bestBonus = best.bonus ?? 1;
      const groupBonus = group.bonus ?? 1;
      return groupBonus > bestBonus ? group : best;
    }, null);

    return bestBonusGroup?.armyType ?? armyGroups[0].armyType;
  }, [armyGroups]);

  const [selectedTab, setSelectedTab] = useState(1);
  const [selectedArmyType, setSelectedArmyType] = useState<ArmyTypeLabel | null>(null);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set());
  const previousEntityIdRef = useRef(entityId);

  useEffect(() => {
    const hasRealmChanged = previousEntityIdRef.current !== entityId;
    previousEntityIdRef.current = entityId;

    if (armyGroups.length === 0) {
      if (selectedArmyType !== null) {
        setSelectedArmyType(null);
      }
      return;
    }

    const selectedArmyTypeExists =
      selectedArmyType !== null && armyGroups.some((group) => group.armyType === selectedArmyType);

    if (!hasRealmChanged && selectedArmyTypeExists) {
      return;
    }

    setSelectedArmyType(recommendedArmyType ?? armyGroups[0].armyType);
  }, [armyGroups, entityId, recommendedArmyType, selectedArmyType]);

  const activeArmyType = selectedArmyType ?? recommendedArmyType ?? armyGroups[0]?.armyType ?? null;
  const getSummaryBuildState = useCallback(
    (buildingId: BuildingType) => {
      const buildability = resolveConstructionBuildability({
        entityId,
        buildingType: buildingId,
        useSimpleCost,
        store: game.setup.store,
        realm,
        mode,
        hasAvailableBuildingTile,
      });

      return {
        canBuild: buildability.canSubmit,
        disabledReason: buildability.reason,
      };
    },
    [game.setup.store, entityId, hasAvailableBuildingTile, mode, realm, useSimpleCost],
  );
  const allowedBuildingTypes = useMemo(
    () =>
      buildingTypes
        .map((buildingType) => BuildingType[buildingType as keyof typeof BuildingType])
        .filter((buildingType): buildingType is BuildingType => typeof buildingType === "number"),
    [buildingTypes],
  );
  const realmBuildingSummary = useMemo(
    () =>
      buildRealmBuildingSummary({
        realmResourceIds: realm?.resources ?? [],
        allowedBuildingTypes,
        getBuildingCount: getBuildingCountFor,
        frontier: mode.id === "frontier",
      }),
    [allowedBuildingTypes, getBuildingCountFor, realm?.resources, mode.id],
  );
  const realmBuildingSummaryActions = useMemo(
    () =>
      new Map(
        realmBuildingSummary.map((item) => {
          const buildState = getSummaryBuildState(item.buildingId);

          return [
            item.buildingId,
            {
              onBuild: () => void handleAutoBuild({ type: item.buildingId }),
              disabled: !buildState.canBuild,
              loading: isBuildPending,
              title: buildState.disabledReason ?? `Build ${item.label}`,
            },
          ] as const;
        }),
      ),
    [getSummaryBuildState, handleAutoBuild, isBuildPending, realmBuildingSummary],
  );

  const tabs = useMemo(
    () => [
      {
        key: "resources",
        label: "Resources",
        component: () => {
          const ownedResources = new Set(realm?.resources ?? []);
          return (
            <div className="flex flex-col gap-3">
              {RESOURCE_TIER_GROUPS.map((group) => {
                const slots = group.slots.filter((slot) => ownedResources.has(slot.resourceId));
                if (slots.length === 0) return null;
                return (
                  <HudPanel key={group.tier} kind="section" title={group.label} collapsible={false}>
                    <div className={CARD_GRID}>
                      {slots.map(({ resourceId, troopHint }) => {
                        const building = getBuildingFromResource(resourceId);
                        const productionStatus = productionStatusByResourceRef.current.get(resourceId as ResourcesIds);

                        const buildability = resolveConstructionBuildability({
                          entityId,
                          buildingType: building,
                          useSimpleCost,
                          store: game.setup.store,
                          realm,
                          mode,
                          hasAvailableBuildingTile,
                        });
                        const canBuild = buildability.canSubmit;
                        const disabledReason = buildability.reason;
                        const disabled = !canBuild;
                        const count = getBuildingCountFor(building);
                        const destroyPending = isDestroyLocked;
                        const destroyDisabled = count <= 0 || destroyPending;

                        const pauseResumePending = isProductionLocked;
                        const allPausedState = pausedByCategory.get(building);

                        return (
                          <BuildingCard
                            canPlaceOnMap={!isMapView}
                            buildLoading={isBuildPending}
                            key={`${entityId}:${resourceId}`}
                            buildingId={building}
                            gives={givesOf(building)}
                            requirements={resolveBuildingRequirements(
                              entityId,
                              game.setup.store,
                              building,
                              useSimpleCost,
                              currentDefaultTick,
                            )}
                            onClick={() => {
                              if (!canBuild) return;
                              selectBuildingCard({ type: building, resource: resourceId }, () =>
                                playResourceSound(resourceId),
                              );
                            }}
                            active={previewBuilding?.resource === resourceId}
                            buildingName={resourceName(resourceId)}
                            resource={resourceId}
                            productionStatus={productionStatus}
                            troopHint={troopHint}
                            entityId={entityId}
                            useSimpleCost={useSimpleCost}
                            disabled={disabled}
                            disabledReason={disabledReason}
                            count={count}
                            onBuild={() => handleAutoBuild({ type: building, resource: resourceId })}
                            buildDisabled={!canBuild}
                            onDestroy={() => handleDestroyBuilding({ type: building, resource: resourceId })}
                            destroyDisabled={destroyDisabled}
                            destroyLoading={destroyPending}
                            onPauseResumeAll={() => handlePauseResumeAll({ type: building, resource: resourceId })}
                            pauseResumeAllDisabled={count <= 0 || pauseResumePending}
                            pauseResumeAllLoading={pauseResumePending}
                            allPaused={allPausedState ?? false}
                          />
                        );
                      })}
                    </div>
                  </HudPanel>
                );
              })}
              {/* Fallback for any owned resource we didn't slot — render under
                  an "Other" group so non-blitz worlds still see them. */}
              {(() => {
                const slottedIds = new Set(
                  RESOURCE_TIER_GROUPS.flatMap((group) => group.slots.map((slot) => slot.resourceId)),
                );
                const others = (realm?.resources ?? []).filter((id) => !slottedIds.has(id));
                if (others.length === 0) return null;
                return (
                  <HudPanel kind="section" title="Other" collapsible={false}>
                    <div className={CARD_GRID}>
                      {others.map((resourceId) => {
                        const building = getBuildingFromResource(resourceId);
                        const productionStatus = productionStatusByResourceRef.current.get(resourceId as ResourcesIds);
                        const buildability = resolveConstructionBuildability({
                          entityId,
                          buildingType: building,
                          useSimpleCost,
                          store: game.setup.store,
                          realm,
                          mode,
                          hasAvailableBuildingTile,
                        });
                        const canBuild = buildability.canSubmit;
                        const disabledReason = buildability.reason;
                        const disabled = !canBuild;
                        const count = getBuildingCountFor(building);
                        const destroyPending = isDestroyLocked;
                        const destroyDisabled = count <= 0 || destroyPending;
                        const pauseResumePending = isProductionLocked;
                        const allPausedState = pausedByCategory.get(building);
                        return (
                          <BuildingCard
                            canPlaceOnMap={!isMapView}
                            buildLoading={isBuildPending}
                            key={`${entityId}:${resourceId}`}
                            buildingId={building}
                            gives={givesOf(building)}
                            requirements={resolveBuildingRequirements(
                              entityId,
                              game.setup.store,
                              building,
                              useSimpleCost,
                              currentDefaultTick,
                            )}
                            onClick={() => {
                              if (!canBuild) return;
                              selectBuildingCard({ type: building, resource: resourceId }, () =>
                                playResourceSound(resourceId),
                              );
                            }}
                            active={previewBuilding?.resource === resourceId}
                            buildingName={resourceName(resourceId)}
                            resource={resourceId}
                            productionStatus={productionStatus}
                            entityId={entityId}
                            useSimpleCost={useSimpleCost}
                            disabled={disabled}
                            disabledReason={disabledReason}
                            count={count}
                            onBuild={() => handleAutoBuild({ type: building, resource: resourceId })}
                            buildDisabled={!canBuild}
                            onDestroy={() => handleDestroyBuilding({ type: building, resource: resourceId })}
                            destroyDisabled={destroyDisabled}
                            destroyLoading={destroyPending}
                            onPauseResumeAll={() => handlePauseResumeAll({ type: building, resource: resourceId })}
                            pauseResumeAllDisabled={count <= 0 || pauseResumePending}
                            pauseResumeAllLoading={pauseResumePending}
                            allPaused={allPausedState ?? false}
                          />
                        );
                      })}
                    </div>
                  </HudPanel>
                );
              })()}
            </div>
          );
        },
      },
      {
        key: "economic",
        label: "Economic",
        component: () => (
          <div className={CARD_GRID}>
            {buildingTypes
              .filter((a) => isEconomyBuilding(BuildingType[a as keyof typeof BuildingType]))
              .toSorted((a, b) => {
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
                const producedResourceId = configManager.getResourceBuildingProduced(building) as
                  | ResourcesIds
                  | undefined;
                const productionStatus = producedResourceId
                  ? productionStatusByResourceRef.current.get(producedResourceId as ResourcesIds)
                  : undefined;

                const buildability = resolveConstructionBuildability({
                  entityId,
                  buildingType: building,
                  useSimpleCost,
                  store: game.setup.store,
                  realm,
                  mode,
                  hasAvailableBuildingTile,
                });
                const canBuild = buildability.canSubmit;
                const disabledReason = buildability.reason;
                const disabled = !canBuild;
                const count = getBuildingCountFor(building);
                const destroyPending = isDestroyLocked;
                const destroyDisabled = count <= 0 || destroyPending;

                const pauseResumePending = isProductionLocked;
                const allPausedState = pausedByCategory.get(building);
                const showPauseResume = !isWorkersHut;

                return (
                  <BuildingCard
                    canPlaceOnMap={!isMapView}
                    buildLoading={isBuildPending}
                    key={`${entityId}:${index}`}
                    buildingId={building}
                    gives={givesOf(building)}
                    requirements={resolveBuildingRequirements(
                      entityId,
                      game.setup.store,
                      building,
                      useSimpleCost,
                      currentDefaultTick,
                    )}
                    onClick={() => {
                      if (!canBuild) return;
                      selectBuildingCard({ type: building }, () => {
                        if (building === BuildingType.ResourceWheat) playResourceSound(ResourcesIds.Wheat);
                        if (building === BuildingType.ResourceFish) playResourceSound(ResourcesIds.Fish);
                      });
                    }}
                    active={previewBuilding?.type === building}
                    buildingName={buildingName(building, mode.id === "frontier")}
                    resource={configManager.getResourceBuildingProduced(building)}
                    isWorkersHut={isWorkersHut}
                    productionStatus={productionStatus}
                    entityId={entityId}
                    useSimpleCost={useSimpleCost}
                    disabled={disabled}
                    disabledReason={disabledReason}
                    count={count}
                    onBuild={() => handleAutoBuild({ type: building })}
                    buildDisabled={!canBuild}
                    onDestroy={() => handleDestroyBuilding({ type: building })}
                    destroyDisabled={destroyDisabled}
                    destroyLoading={destroyPending}
                    onPauseResumeAll={showPauseResume ? () => handlePauseResumeAll({ type: building }) : undefined}
                    pauseResumeAllDisabled={count <= 0 || pauseResumePending}
                    pauseResumeAllLoading={pauseResumePending}
                    allPaused={allPausedState ?? false}
                  />
                );
              })}
          </div>
        ),
      },
      {
        key: "military",
        label: "Military",
        component: () => {
          if (armyGroups.length === 0) {
            return <p className="text-hud-label text-hud-muted">No military buildings available.</p>;
          }

          // With the wider Build modal all three tiers fit in one row, so we
          // drop the troop-type filter entirely. Each army group renders with
          // its bonus next to the group label so the player still sees
          // biome-bonus info without an extra filter click.
          return (
            <div className="flex flex-col gap-3">
              {armyGroups.map((group) => {
                const bonusMultiplier = group.bonus ?? 1;
                const bonusLabel = formatPercent(bonusMultiplier - 1, { signed: true });
                return (
                  <HudPanel
                    key={group.armyType}
                    kind="section"
                    title={group.armyType}
                    collapsible={false}
                    cue={
                      <span className="flex items-center gap-1" title="Biome combat bonus for this army type">
                        {group.isRecommended && <HudChip tone="good">Recommended</HudChip>}
                        <HudChip tone={bonusMultiplier > 1 ? "good" : bonusMultiplier < 1 ? "bad" : undefined}>
                          {bonusLabel}
                        </HudChip>
                      </span>
                    }
                  >
                    <div className={CARD_GRID}>
                      {group.buildings
                        .toSorted((a, b) => {
                          const buildingA = BuildingType[a as keyof typeof BuildingType];
                          const buildingB = BuildingType[b as keyof typeof BuildingType];
                          const infoA = getMilitaryBuildingInfo(buildingA);
                          const infoB = getMilitaryBuildingInfo(buildingB);
                          return (infoA?.tier || 0) - (infoB?.tier || 0);
                        })
                        .map((buildingType, index) => {
                          const building = BuildingType[buildingType as keyof typeof BuildingType];
                          const producedResourceId = configManager.getResourceBuildingProduced(building) as
                            | ResourcesIds
                            | undefined;
                          const productionStatus = producedResourceId
                            ? productionStatusByResourceRef.current.get(producedResourceId as ResourcesIds)
                            : undefined;

                          const buildability = resolveConstructionBuildability({
                            entityId,
                            buildingType: building,
                            useSimpleCost,
                            store: game.setup.store,
                            realm,
                            mode,
                            hasAvailableBuildingTile,
                          });
                          const canBuild = buildability.canSubmit;
                          const disabledReason = buildability.reason;
                          const count = getBuildingCountFor(building);
                          const destroyPending = isDestroyLocked;
                          const destroyDisabled = count <= 0 || destroyPending;

                          const pauseResumePending = isProductionLocked;
                          const allPausedState = pausedByCategory.get(building);

                          return (
                            <BuildingCard
                              canPlaceOnMap={!isMapView}
                              buildLoading={isBuildPending}
                              key={`${entityId}:${index}`}
                              buildingId={building}
                              gives={givesOf(building)}
                              requirements={resolveBuildingRequirements(
                                entityId,
                                game.setup.store,
                                building,
                                useSimpleCost,
                                currentDefaultTick,
                              )}
                              onClick={() => {
                                if (!canBuild) return;
                                selectBuildingCard({ type: building }, () => {});
                              }}
                              active={previewBuilding?.type === building}
                              buildingName={buildingName(building, mode.id === "frontier")}
                              resource={configManager.getResourceBuildingProduced(building)}
                              productionStatus={productionStatus}
                              entityId={entityId}
                              useSimpleCost={useSimpleCost}
                              disabled={!canBuild}
                              disabledReason={disabledReason}
                              count={count}
                              onBuild={() => handleAutoBuild({ type: building })}
                              buildDisabled={!canBuild}
                              onDestroy={() => handleDestroyBuilding({ type: building })}
                              destroyDisabled={destroyDisabled}
                              destroyLoading={destroyPending}
                              onPauseResumeAll={() => handlePauseResumeAll({ type: building })}
                              pauseResumeAllDisabled={count <= 0 || pauseResumePending}
                              pauseResumeAllLoading={pauseResumePending}
                              allPaused={allPausedState ?? false}
                            />
                          );
                        })}
                    </div>
                  </HudPanel>
                );
              })}
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
      isDestroyLocked,
      isProductionLocked,
      pausedByCategory,
      mode,
      handleAutoBuild,
      isBuildPending,
      isMapView,
      selectBuildingCard,
      handleDestroyBuilding,
      handlePauseResumeAll,
      getBuildingCountFor,
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
    <div>
      {configManager.buildingCostMode === "choice" && (
        <div
          className="flex min-h-11 items-center gap-2 border-b border-hud-divider pb-2"
          title="Pay for buildings with resources or with labor; each card shows its cost in the one chosen"
        >
          <span className="text-hud-label text-hud-muted">Pay with</span>
          <span className={useSimpleCost ? "text-hud-label text-hud-cue" : "text-hud-label"}>Resources</span>
          <HudSwitch on={useSimpleCost} label="Pay with labor" onChange={setUseSimpleCost} />
          <span className={useSimpleCost ? "text-hud-label" : "text-hud-label text-hud-cue"}>
            {resourceName(ResourcesIds.Labor)}
          </span>
        </div>
      )}

      <details
        open={lane === null || summaryOpen}
        onToggle={(event) => {
          if (lane !== null) setSummaryOpen(event.currentTarget.open);
        }}
      >
        <summary className="flex min-h-11 cursor-pointer items-center text-hud-accent underline underline-offset-4 lg:hidden">
          Built here · view buildings
        </summary>
        <RealmBuildingSummary
          headline="Built here"
          items={realmBuildingSummary}
          buildActions={realmBuildingSummaryActions}
        />
      </details>

      <div className="mt-2 flex flex-col gap-3">
        <HudTabs
          tabs={tabs.map((tab) => ({ key: tab.key, label: tab.label }))}
          value={tabs[selectedTab]?.key ?? tabs[0].key}
          onChange={(key) => setSelectedTab(tabs.findIndex((tab) => tab.key === key))}
        />
        {tabs.map((tab, index) => {
          const shown = selectedTab === index;
          // A tab visited once stays drawn while hidden, so coming back to it keeps where the player was.
          if (!shown && !visitedTabs.has(tab.key)) return null;
          return (
            <div key={tab.key} role="tabpanel" aria-label={tab.label} hidden={!shown}>
              {tab.component()}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const BuildingCard = ({
  canPlaceOnMap = false,
  buildingId,
  onClick,
  active,
  buildingName,
  resource,
  isWorkersHut,
  productionStatus,
  entityId,
  useSimpleCost,
  requirements,
  disabled = false,
  disabledReason,
  badge,
  onBuild,
  buildDisabled,
  buildLoading,
  count = 0,
  onDestroy: destroyAny,
  destroyDisabled,
  destroyLoading,
  onPauseResumeAll: pauseResumeAny,
  pauseResumeAllDisabled,
  pauseResumeAllLoading,
  allPaused,
  troopHint,
  gives,
}: {
  canPlaceOnMap?: boolean;
  buildingId: BuildingType;
  onClick: () => void;
  active: boolean;
  buildingName: string;
  resource?: ResourcesIds;
  isWorkersHut?: boolean;
  productionStatus?: ResourceProductionStatus;
  entityId: number | undefined;
  useSimpleCost: boolean;
  /** Held / needed per resource, shown while the card is hovered. */
  requirements: ResourceRequirement[] | undefined;
  /**
   * Optional "this resource feeds X troop tier" hint for the blitz T2/T3
   * resource cards. Rendered as a tiny chip in the corner so the player
   * can tell at a glance which troop the resource unlocks.
   */
  troopHint?: ResourceTroopHint;
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
  onPauseResumeAll?: () => void;
  pauseResumeAllDisabled?: boolean;
  pauseResumeAllLoading?: boolean;
  allPaused?: boolean;
  /** What one more gives, named and per unit of time ("+360 Wheat / min"); null when it gives neither. */
  gives?: string | null;
}) => {
  const lane = useCompactLane();
  const hover = (
    <BuildingHover
      name={buildingName}
      building={buildingId}
      resource={resource}
      entityId={entityId}
      useSimpleCost={useSimpleCost}
      gives={gives}
      requirements={requirements}
    />
  );
  // The open hover follows the card's current readings, not the ones it opened on.
  const tooltip = useLiveTooltip(hover, "right");
  // Pausing and destroying act on the buildings of this type already built: with none, neither is offered.
  const onDestroy = count > 0 ? destroyAny : undefined;
  const onPauseResumeAll = count > 0 ? pauseResumeAny : undefined;
  const isDisabled = disabled;
  const showDisabledMessage = isDisabled && disabledReason;
  const effectiveRemainingSeconds = productionStatus?.timeRemainingSeconds ?? null;
  const effectiveOutputRemaining = productionStatus?.outputRemaining ?? null;
  const outputLabel =
    productionStatus?.isProducing && effectiveOutputRemaining !== null
      ? formatAmount(effectiveOutputRemaining)
      : undefined;
  const totalProductionBuildings = count;
  const activeProductionBuildings =
    productionStatus?.isProducing && productionStatus.activeBuildings > 0
      ? productionStatus.activeBuildings
      : productionStatus?.isProducing
        ? totalProductionBuildings
        : 0;
  const formattedRemaining =
    productionStatus?.isProducing && effectiveRemainingSeconds !== null
      ? productionTimeLeft(Math.ceil(effectiveRemainingSeconds))
      : null;
  const productionBadge =
    productionStatus && resource !== undefined ? (
      <ProductionStatusBadge
        resource={resource}
        isProducing={productionStatus.isProducing}
        timeRemainingSeconds={effectiveRemainingSeconds}
        showTooltip={false}
        buildings={totalProductionBuildings}
        amount={outputLabel}
      />
    ) : null;

  if (lane !== null) {
    return (
      <CompactBuildingCard
        name={buildingName}
        building={buildingId}
        count={count}
        status={
          productionStatus
            ? productionStatus.isProducing
              ? `Producing${producingFor(formattedRemaining, effectiveRemainingSeconds)}`
              : "Idle"
            : undefined
        }
        requirements={requirements}
        disabledReason={disabledReason}
        details={hover}
        active={active}
        onPlace={canPlaceOnMap ? onClick : undefined}
        build={{ onClick: onBuild, disabled: buildDisabled || isDisabled, pending: buildLoading }}
        production={{
          onClick: onPauseResumeAll,
          disabled: pauseResumeAllDisabled,
          pending: pauseResumeAllLoading,
          paused: allPaused,
        }}
        destroy={{ onClick: onDestroy, disabled: destroyDisabled, pending: destroyLoading }}
      />
    );
  }

  const handleClick = () => {
    if (isDisabled) return;
    onClick();
  };

  return (
    <HudCard
      title={buildingName}
      picture={<BuildingThumbnail building={buildingId} alt={buildingName} />}
      corner={
        <>
          {troopHint && (
            <HudChip>
              <span
                className="inline-flex items-center gap-1"
                title={`T${troopHint.tier} ${troopHint.troopLabel}`}
                aria-label={`T${troopHint.tier} ${troopHint.troopLabel}`}
              >
                T{troopHint.tier}
                <ResourceIcon resource={troopHint.troopResource} size="xs" withTooltip={false} />
              </span>
            </HudChip>
          )}
          {isWorkersHut && count > 0 && <HudChip>{count}</HudChip>}
          {productionBadge ||
            (resource !== undefined && <ResourceIcon withTooltip={false} resource={resource} size="lg" />)}
          {badge}
          <HudIconButton
            icon="info"
            label={`About ${buildingName}`}
            kind="quiet"
            size="sm"
            onMouseEnter={tooltip.show}
            onMouseLeave={tooltip.hide}
          />
        </>
      }
      actions={
        <>
          <HudIconButton
            icon="build"
            label="Build"
            kind="primary"
            size="sm"
            aria-busy={buildLoading || undefined}
            disabled={Boolean(buildDisabled || isDisabled || buildLoading)}
            onClick={() => onBuild?.()}
          />
          {onPauseResumeAll && (
            <HudIconButton
              icon={allPaused ? "play" : "pause"}
              label={allPaused ? "Resume all" : "Pause all"}
              size="sm"
              aria-busy={pauseResumeAllLoading || undefined}
              disabled={Boolean(pauseResumeAllDisabled)}
              onClick={onPauseResumeAll}
            />
          )}
          {onDestroy && (
            <HudIconButton
              kind="danger"
              icon="trash"
              label="Destroy building"
              size="sm"
              aria-busy={destroyLoading || undefined}
              disabled={Boolean(destroyDisabled)}
              onClick={onDestroy}
            />
          )}
        </>
      }
      selected={active}
      disabled={isDisabled}
      refusal={showDisabledMessage ? disabledReason : undefined}
      onClick={handleClick}
    />
  );
};

/** How long a building keeps producing, after "Producing": " · 4h left", " · never runs out", or nothing unknown. */
const producingFor = (formatted: string | null, seconds: number | null): string => {
  if (seconds === Number.POSITIVE_INFINITY) return " · never runs out";
  return formatted ? ` · ${formatted} left` : "";
};
