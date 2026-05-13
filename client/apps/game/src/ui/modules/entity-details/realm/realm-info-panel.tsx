import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import type { RealmAutomationConfig } from "@/hooks/store/use-automation-store";
import { useAutomationStore } from "@/hooks/store/use-automation-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { LeftView } from "@/types";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { TRANSFER_POPUP_NAME } from "@/ui/features/economy/transfers/transfer-automation-popup";
import { ProductionModal } from "@/ui/features/settlement";
import {
  buildRealmBuilding,
  resolveRealmHasAvailableBuildingTile,
} from "@/ui/features/settlement/construction/realm-build-actions";
import {
  getEffectiveConstructionBalance,
  hasActiveConstructionIntent,
  reconcileConstructionIntents,
} from "@/ui/features/settlement/construction/construction-intent-store";
import {
  buildRealmBuildingSummary,
  RealmBuildingSummary,
  resolveRealmBuildingSummaryBuildability,
} from "@/ui/features/settlement/construction/realm-building-summary";
import { useConstructionIntentVersion } from "@/ui/features/settlement/construction/use-construction-intents";
import { productionAutomation } from "@/ui/features/world/components/config";
import { ActiveRelicEffects } from "@/ui/features/world/components/entities/active-relic-effects";
import { CompactEntityInventory } from "@/ui/features/world/components/entities/compact-entity-inventory";
import { StructureProductionPanel } from "@/ui/features/world/components/entities/structure-production-panel";
import { RealmAttentionRow } from "@/ui/modules/entity-details/realm/realm-attention-row";
import { buildRealmTransferBarModels, RealmTransferBars } from "@/ui/modules/entity-details/realm/realm-transfer-bars";
import { useRealmStarvedResources } from "@/ui/modules/entity-details/realm/use-realm-starved-resources";
import { useRealmConsumptionPerSecond } from "@/ui/modules/entity-details/realm/use-realm-consumption-per-second";
import { buildVillageTimerSummary } from "@/ui/shared/lib/village-timers";
import { extractTransactionHash, waitForTransactionConfirmation } from "@/ui/utils/transactions";
import { inferRealmPreset } from "@/utils/automation-presets";
import { getRealmStatusColor, getFailureSeverity, timeAgo } from "@/utils/automation-status";
import {
  formatTime,
  getBuildingCosts,
  getBuildingCount,
  getGuardsByStructure,
  getRealmInfo,
  getStructureArmyRelicEffects,
  getStructureRelicEffects,
  hasEnoughPopulationForBuilding,
  TileManager,
} from "@bibliothecadao/eternum";
import { useDojo, useExplorersByStructure } from "@bibliothecadao/react";
import {
  BuildingType,
  ClientComponents,
  ContractAddress,
  EntityType,
  getBuildingFromResource,
  RelicRecipientType,
  ResourcesIds,
  StructureType,
} from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { ComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { useTransferAutomationStore } from "@/hooks/store/use-transfer-automation-store";
import ArrowLeftRight from "lucide-react/dist/esm/icons/arrow-left-right";
import Bot from "lucide-react/dist/esm/icons/bot";
import Shield from "lucide-react/dist/esm/icons/shield";
import Sword from "lucide-react/dist/esm/icons/sword";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const ProductionStatusPill = ({ statusLabel }: { statusLabel: string }) => (
  <span className="rounded-full border border-gold/30 bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gold/80">
    {statusLabel}
  </span>
);

const ProductionModifyButton = ({ onClick, disabled = false }: { onClick?: () => void; disabled?: boolean }) => (
  <button
    type="button"
    disabled={disabled}
    className={`rounded border border-gold bg-gold px-2 py-0.5 text-[10px] uppercase tracking-wide text-black font-semibold transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-gold ${
      disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-[#ffd84a] hover:border-gold"
    }`}
    onClick={onClick}
  >
    Modify
  </button>
);

const resolveAutomationStatusLabel = (automation?: RealmAutomationConfig | null): string => {
  if (!automation) {
    return "Smart automation";
  }

  const presetId = inferRealmPreset(automation);

  if (presetId === "idle") {
    return "Idle";
  }

  if (presetId === "smart") {
    return "Smart automation";
  }

  if (!automation.customPercentages || Object.keys(automation.customPercentages).length === 0) {
    return "Smart automation";
  }

  const hasLabor = Object.values(automation.customPercentages ?? {}).some(
    (config) => (config?.laborToResource ?? 0) > 0,
  );
  const hasResource = Object.values(automation.customPercentages ?? {}).some(
    (config) => (config?.resourceToResource ?? 0) > 0,
  );

  if (hasLabor && hasResource) return "Burning labor & resources";
  if (hasResource) return "Burning resources";
  if (hasLabor) return "Burning labor";

  return "Idle";
};

const RealmAutomationStatusLine = memo(({ realmId }: { realmId: string }) => {
  const lastStatus = useAutomationStore(useCallback((state) => state.realms[realmId]?.lastStatus, [realmId]));
  const nextRunTimestamp = useAutomationStore((state) => state.nextRunTimestamp);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (typeof nextRunTimestamp !== "number" && !lastStatus) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [nextRunTimestamp, lastStatus]);

  if (!lastStatus && typeof nextRunTimestamp !== "number") return null;

  const statusColor = lastStatus ? getRealmStatusColor(lastStatus) : "text-gold/40";
  const failureSeverity = lastStatus ? getFailureSeverity(lastStatus) : "none";

  // Build the compact one-liner: "✓ 7s ago · next in 25s".
  const statusGlyph = !lastStatus
    ? ""
    : lastStatus.status === "success"
      ? "✓"
      : lastStatus.status === "failed"
        ? "✕"
        : "⟳";

  const sinceLabel = lastStatus ? timeAgo(lastStatus.attemptedAt) : null;
  const remainingSeconds =
    typeof nextRunTimestamp === "number" ? Math.max(0, Math.ceil((nextRunTimestamp - nowMs) / 1000)) : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-end gap-1.5 text-[10px]">
        {lastStatus && (
          <>
            <span className={statusColor}>{statusGlyph}</span>
            <span className="text-gold/40">{sinceLabel}</span>
          </>
        )}
        {remainingSeconds !== null && (
          <>
            {lastStatus && <span className="text-gold/20">·</span>}
            <span className="text-gold/40">next in {remainingSeconds}s</span>
          </>
        )}
      </div>

      {failureSeverity === "critical" && lastStatus && (
        <div className="rounded border border-danger/30 bg-danger/5 px-2 py-1 text-[10px] text-danger">
          {lastStatus.consecutiveFailures} consecutive failures: {lastStatus.message}
        </div>
      )}
    </div>
  );
});

RealmAutomationStatusLine.displayName = "RealmAutomationStatusLine";

export const RealmInfoPanel = memo(({ className }: { className?: string }) => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const openArmyCreationPopup = useUIStore((state) => state.openArmyCreationPopup);
  const openPopup = useUIStore((state) => state.openPopup);
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isTransferPopupOpen = useUIStore((state) => state.isPopupOpen(TRANSFER_POPUP_NAME));
  const setTransferPanelSourceId = useUIStore((state) => state.setTransferPanelSourceId);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const setSelectedBuilding = useUIStore((state) => state.setSelectedBuilding);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const useSimpleCost = useUIStore((state) => state.useSimpleCost);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const automationRealms = useAutomationStore((state) => state.realms);
  const transferAutomationEntriesById = useTransferAutomationStore((state) => state.entries);
  const hasAutomationFailures = useAutomationStore(
    useCallback((state) => Object.values(state.realms).some((r) => (r.lastStatus?.consecutiveFailures ?? 0) >= 3), []),
  );
  const { setup, account, network } = useDojo();
  const components = setup.components as ClientComponents;

  const structure = useComponentValue(
    components.Structure,
    structureEntityId ? getEntityIdFromKeys([BigInt(structureEntityId)]) : undefined,
  ) as ComponentValue<ClientComponents["Structure"]["schema"]> | null;

  const resources = useComponentValue(
    components.Resource,
    structureEntityId ? getEntityIdFromKeys([BigInt(structureEntityId)]) : undefined,
  ) as ComponentValue<ClientComponents["Resource"]["schema"]> | null;
  const structureBuildings = useComponentValue(
    components.StructureBuildings,
    structureEntityId ? getEntityIdFromKeys([BigInt(structureEntityId)]) : undefined,
  );
  const villageTroop = useComponentValue(
    components.VillageTroop,
    structureEntityId ? getEntityIdFromKeys([BigInt(structureEntityId)]) : undefined,
  ) as ComponentValue<ClientComponents["VillageTroop"]["schema"]> | null;
  const realm = structureEntityId ? getRealmInfo(getEntityIdFromKeys([BigInt(structureEntityId)]), components) : null;

  const isVillage = structure?.base?.category === StructureType.Village;
  const isOwned = structure ? structure.owner === ContractAddress(account.account.address) : false;
  const structureCapabilities = useMemo(() => resolveStructureUiCapabilities(structure), [structure]);
  const canShowProductionCard = structureCapabilities.canOpenProduction;
  const canShowBalanceCard = structureCapabilities.canOpenTransferInventory;
  const canShowArmiesCard = structureCapabilities.canCreateFieldArmy || structureCapabilities.canManageGuardArmy;

  const realmId = useMemo(() => {
    if (!structureEntityId) return null;
    const numericId = Number(structureEntityId);
    return Number.isFinite(numericId) ? numericId : null;
  }, [structureEntityId]);

  const automationConfig = useMemo(() => {
    if (!realmId) return null;
    return automationRealms[String(realmId)];
  }, [automationRealms, realmId]);
  const statusLabel = resolveAutomationStatusLabel(automationConfig);

  const starvedResources = useRealmStarvedResources(realmId);
  const consumptionPerSecondById = useRealmConsumptionPerSecond(structure, resources, realmId);

  const handleModifyClick = useCallback(() => {
    if (!realmId) return;
    toggleModal(<ProductionModal preSelectedRealmId={realmId} />);
  }, [realmId, toggleModal]);

  const handleOpenTransfer = useCallback(() => {
    if (!structureEntityId) return;
    setTransferPanelSourceId(structureEntityId);
    if (!isTransferPopupOpen) {
      openPopup(TRANSFER_POPUP_NAME);
    }
  }, [isTransferPopupOpen, openPopup, setTransferPanelSourceId, structureEntityId]);

  const productionBoostBonus = useComponentValue(
    components.ProductionBoostBonus,
    structureEntityId ? getEntityIdFromKeys([BigInt(structureEntityId)]) : undefined,
  );

  const { currentArmiesTick, currentBlockTimestamp, currentDefaultTick } = useBlockTimestamp();
  const { data: storyEvents = [] } = useStoryEvents(200);
  const mode = useGameModeConfig();
  const constructionIntentVersion = useConstructionIntentVersion();
  const structureName = useMemo(
    () => (structure ? mode.structure.getName(structure).name : "Structure"),
    [mode, structure],
  );

  useEffect(() => {
    if (!realmId || !realm?.position) return;

    const tileManager = new TileManager(components, setup.systemCalls, {
      col: Number(realm.position.x),
      row: Number(realm.position.y),
    });

    reconcileConstructionIntents(
      realmId,
      (spot) => tileManager.isHexOccupied(spot),
      (spot) => {
        const building = tileManager.getIndexedBuilding(spot);
        return building ? { category: building.category as BuildingType } : undefined;
      },
    );
  }, [components, constructionIntentVersion, realm?.position, realmId, setup.systemCalls]);

  const relicEffects = useMemo(() => {
    if (!structure) return [];
    const structureRelicEffects = productionBoostBonus
      ? getStructureRelicEffects(productionBoostBonus, currentArmiesTick)
      : [];
    const armyRelicEffects = getStructureArmyRelicEffects(structure, currentArmiesTick);
    return [...structureRelicEffects, ...armyRelicEffects];
  }, [productionBoostBonus, structure, currentArmiesTick]);

  const activeRelicIds = useMemo(() => relicEffects.map((effect) => Number(effect.id)), [relicEffects]);

  const explorers = useExplorersByStructure({
    structureEntityId: structureEntityId ?? 0,
  });

  const guards = useMemo(
    () => (structure ? getGuardsByStructure(structure).filter((guard) => guard.troops && guard.troops.count > 0n) : []),
    [structure],
  );

  const attackArmyCount = explorers.length;
  const guardArmyCount = guards.length;
  const maxAttackArmies =
    structure?.base?.troop_max_explorer_count !== undefined ? Number(structure.base.troop_max_explorer_count) : null;
  const maxGuardArmies =
    structure?.base?.troop_max_guard_count !== undefined ? Number(structure.base.troop_max_guard_count) : null;

  const canManageGuards = isOwned && structureCapabilities.canManageGuardArmy;
  const emptyGuardSlots = canManageGuards && maxGuardArmies !== null ? Math.max(maxGuardArmies - guardArmyCount, 0) : 0;
  const attentionStarvedResources = canShowProductionCard ? starvedResources : new Map<ResourcesIds, string>();
  const canBuildFromAttention = isOwned && structureCapabilities.canOpenConstruction;

  const handleManageGuards = useCallback(() => {
    if (!structureEntityId || !canManageGuards) return;
    const maxDefenseSlots = Number(structure?.base?.troop_max_guard_count ?? 0);
    openArmyCreationPopup({
      structureId: Number(structureEntityId),
      isExplorer: false,
      maxDefenseSlots,
    });
  }, [canManageGuards, openArmyCreationPopup, structure?.base?.troop_max_guard_count, structureEntityId]);

  const handleBuildForResource = useCallback(
    (resourceId: ResourcesIds) => {
      const building = getBuildingFromResource(resourceId);
      if (building === BuildingType.None) return;
      setSelectedBuilding(building);
      setPreviewBuilding({ type: building, resource: resourceId });
      setLeftNavigationView(LeftView.ConstructionView);
    },
    [setLeftNavigationView, setPreviewBuilding, setSelectedBuilding],
  );
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
  const checkBalance = useCallback(
    (cost: any) =>
      Object.keys(cost).every((resourceId) => {
        const resourceCost = cost[Number(resourceId)];
        const effectiveBalance = getEffectiveConstructionBalance(
          realmId ?? 0,
          resourceCost.resource,
          currentDefaultTick,
          components,
        );
        return effectiveBalance >= resourceCost.amount;
      }),
    [components, currentDefaultTick, realmId],
  );
  const allowedBuildingTypes = useMemo(
    () =>
      Object.keys(BuildingType)
        .filter((buildingType) => mode.rules.isBuildingTypeAllowed(buildingType))
        .map((buildingType) => BuildingType[buildingType as keyof typeof BuildingType])
        .filter((buildingType): buildingType is BuildingType => typeof buildingType === "number"),
    [mode],
  );
  const hasAvailableBuildingTile = useMemo(
    () =>
      resolveRealmHasAvailableBuildingTile({
        entityId: realmId ?? 0,
        realmPosition: realm?.position,
        world: {
          components,
          systemCalls: setup.systemCalls,
        },
      }),
    [components, constructionIntentVersion, realm?.position, realmId, setup.systemCalls],
  );
  const realmBuildingSummary = useMemo(
    () =>
      buildRealmBuildingSummary({
        realmResourceIds: realm?.resources ?? [],
        allowedBuildingTypes,
        getBuildingCount: getBuildingCountFor,
      }),
    [allowedBuildingTypes, getBuildingCountFor, realm?.resources],
  );
  const handleBuildSummaryItem = useCallback(
    async (buildingId: BuildingType) => {
      if (!realmId) return;
      await buildRealmBuilding({
        entityId: realmId,
        realmPosition: realm?.position,
        target: { type: buildingId },
        useSimpleCost,
        world: {
          account: account.account,
          components,
          systemCalls: setup.systemCalls,
        },
        onBuildSuccess: (selection) => setSelectedBuildingHex(selection),
      });
    },
    [account.account, components, realm?.position, realmId, setSelectedBuildingHex, setup.systemCalls, useSimpleCost],
  );
  const realmBuildingSummaryActions = useMemo(
    () =>
      new Map(
        realmBuildingSummary.map((item) => {
          const buildingCosts = getBuildingCosts(realmId ?? 0, components, item.buildingId, useSimpleCost);
          const hasBalance = Boolean(buildingCosts && checkBalance(buildingCosts));
          const hasEnoughPopulation = Boolean(realm && hasEnoughPopulationForBuilding(realm, item.buildingId));
          const buildState = resolveRealmBuildingSummaryBuildability({
            buildingId: item.buildingId,
            hasBalance,
            hasEnoughPopulation,
            hasCapacity: Boolean(realm?.hasCapacity),
            hasAvailableBuildingTile,
            useSimpleCost,
          });
          const isPending = Boolean(realmId && hasActiveConstructionIntent(realmId, item.buildingId));

          return [
            item.buildingId,
            {
              onBuild: () => void handleBuildSummaryItem(item.buildingId),
              disabled: !isOwned || !buildState.canBuild || isPending,
              loading: isPending,
              title: !isOwned
                ? "You do not own this realm."
                : isPending
                  ? `Building ${item.label}...`
                  : (buildState.disabledReason ?? `Build ${item.label}`),
            },
          ] as const;
        }),
      ),
    [
      checkBalance,
      components,
      handleBuildSummaryItem,
      hasAvailableBuildingTile,
      isOwned,
      realm,
      realmBuildingSummary,
      realmId,
      useSimpleCost,
      constructionIntentVersion,
    ],
  );
  const resolveTransferStructureName = useCallback(
    (entityId: number) => {
      if (realmId === entityId) return structureName;

      const matchingStructure = playerStructures.find(
        (playerStructure) => Number(playerStructure.entityId) === entityId,
      );
      return matchingStructure ? mode.structure.getName(matchingStructure.structure).name : null;
    },
    [mode, playerStructures, realmId, structureName],
  );
  const transferBarModels = useMemo(
    () =>
      buildRealmTransferBarModels({
        selectedStructureId: realmId,
        currentTimeMs: Date.now(),
        storyEvents,
        automationEntries: Object.values(transferAutomationEntriesById),
        resolveStructureName: resolveTransferStructureName,
      }),
    [realmId, resolveTransferStructureName, storyEvents, transferAutomationEntriesById],
  );
  const shouldRenderVillageUi = isVillage;
  const isVillageMilitiaClaimed = Boolean(villageTroop?.claimed);
  const [isClaimingVillageMilitia, setIsClaimingVillageMilitia] = useState(false);
  const [optimisticallyClaimedVillageIds, setOptimisticallyClaimedVillageIds] = useState<Set<number>>(() => new Set());

  const villageTimerSummary = useMemo(() => {
    if (!shouldRenderVillageUi || !structure || !currentBlockTimestamp) {
      return null;
    }

    return buildVillageTimerSummary({
      createdAtTimestamp: structure.base?.created_at,
      currentBlockTimestamp,
    });
  }, [currentBlockTimestamp, shouldRenderVillageUi, structure]);

  const isMilitiaClaimActionVisible = isVillage && isOwned;
  const isMilitiaClaimReady = (villageTimerSummary?.militiaUnlockRemainingSeconds ?? 1) <= 0;
  const isVillageMilitiaOptimisticallyClaimed = useMemo(() => {
    if (!structureEntityId) {
      return false;
    }

    const villageId = Number(structureEntityId);
    return Number.isFinite(villageId) && optimisticallyClaimedVillageIds.has(villageId);
  }, [optimisticallyClaimedVillageIds, structureEntityId]);
  const hasVillageMilitiaBeenClaimed = isVillageMilitiaClaimed || isVillageMilitiaOptimisticallyClaimed;
  const canClaimVillageMilitia = isMilitiaClaimActionVisible && isMilitiaClaimReady && !hasVillageMilitiaBeenClaimed;
  const shouldRenderMilitiaClaimCard = isMilitiaClaimActionVisible && !hasVillageMilitiaBeenClaimed;

  const handleClaimVillageMilitia = useCallback(async () => {
    if (!canClaimVillageMilitia || !structureEntityId) {
      return;
    }

    setIsClaimingVillageMilitia(true);
    try {
      const claimResult = await setup.systemCalls.receive_army_grant({
        signer: account.account,
        village_id: Number(structureEntityId),
      });

      const txHash = extractTransactionHash(claimResult);
      if (txHash) {
        await waitForTransactionConfirmation({
          txHash,
          provider: network.provider as { waitForTransactionWithCheck?: (hash: string) => Promise<unknown> },
          account: account.account as { waitForTransaction?: (hash: string) => Promise<unknown> },
          label: "village militia claim",
        });
      }

      const villageId = Number(structureEntityId);
      if (Number.isFinite(villageId)) {
        setOptimisticallyClaimedVillageIds((claimedVillageIds) => {
          const nextClaimedVillageIds = new Set(claimedVillageIds);
          nextClaimedVillageIds.add(villageId);
          return nextClaimedVillageIds;
        });
      }
      toast.success("Village militia claimed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to claim village militia.";
      toast.error(message);
    } finally {
      setIsClaimingVillageMilitia(false);
    }
  }, [account.account, canClaimVillageMilitia, network.provider, setup.systemCalls, structureEntityId]);

  if (!structure || (!canShowProductionCard && !canShowBalanceCard && !canShowArmiesCard)) {
    return (
      <div className={cn("p-3 text-xxs text-gold/70", className)}>
        Select a structure from the left panel to view production, balance, and armies.
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col gap-2 p-2 text-gold", className)}>
      <RealmAttentionRow
        starvedResources={attentionStarvedResources}
        emptyGuardSlots={emptyGuardSlots}
        onManageGuards={canManageGuards ? handleManageGuards : undefined}
        onBuildForResource={canBuildFromAttention ? handleBuildForResource : undefined}
      />
      {canShowProductionCard && (
        <div className="rounded border border-gold/20 bg-black/50 p-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xxs uppercase tracking-[0.2em] text-gold/60">Production</span>
              <button
                onClick={() => togglePopup(productionAutomation)}
                className="relative p-0.5 text-gold/50 hover:text-gold transition-colors"
                title="Automation Dashboard"
                type="button"
              >
                <Bot className="w-3.5 h-3.5" />
                {hasAutomationFailures && (
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <ProductionStatusPill statusLabel={statusLabel} />
              <ProductionModifyButton onClick={handleModifyClick} disabled={!realmId} />
            </div>
          </div>
          <div className="mt-2">
            {structure && resources ? (
              <StructureProductionPanel
                structure={structure}
                resources={resources}
                compact
                smallTextClass="text-xxs"
                showTooltip
                showProductionSummary={false}
                badgeVariant="detailed"
                starvedResources={starvedResources}
                consumptionPerSecondById={consumptionPerSecondById}
              />
            ) : (
              <p className="text-xxs text-gold/60 italic">Production data unavailable.</p>
            )}
          </div>
          {realmId && (
            <div className="mt-3 text-right">
              <RealmAutomationStatusLine realmId={String(realmId)} />
            </div>
          )}
        </div>
      )}

      {canShowBalanceCard && (
        <div className="rounded border border-gold/20 bg-black/50 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xxs uppercase tracking-[0.2em] text-gold/60">Balance</span>
            <button
              type="button"
              onClick={handleOpenTransfer}
              disabled={!structureEntityId}
              className={cn(
                "flex items-center gap-1 rounded-full border border-gold/30 bg-black/40 px-2.5 py-1 text-xxs font-semibold text-gold/80 transition",
                !structureEntityId && "cursor-not-allowed opacity-50",
                structureEntityId && "hover:bg-gold/10 hover:text-gold",
              )}
              aria-label="Open transfer panel"
              title="Open transfer panel"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2">
            <CompactEntityInventory
              resources={resources}
              recipientType={RelicRecipientType.Structure}
              entityId={structureEntityId ?? undefined}
              entityType={EntityType.STRUCTURE}
              variant="tight"
              showLabels={false}
              maxItems={14}
              heroCount={3}
              allowRelicActivation
              activeRelicIds={activeRelicIds}
            />
          </div>
        </div>
      )}

      <RealmTransferBars current={transferBarModels.current} automation={transferBarModels.automation} />

      {structureCapabilities.canOpenConstruction && (
        <RealmBuildingSummary
          headline="Built here"
          items={realmBuildingSummary}
          variant="card"
          buildActions={realmBuildingSummaryActions}
        />
      )}

      {relicEffects.length > 0 && structureEntityId && (
        <ActiveRelicEffects relicEffects={relicEffects} entityId={structureEntityId} compact />
      )}

      {shouldRenderVillageUi && (
        <div className="rounded border border-gold/20 bg-black/50 p-2">
          <div className="text-xxs uppercase tracking-[0.2em] text-gold/60">Village Timers</div>
          {villageTimerSummary ? (
            <div className="mt-2 space-y-1 text-xxs text-gold/80">
              <div className="flex items-center justify-between gap-2 rounded border border-gold/10 bg-black/20 px-2 py-1">
                <span>Militia unlock</span>
                <span className="font-semibold text-gold">
                  {villageTimerSummary.militiaUnlockRemainingSeconds > 0
                    ? formatTime(villageTimerSummary.militiaUnlockRemainingSeconds)
                    : "Ready"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded border border-gold/10 bg-black/20 px-2 py-1">
                <span>Settlement raid immunity</span>
                <span className="font-semibold text-gold">
                  {villageTimerSummary.settlementImmunityRemainingSeconds > 0
                    ? formatTime(villageTimerSummary.settlementImmunityRemainingSeconds)
                    : "Expired"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded border border-gold/10 bg-black/20 px-2 py-1">
                <span>Post-raid resource immunity window</span>
                <span className="font-semibold text-gold">
                  {villageTimerSummary.postRaidImmunityWindowSeconds > 0
                    ? formatTime(villageTimerSummary.postRaidImmunityWindowSeconds)
                    : "Unavailable"}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xxs text-gold/60 italic">Village timer data unavailable.</p>
          )}
          {shouldRenderMilitiaClaimCard && (
            <div className="mt-2 rounded border border-gold/15 bg-black/20 p-2">
              <button
                type="button"
                onClick={() => {
                  void handleClaimVillageMilitia();
                }}
                disabled={!canClaimVillageMilitia || isClaimingVillageMilitia}
                className={cn(
                  "w-full rounded border px-2 py-1 text-xxs font-semibold uppercase tracking-[0.12em] transition",
                  canClaimVillageMilitia && !isClaimingVillageMilitia
                    ? "border-gold/70 bg-gold/15 text-gold hover:bg-gold/25"
                    : "cursor-not-allowed border-gold/25 bg-black/30 text-gold/50",
                )}
              >
                {isClaimingVillageMilitia
                  ? "Claiming Militia..."
                  : canClaimVillageMilitia
                    ? "Claim Militia (Onchain)"
                    : "Militia Locked"}
              </button>
              {!canClaimVillageMilitia && (
                <p className="mt-1 text-[10px] text-gold/65">Militia claim unlocks after the timer reaches ready.</p>
              )}
            </div>
          )}
        </div>
      )}

      {canShowArmiesCard && (
        <div className="mt-auto flex items-center justify-between text-xxs text-gold/70">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Sword className="h-3 w-3 text-gold/50" />
              <span className="uppercase tracking-wide text-gold/50">Field</span>
              <span className="font-semibold text-gold/90">
                {attackArmyCount}
                {maxAttackArmies !== null ? `/${maxAttackArmies}` : ""}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-gold/50" />
              <span className="uppercase tracking-wide text-gold/50">Guard</span>
              <span className="font-semibold text-gold/90">
                {guardArmyCount}
                {maxGuardArmies !== null ? `/${maxGuardArmies}` : ""}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className={cn(
                "rounded-full border border-gold/30 bg-black/40 p-1 text-gold/80 transition",
                (!isOwned || !structureEntityId || !structureCapabilities.canCreateFieldArmy) &&
                  "cursor-not-allowed opacity-50",
                isOwned &&
                  structureEntityId &&
                  structureCapabilities.canCreateFieldArmy &&
                  "hover:bg-gold/10 hover:text-gold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold",
              )}
              onClick={() => {
                if (!structureEntityId || !isOwned || !structureCapabilities.canCreateFieldArmy) return;
                openArmyCreationPopup({
                  structureId: Number(structureEntityId),
                  isExplorer: true,
                });
              }}
              disabled={!isOwned || !structureEntityId || !structureCapabilities.canCreateFieldArmy}
              aria-label="Create field army"
              title="Create field army"
            >
              <Sword className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={cn(
                "rounded-full border border-gold/30 bg-black/40 p-1 text-gold/80 transition",
                (!isOwned || !structureEntityId || !structureCapabilities.canManageGuardArmy) &&
                  "cursor-not-allowed opacity-50",
                isOwned &&
                  structureEntityId &&
                  structureCapabilities.canManageGuardArmy &&
                  "hover:bg-gold/10 hover:text-gold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold",
              )}
              onClick={() => {
                if (!structureEntityId || !isOwned || !structureCapabilities.canManageGuardArmy) return;
                const maxDefenseSlots = Number(structure?.base?.troop_max_guard_count ?? 0);
                openArmyCreationPopup({
                  structureId: Number(structureEntityId),
                  isExplorer: false,
                  maxDefenseSlots,
                });
              }}
              disabled={!isOwned || !structureEntityId || !structureCapabilities.canManageGuardArmy}
              aria-label="Create defense army"
              title="Create defense army"
            >
              <Shield className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

RealmInfoPanel.displayName = "RealmInfoPanel";
