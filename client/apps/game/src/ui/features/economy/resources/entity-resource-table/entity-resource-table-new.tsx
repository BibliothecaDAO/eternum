import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ProductionModal } from "@/ui/features/settlement";
import {
  calculateDonkeysNeeded,
  getBuildingQuantity,
  getEntityIdFromKeys,
  getIsBlitz,
  getRealmNameById,
  getStructureTypeName,
  getTotalResourceWeightKg,
  isMilitaryResource,
  Position,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import {
  ClientComponents,
  findResourceById,
  getBuildingFromResource,
  getResourceTiers,
  ID,
  RESOURCE_PRECISION,
  ResourcesIds,
  StructureType,
} from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { ComponentValue, getComponentValue, Has } from "@dojoengine/recs";
import clsx from "clsx";
import { ArrowDown, ArrowLeftRight, ArrowUp, Factory, Target, X, Zap } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import {
  ALWAYS_SHOW_RESOURCES,
  BLITZ_UNMANAGEABLE_RESOURCES,
  calculateResourceProductionData,
  formatProductionPerHour,
  formatResourceAmount,
  formatTimeRemaining,
  HIDE_TIME_REMAINING_FOR,
  TIER_DISPLAY_NAMES,
} from "./utils";

interface StructureColumn {
  entityId: number;
  label: string;
  level: number;
  isSelected: boolean;
}

interface ResourceCellData {
  amount: number;
  productionPerSecond: number;
  isProducing: boolean;
  isStorageCapped: boolean;
  outputRemaining: number;
  timeRemainingSeconds: number;
}

interface ResourceSummary {
  resourceId: ResourcesIds;
  totalAmount: number;
  totalProductionPerSecond: number;
  perStructure: Record<number, ResourceCellData>;
}

interface TransferDraft {
  fromStructureId: number;
  toStructureId: number;
  resourceId: ResourcesIds;
  amount: number;
  isProcessing?: boolean;
}

interface InlineEditState {
  structureId: number;
  resourceId: ResourcesIds;
}

interface DragState {
  isDragging: boolean;
  dragData?: {
    structureId: number;
    resourceId: ResourcesIds;
    amount: number;
  };
  dragOverStructureId?: number;
}

interface DragDropAmountDialog {
  isOpen: boolean;
  dragData?: {
    fromStructureId: number;
    toStructureId: number;
    resourceId: ResourcesIds;
    maxAmount: number;
  };
}

interface EntityResourceTableNewProps {
  entityId: ID | undefined;
}

export const EntityResourceTableNew = React.memo(({ entityId }: EntityResourceTableNewProps) => {
  const [showAllResources, setShowAllResources] = useState(false);
  const [transferDrafts, setTransferDrafts] = useState<TransferDraft[]>([]);
  const [inlineEditState, setInlineEditState] = useState<InlineEditState | null>(null);
  const [dragState, setDragState] = useState<DragState>({ isDragging: false });
  const [dragDropDialog, setDragDropDialog] = useState<DragDropAmountDialog>({ isOpen: false });
  const [transferAnimations, setTransferAnimations] = useState<Set<string>>(new Set());
  const [showHelpBanner, setShowHelpBanner] = useState(() => localStorage.getItem("hideResourceTableHelp") !== "true");
  const [pinSelectedColumn, setPinSelectedColumn] = useState(
    () => localStorage.getItem("pinSelectedColumn") === "true",
  );

  const playerStructures = useUIStore((state) => state.playerStructures);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const togglePopup = useUIStore((state) => state.togglePopup);
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const goToStructure = useGoToStructure();
  const { isMapView } = useQuery();
  const {
    setup: {
      components,
      systemCalls: { send_resources_multiple },
    },
    account: { account },
  } = useDojo();
  const { currentDefaultTick } = useBlockTimestamp();

  const selectedStructureId = entityId && entityId !== 0 ? Number(entityId) : null;

  const structureColumns = useMemo<StructureColumn[]>(() => {
    const isBlitz = getIsBlitz();

    const columns = playerStructures
      .filter((structure) => structure.isMine)
      .map((structure) => {
        const realmId = Number(structure.structure.metadata.realm_id || 0);
        const label = realmId
          ? getRealmNameById(realmId) || `Realm #${realmId}`
          : getStructureTypeName(structure.structure.base.category as StructureType, isBlitz) || "Structure";

        return {
          entityId: Number(structure.entityId),
          label,
          level: structure.structure.base.level || 1,
          isSelected: selectedStructureId ? Number(structure.entityId) === selectedStructureId : false,
        };
      })
      .sort((a, b) => a.entityId - b.entityId);

    // If pin is enabled and there's a selected column, move it to the front
    if (pinSelectedColumn && selectedStructureId) {
      const selectedIndex = columns.findIndex((col) => col.entityId === selectedStructureId);
      if (selectedIndex > 0) {
        const [selectedColumn] = columns.splice(selectedIndex, 1);
        columns.unshift(selectedColumn);
      }
    }

    return columns;
  }, [playerStructures, selectedStructureId, pinSelectedColumn]);

  const structureIdSet = useMemo(() => new Set(structureColumns.map((column) => column.entityId)), [structureColumns]);

  const resourceEntities = useEntityQuery([Has(components.Resource)]);

  const resourcesByStructure = useMemo(() => {
    const map = new Map<number, ComponentValue<ClientComponents["Resource"]["schema"]>>();
    if (structureIdSet.size === 0) return map;

    resourceEntities.forEach((entity) => {
      const resourceValue = getComponentValue(components.Resource, entity);
      if (!resourceValue) return;

      const structureEntityId = Number(resourceValue.entity_id || 0);
      if (structureIdSet.has(structureEntityId)) {
        map.set(structureEntityId, resourceValue as ComponentValue<ClientComponents["Resource"]["schema"]>);
      }
    });

    return map;
  }, [resourceEntities, structureIdSet, components.Resource]);

  const resourceSummaries = useMemo(() => {
    const summaries = new Map<ResourcesIds, ResourceSummary>();

    resourcesByStructure.forEach((resourceValue, structure) => {
      const balances = ResourceManager.getResourceBalancesWithProduction(resourceValue, currentDefaultTick || 0);

      balances.forEach(({ resourceId, amount }) => {
        const productionInfo = ResourceManager.balanceAndProduction(resourceValue, resourceId);
        const { hasReachedMaxCapacity, balance } = ResourceManager.balanceWithProduction(
          resourceValue,
          currentDefaultTick || 0,
          resourceId,
        );

        const { productionPerSecond, isProducing, outputRemaining, timeRemainingSeconds } =
          calculateResourceProductionData(resourceId, productionInfo, currentDefaultTick || 0);

        // Only count production rate if actually producing
        const activeProductionRate = isProducing ? productionPerSecond : 0;

        const existing = summaries.get(resourceId);
        if (!existing) {
          summaries.set(resourceId, {
            resourceId,
            totalAmount: balance,
            totalProductionPerSecond: activeProductionRate,
            perStructure: {
              [structure]: {
                amount,
                productionPerSecond,
                isProducing,
                isStorageCapped: hasReachedMaxCapacity,
                outputRemaining,
                timeRemainingSeconds,
              },
            },
          });
        } else {
          existing.totalAmount += balance;
          existing.totalProductionPerSecond += activeProductionRate;
          existing.perStructure[structure] = {
            amount,
            productionPerSecond,
            isProducing,
            isStorageCapped: hasReachedMaxCapacity,
            outputRemaining,
            timeRemainingSeconds,
          };
        }
      });
    });

    return summaries;
  }, [resourcesByStructure, currentDefaultTick]);

  const tiers = useMemo(() => Object.entries(getResourceTiers(getIsBlitz())), []);

  if (structureColumns.length === 0) {
    return <div className="p-3 text-xs text-gold/70">Own a structure to begin tracking your resources.</div>;
  }

  const highlightedStructure = structureColumns.find((structure) => structure.isSelected)?.label;
  const isBlitz = getIsBlitz();

  const handleSelectStructure = useCallback(
    (structureId: number) => {
      // Don't do anything if clicking the already selected structure
      if (selectedStructureId === structureId) return;

      // Get structure position and navigate based on current view mode
      const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(structureId)]));
      if (structure) {
        const position = new Position({ x: structure.base.coord_x, y: structure.base.coord_y });
        // Use goToStructure which handles both map view and hex view
        goToStructure(structureId as ID, position, isMapView);
      }
    },
    [components.Structure, goToStructure, isMapView, selectedStructureId],
  );

  const handleManageProduction = useCallback(
    (structureId: number, resourceId: ResourcesIds) => {
      // Select the structure first by setting entity ID, then open modal
      setStructureEntityId(structureId);
      toggleModal(<ProductionModal preSelectedResource={resourceId} />);
    },
    [setStructureEntityId, toggleModal],
  );

  const handleOpenTransfer = useCallback(
    (resourceId: ResourcesIds) => {
      if (!selectedStructureId) return;
      setStructureEntityId(selectedStructureId);
      togglePopup(resourceId.toString());
    },
    [selectedStructureId, setStructureEntityId, togglePopup],
  );

  const getResourceBalance = useCallback(
    (structureId: number, resourceId: ResourcesIds) => {
      const resourceManager = new ResourceManager(components, structureId);
      return resourceManager.balanceWithProduction(currentDefaultTick || 0, resourceId).balance;
    },
    [components, currentDefaultTick],
  );

  const canTransferResource = useCallback(
    (fromStructureId: number, toStructureId: number, resourceId: ResourcesIds) => {
      const fromStructure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(fromStructureId)]));
      const toStructure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(toStructureId)]));

      if (!fromStructure || !toStructure) return false;

      return (
        !isMilitaryResource(resourceId) ||
        (fromStructure.category === StructureType.Realm && toStructure.category === StructureType.Realm)
      );
    },
    [components],
  );

  const matchesTransfer = useCallback(
    (t: TransferDraft, transfer: TransferDraft) =>
      t.fromStructureId === transfer.fromStructureId &&
      t.toStructureId === transfer.toStructureId &&
      t.resourceId === transfer.resourceId,
    [],
  );

  const executeTransfer = useCallback(
    async (transfer: TransferDraft) => {
      if (!account) return;

      setTransferDrafts((prev) => prev.map((t) => (matchesTransfer(t, transfer) ? { ...t, isProcessing: true } : t)));

      const animationKey = `${transfer.fromStructureId}-${transfer.toStructureId}-${transfer.resourceId}`;
      setTransferAnimations((prev) => new Set([...prev, animationKey]));

      try {
        await send_resources_multiple({
          signer: account,
          calls: [
            {
              sender_entity_id: transfer.fromStructureId,
              recipient_entity_id: transfer.toStructureId,
              resources: [transfer.resourceId, BigInt(Math.round(transfer.amount * RESOURCE_PRECISION))],
            },
          ],
        });

        setTransferDrafts((prev) => prev.filter((t) => !matchesTransfer(t, transfer)));
      } catch (error) {
        console.error("Transfer failed:", error);
        setTransferDrafts((prev) =>
          prev.map((t) => (matchesTransfer(t, transfer) ? { ...t, isProcessing: false } : t)),
        );
      } finally {
        setTimeout(() => {
          setTransferAnimations((prev) => {
            const newSet = new Set(prev);
            newSet.delete(animationKey);
            return newSet;
          });
        }, 2000);
      }
    },
    [account, send_resources_multiple, matchesTransfer],
  );

  const handleDragStart = (structureId: number, resourceId: ResourcesIds, amount: number) => {
    setDragState({
      isDragging: true,
      dragData: { structureId, resourceId, amount },
    });
  };

  const handleDragEnd = () => {
    // If we have dragOverStructureId when ending, it means drop didn't fire - trigger it manually
    if (dragState.dragOverStructureId && dragState.dragData) {
      const targetStructureId = dragState.dragOverStructureId;
      const currentDragData = dragState.dragData;

      if (currentDragData.structureId !== targetStructureId) {
        const canTransfer = canTransferResource(
          currentDragData.structureId,
          targetStructureId,
          currentDragData.resourceId,
        );

        if (canTransfer) {
          const dialogData = {
            fromStructureId: currentDragData.structureId,
            toStructureId: targetStructureId,
            resourceId: currentDragData.resourceId,
            maxAmount: currentDragData.amount / RESOURCE_PRECISION,
          };

          setDragState({ isDragging: false });

          requestAnimationFrame(() => {
            setDragDropDialog({
              isOpen: true,
              dragData: dialogData,
            });
          });
          return;
        }
      }
    }

    setDragState({ isDragging: false });
  };

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetStructureId: number) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";

      if (dragState.isDragging && dragState.dragData) {
        const canTransfer = canTransferResource(
          dragState.dragData.structureId,
          targetStructureId,
          dragState.dragData.resourceId,
        );
        if (canTransfer) {
          setDragState((prev) => ({ ...prev, dragOverStructureId: targetStructureId }));
        }
      }
    },
    [dragState.isDragging, dragState.dragData, canTransferResource],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetStructureId: number) => {
      e.preventDefault();
      e.stopPropagation();

      // Capture drag data immediately before any state changes
      const currentDragData = dragState.dragData;

      if (!currentDragData || currentDragData.structureId === targetStructureId) {
        handleDragEnd();
        return;
      }

      const canTransfer = canTransferResource(
        currentDragData.structureId,
        targetStructureId,
        currentDragData.resourceId,
      );

      if (canTransfer) {
        const dialogData = {
          fromStructureId: currentDragData.structureId,
          toStructureId: targetStructureId,
          resourceId: currentDragData.resourceId,
          maxAmount: currentDragData.amount / RESOURCE_PRECISION,
        };

        // Use requestAnimationFrame to ensure dialog is set after drag end
        handleDragEnd();
        requestAnimationFrame(() => {
          setDragDropDialog({
            isOpen: true,
            dragData: dialogData,
          });
        });
      } else {
        handleDragEnd();
      }
    },
    [dragState.dragData, canTransferResource, handleDragEnd],
  );

  const handleDoubleClick = useCallback(
    (structureId: number, resourceId: ResourcesIds) => {
      const balance = getResourceBalance(structureId, resourceId);
      if (balance && Number(balance) > 0) {
        setInlineEditState({ structureId, resourceId });
      }
    },
    [getResourceBalance],
  );

  const handleInlineDestinationSelect = useCallback(
    (destinationId: number) => {
      if (!inlineEditState) return;

      const balance = getResourceBalance(inlineEditState.structureId, inlineEditState.resourceId);
      const maxAmount = balance ? Number(balance) / RESOURCE_PRECISION : 0;

      // Close inline edit and open drag-drop dialog
      setInlineEditState(null);
      setDragDropDialog({
        isOpen: true,
        dragData: {
          fromStructureId: inlineEditState.structureId,
          toStructureId: destinationId,
          resourceId: inlineEditState.resourceId,
          maxAmount,
        },
      });
    },
    [inlineEditState, getResourceBalance],
  );

  const getPendingTransfers = useCallback(
    (structureId: number, resourceId: ResourcesIds) => {
      return transferDrafts.filter(
        (t) => (t.fromStructureId === structureId || t.toStructureId === structureId) && t.resourceId === resourceId,
      );
    },
    [transferDrafts],
  );

  const handleDragDropConfirm = useCallback(
    async (amount: number, sendNow?: boolean) => {
      if (!dragDropDialog.dragData) return;

      const transfer: TransferDraft = {
        fromStructureId: dragDropDialog.dragData.fromStructureId,
        toStructureId: dragDropDialog.dragData.toStructureId,
        resourceId: dragDropDialog.dragData.resourceId,
        amount,
      };

      if (sendNow) {
        // Execute transfer immediately
        await executeTransfer(transfer);
      } else {
        // Add to queue
        setTransferDrafts((prev) => [...prev, transfer]);
      }

      setDragDropDialog({ isOpen: false });
    },
    [dragDropDialog.dragData, executeTransfer],
  );

  const handleDragDropCancel = () => setDragDropDialog({ isOpen: false });

  const handleDismissHelp = () => {
    setShowHelpBanner(false);
    localStorage.setItem("hideResourceTableHelp", "true");
  };

  return (
    <div className="flex h-full flex-col gap-4 p-2">
      {/* Help Banner */}
      {showHelpBanner && (
        <div className="rounded-xl border border-blue/30 bg-blue/10 p-3 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-blue">💡 Quick Tips</span>
              </div>
              <ul className="space-y-1 text-xs text-blue/90">
                <li className="flex items-start gap-2">
                  <span className="text-blue/70">•</span>
                  <span>
                    <strong>Drag & Drop:</strong> Drag resources between columns to transfer them across realms
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue/70">•</span>
                  <span>
                    <strong>Cycle Realms:</strong> Click column headers to navigate between realms in{" "}
                    {isMapView ? "world" : "local"} view
                  </span>
                </li>
              </ul>
            </div>
            <button
              onClick={handleDismissHelp}
              className="text-blue/60 hover:text-blue transition-colors"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gold/25 bg-dark-wood/80 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-gold">Resource overview</h4>
            <p className="text-[11px] text-gold/60">
              {structureColumns.length} structures synced
              {highlightedStructure ? ` • ${highlightedStructure} highlighted` : " • select a structure to manage"}
            </p>
          </div>
          <div className="flex gap-2">
            <label className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1 text-[11px] text-gold/70">
              <span className={clsx(pinSelectedColumn && "text-gold")}>Pin Selected Realm</span>
              <div className="relative">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={pinSelectedColumn}
                  onChange={() => {
                    const newValue = !pinSelectedColumn;
                    setPinSelectedColumn(newValue);
                    localStorage.setItem("pinSelectedColumn", String(newValue));
                  }}
                />
                <div className="h-5 w-9 rounded-full bg-brown/50 transition peer-checked:bg-gold/30">
                  <div className="absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-gold transition peer-checked:translate-x-4" />
                </div>
              </div>
            </label>
            <label className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1 text-[11px] text-gold/70">
              <span className={clsx(!showAllResources && "text-gold")}>Hide empty</span>
              <div className="relative">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={!showAllResources}
                  onChange={() => setShowAllResources((prev) => !prev)}
                />
                <div className="h-5 w-9 rounded-full bg-brown/50 transition peer-checked:bg-gold/30">
                  <div className="absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-gold transition peer-checked:translate-x-4" />
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Transfer Queue */}
        {transferDrafts.length > 0 && (
          <div className="mt-4 rounded-2xl border border-gold/25 bg-dark-wood/80 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-semibold uppercase tracking-wide text-gold">
                Transfer Queue ({transferDrafts.length})
              </h4>
              <button
                onClick={() => setTransferDrafts([])}
                className="text-xs text-gold/60 hover:text-gold transition-colors"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {transferDrafts.map((draft, index) => (
                <TransferQueueItem
                  key={`${draft.fromStructureId}-${draft.toStructureId}-${draft.resourceId}`}
                  draft={draft}
                  structureColumns={structureColumns}
                  onExecute={() => executeTransfer(draft)}
                  onRemove={() => setTransferDrafts((prev) => prev.filter((_, i) => i !== index))}
                />
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-gold/10">
              <div className="flex gap-2">
                <button
                  onClick={() => transferDrafts.filter((d) => !d.isProcessing).forEach(executeTransfer)}
                  disabled={transferDrafts.every((d) => d.isProcessing)}
                  className="px-3 py-1 text-xs bg-gold/20 text-gold rounded hover:bg-gold/30 transition-colors disabled:opacity-50"
                >
                  Send All
                </button>
                <span className="text-xs text-gold/60 flex items-center">
                  {transferDrafts.filter((d) => !d.isProcessing).length} pending
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 overflow-x-auto rounded-xl border border-gold/15 bg-dark-wood/60">
          <table className="min-w-full text-left text-xxs">
            <thead className="sticky top-0 bg-dark-wood/80 backdrop-blur">
              <tr className="border-b border-gold/15 text-[10px] uppercase text-gold/70">
                <th className="px-3 py-2 font-semibold border-r border-gold/[0.07] sticky left-0 bg-dark-wood/95 backdrop-blur z-10 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span>Resource</span>
                  </div>
                </th>
                <th className="px-3 py-2 font-semibold border-r border-gold/[0.07]">
                  <div className="flex items-center gap-1">
                    <span>Total</span>
                    <span className="text-[9px] text-gold/50 normal-case"></span>
                  </div>
                </th>
                {structureColumns.map((structure) => (
                  <th
                    key={structure.entityId}
                    className={clsx(
                      "px-3 py-2 cursor-pointer border-r border-gold/[0.07] last:border-r-0 transition-colors hover:bg-gold/5",
                      structure.isSelected && "bg-gold/10",
                    )}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectStructure(structure.entityId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleSelectStructure(structure.entityId);
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      {structure.isSelected && <Target className="h-3 w-3 text-gold" />}
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={clsx(
                            "font-semibold leading-tight text-[11px]",
                            structure.isSelected && "text-gold",
                          )}
                        >
                          {structure.label}
                        </span>
                        <span className="text-[9px] text-gold/50 font-normal">Level {structure.level}</span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tiers.map(([tier, resourceIds]) => {
                const rows = resourceIds.filter((resourceId: ResourcesIds) => {
                  const summary = resourceSummaries.get(resourceId);
                  if (!summary) return showAllResources || ALWAYS_SHOW_RESOURCES.includes(resourceId);
                  return showAllResources || summary.totalAmount > 0 || ALWAYS_SHOW_RESOURCES.includes(resourceId);
                });

                if (rows.length === 0) return null;

                return (
                  <React.Fragment key={tier}>
                    <tr className="bg-gold/5 text-[10px] uppercase tracking-wide text-gold/70">
                      <td className="px-2 py-1" colSpan={structureColumns.length + 2}>
                        {TIER_DISPLAY_NAMES[tier] || tier}
                      </td>
                    </tr>
                    {rows.map((resourceId: ResourcesIds) => {
                      const summary = resourceSummaries.get(resourceId);
                      const resourceKey = ResourcesIds[resourceId];

                      return (
                        <tr
                          key={resourceId}
                          className="border-b border-gold/10 last:border-b-0 hover:bg-gold/[0.02] transition-colors"
                        >
                          <td className="px-3 py-2 border-r border-gold/[0.07] sticky left-0 bg-dark-wood/95 backdrop-blur z-10 shadow-sm">
                            <div className="flex items-center gap-2">
                              <ResourceIcon resource={resourceKey} size="md" />
                              <span className="text-[11px] font-semibold text-gold/90">{resourceKey}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 border-r border-gold/[0.07]">
                            {summary ? (
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-[11px] font-bold text-gold">
                                  {formatResourceAmount(summary.totalAmount)}
                                </span>
                                <span
                                  className={clsx(
                                    "text-[10px]",
                                    summary.totalProductionPerSecond > 0 ? "text-green/70" : "text-gold/40",
                                  )}
                                >
                                  {formatProductionPerHour(summary.totalProductionPerSecond)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-gold/30">—</span>
                            )}
                          </td>
                          {structureColumns.map((structure) => {
                            const cell = summary?.perStructure[structure.entityId];
                            const isSelectedStructure = selectedStructureId === structure.entityId;

                            // Check for actual building existence (not just production.building_count)
                            const actualBuildingCount = getBuildingQuantity(
                              structure.entityId,
                              getBuildingFromResource(resourceId),
                              components,
                            );
                            const hasProductionBuilding = Boolean(
                              actualBuildingCount > 0 &&
                                (!isBlitz || !BLITZ_UNMANAGEABLE_RESOURCES.includes(resourceId)),
                            );

                            return (
                              <td
                                key={structure.entityId}
                                className={clsx(
                                  "px-2 py-1.5 align-top cursor-pointer border-r border-gold/[0.07] last:border-r-0",
                                  structure.isSelected && "bg-gold/10",
                                )}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleSelectStructure(structure.entityId)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    handleSelectStructure(structure.entityId);
                                  }
                                }}
                              >
                                {cell ? (
                                  <TransferCell
                                    key={`${structure.entityId}-${resourceId}`}
                                    structureId={structure.entityId}
                                    resourceId={resourceId}
                                    cell={cell}
                                    isSelectedStructure={isSelectedStructure}
                                    hasProductionBuilding={hasProductionBuilding}
                                    onManageProduction={() => handleManageProduction(structure.entityId, resourceId)}
                                    onOpenTransfer={() => handleOpenTransfer(resourceId)}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                    onDoubleClick={handleDoubleClick}
                                    dragState={dragState}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    pendingTransfers={getPendingTransfers(structure.entityId, resourceId)}
                                    transferAnimations={transferAnimations}
                                    inlineEditState={inlineEditState}
                                    onInlineEditChange={setInlineEditState}
                                    onInlineDestinationSelect={handleInlineDestinationSelect}
                                    structureColumns={structureColumns}
                                  />
                                ) : (
                                  <div
                                    className={clsx(
                                      "min-h-[40px] flex items-center justify-center rounded-md transition-all",
                                      dragState.isDragging &&
                                        dragState.dragOverStructureId === structure.entityId &&
                                        dragState.dragData?.resourceId === resourceId &&
                                        canTransferResource(
                                          dragState.dragData.structureId,
                                          structure.entityId,
                                          resourceId,
                                        )
                                        ? "bg-gold/20 border-2 border-dashed border-gold/60"
                                        : "border border-transparent",
                                    )}
                                    onDragOver={(e) => handleDragOver(e, structure.entityId)}
                                    onDrop={(e) => handleDrop(e, structure.entityId)}
                                  >
                                    <span className="text-[11px] text-gold/30">-</span>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drag & Drop Amount Dialog */}
      {dragDropDialog.isOpen && dragDropDialog.dragData && (
        <DragDropAmountDialog
          dragData={dragDropDialog.dragData}
          onConfirm={handleDragDropConfirm}
          onCancel={handleDragDropCancel}
          structureColumns={structureColumns}
        />
      )}
    </div>
  );
});

// Enhanced Transfer Cell Component
interface TransferCellProps {
  structureId: number;
  resourceId: ResourcesIds;
  cell: ResourceCellData;
  isSelectedStructure: boolean;
  hasProductionBuilding: boolean;
  onManageProduction: () => void;
  onOpenTransfer: () => void;
  onDragStart: (structureId: number, resourceId: ResourcesIds, amount: number) => void;
  onDragEnd: () => void;
  onDoubleClick: (structureId: number, resourceId: ResourcesIds) => void;
  dragState: DragState;
  onDragOver: (e: React.DragEvent, targetStructureId: number) => void;
  onDrop: (e: React.DragEvent, targetStructureId: number) => void;
  pendingTransfers: TransferDraft[];
  transferAnimations: Set<string>;
  inlineEditState: InlineEditState | null;
  onInlineEditChange: (state: InlineEditState | null) => void;
  onInlineDestinationSelect: (destinationId: number) => void;
  structureColumns: Array<{ entityId: number; label: string }>;
}

const TransferCell = React.memo((props: TransferCellProps) => {
  const {
    structureId,
    resourceId,
    cell,
    isSelectedStructure,
    hasProductionBuilding,
    onManageProduction,
    onOpenTransfer,
    onDragStart,
    onDragEnd,
    onDoubleClick,
    dragState,
    onDragOver,
    onDrop,
    pendingTransfers,
    transferAnimations,
    inlineEditState,
    onInlineEditChange,
    onInlineDestinationSelect,
    structureColumns,
  } = props;
  const [isHovered, setIsHovered] = useState(false);
  const pendingOutgoing = useMemo(
    () => pendingTransfers.filter((t) => t.fromStructureId === structureId),
    [pendingTransfers, structureId],
  );
  const pendingIncoming = useMemo(
    () => pendingTransfers.filter((t) => t.toStructureId === structureId),
    [pendingTransfers, structureId],
  );
  const totalOutgoing = useMemo(() => pendingOutgoing.reduce((sum, t) => sum + t.amount, 0), [pendingOutgoing]);
  const totalIncoming = useMemo(() => pendingIncoming.reduce((sum, t) => sum + t.amount, 0), [pendingIncoming]);
  const isInlineEditing = inlineEditState?.structureId === structureId && inlineEditState?.resourceId === resourceId;
  const animationKey =
    transferAnimations.has(`${structureId}-*-${resourceId}`) ||
    transferAnimations.has(`*-${structureId}-${resourceId}`);

  // Removed expensive suggestions for performance

  const isDragTarget =
    dragState.isDragging &&
    dragState.dragOverStructureId === structureId &&
    dragState.dragData?.resourceId === resourceId &&
    dragState.dragData?.structureId !== structureId;

  const handleCellDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSelectedStructure || cell.amount <= 0) return;
    onDoubleClick(structureId, resourceId);
  };

  // Removed timeout cleanup for performance

  return (
    <div
      className={clsx(
        "min-h-[40px] p-1.5 rounded-md transition-all duration-200 relative group",
        isSelectedStructure && "bg-gold/5",
        isDragTarget && "bg-gold/20 border-2 border-dashed border-gold/60 scale-105",
        isHovered && !isDragTarget && "bg-gold/10",
        animationKey && "animate-pulse",
      )}
      draggable={cell.amount > 0}
      onDragStart={() => cell.amount > 0 && onDragStart(structureId, resourceId, cell.amount)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, structureId)}
      onDrop={(e) => onDrop(e, structureId)}
      onDoubleClick={handleCellDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`Double-click to transfer • Drag to another structure`}
    >
      {/* Main Content */}
      <div className="flex items-start justify-between gap-2">
        {/* Left: Resource info */}
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] font-medium text-gold/90">{formatResourceAmount(cell.amount)}</span>
            {(pendingOutgoing.length > 0 || pendingIncoming.length > 0) && (
              <div className="flex items-center gap-0.5">
                {pendingOutgoing.length > 0 && (
                  <span className="text-[10px] text-red/70 flex items-center gap-0.5">
                    <ArrowDown className="h-2.5 w-2.5" />-{totalOutgoing}
                  </span>
                )}
                {pendingIncoming.length > 0 && (
                  <span className="text-[10px] text-green/70 flex items-center gap-0.5">
                    <ArrowUp className="h-2.5 w-2.5" />+{totalIncoming}
                  </span>
                )}
              </div>
            )}
          </div>
          {cell.isProducing && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gold/60">{formatProductionPerHour(cell.productionPerSecond)}</span>
              {cell.outputRemaining > 0 && !cell.isStorageCapped && !HIDE_TIME_REMAINING_FOR.includes(resourceId) && (
                <span className="text-[10px] text-blue/60" title="Time until production runs out">
                  ({formatTimeRemaining(cell.timeRemainingSeconds)})
                </span>
              )}
            </div>
          )}
          {cell.isStorageCapped && <span className="text-[10px] text-red/70">Storage full</span>}
        </div>

        {/* Right: Action Buttons */}
        {!isInlineEditing && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {hasProductionBuilding && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onManageProduction();
                }}
                className="rounded border border-gold/20 bg-gold/10 p-0.5 text-gold transition hover:bg-gold/20"
                title="Manage production"
              >
                <Factory className="h-2.5 w-2.5" />
              </button>
            )}
            {isSelectedStructure && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenTransfer();
                  }}
                  className="rounded border border-gold/20 bg-gold/10 p-0.5 text-gold transition hover:bg-gold/20 opacity-0 group-hover:opacity-100"
                  title="Open transfer modal"
                >
                  <ArrowLeftRight className="h-2.5 w-2.5" />
                </button>
                {cell.amount > 0 && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDoubleClick(structureId, resourceId);
                    }}
                    className="rounded border border-gold/20 bg-gold/10 p-0.5 text-gold transition hover:bg-gold/20 opacity-0 group-hover:opacity-100"
                    title="Quick transfer"
                  >
                    <Zap className="h-2.5 w-2.5" />
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Inline Edit Mode - Just destination selector */}
        {isInlineEditing && (
          <div className="mt-1.5 space-y-1.5 bg-gold/10 p-1.5 rounded border border-gold/30">
            <select
              value=""
              onChange={(e) => {
                e.stopPropagation();
                e.target.value && onInlineDestinationSelect(Number(e.target.value));
              }}
              className="w-full px-2 py-1 text-[11px] bg-brown/20 border border-gold/30 rounded text-gold"
              autoFocus
            >
              <option value="">Select destination...</option>
              {structureColumns
                .filter((col) => col.entityId !== structureId)
                .map((col) => (
                  <option key={col.entityId} value={col.entityId}>
                    {col.label}
                  </option>
                ))}
            </select>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onInlineEditChange(null);
              }}
              className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] bg-red/20 text-red rounded hover:bg-red/30"
            >
              <X className="h-2.5 w-2.5" />
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Drag Feedback */}
      {isDragTarget && (
        <div className="absolute inset-0 flex items-center justify-center bg-gold/20 rounded-md">
          <Target className="h-6 w-6 text-gold animate-bounce" />
        </div>
      )}
    </div>
  );
});

const TransferQueueItem = React.memo(
  ({
    draft,
    structureColumns,
    onExecute,
    onRemove,
  }: {
    draft: TransferDraft;
    structureColumns: StructureColumn[];
    onExecute: () => void;
    onRemove: () => void;
  }) => {
    const fromStructure = structureColumns.find((s) => s.entityId === draft.fromStructureId);
    const toStructure = structureColumns.find((s) => s.entityId === draft.toStructureId);
    const resourceKey = ResourcesIds[draft.resourceId];

    return (
      <div
        className={clsx(
          "flex items-center justify-between gap-3 p-2 rounded border",
          draft.isProcessing ? "border-blue/30 bg-blue/10 animate-pulse" : "border-gold/20 bg-gold/5",
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ResourceIcon resource={resourceKey} size="sm" />
          <span className="text-xs text-gold/90 truncate">
            {draft.amount} {resourceKey}
          </span>
          <span className="text-xs text-gold/60">
            {fromStructure?.label} → {toStructure?.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {draft.isProcessing ? (
            <span className="text-xs text-blue/80">Processing...</span>
          ) : (
            <>
              <button
                onClick={onExecute}
                className="px-2 py-1 text-xs bg-gold/20 text-gold rounded hover:bg-gold/30 transition-colors"
              >
                Send
              </button>
              <button
                onClick={onRemove}
                className="px-2 py-1 text-xs bg-red/20 text-red rounded hover:bg-red/30 transition-colors"
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>
    );
  },
);

// Drag & Drop Amount Selection Dialog
const DragDropAmountDialog = React.memo(
  ({
    dragData,
    onConfirm,
    onCancel,
    structureColumns,
  }: {
    dragData: {
      fromStructureId: number;
      toStructureId: number;
      resourceId: ResourcesIds;
      maxAmount: number;
    };
    onConfirm: (amount: number, sendNow?: boolean) => void;
    onCancel: () => void;
    structureColumns: Array<{ entityId: number; label: string }>;
  }) => {
    const [amount, setAmount] = useState(() => {
      const defaultAmount = Math.min(dragData.maxAmount * 0.1, 100);
      return Number(defaultAmount.toFixed(2));
    });
    const {
      setup: { components },
    } = useDojo();

    const resourceKey = ResourcesIds[dragData.resourceId];
    const fromStructure = structureColumns.find((s) => s.entityId === dragData.fromStructureId);
    const toStructure = structureColumns.find((s) => s.entityId === dragData.toStructureId);

    const resourceWeight = useMemo(
      () => getTotalResourceWeightKg([{ resourceId: dragData.resourceId, amount }]),
      [dragData.resourceId, amount],
    );

    const neededDonkeys = useMemo(() => calculateDonkeysNeeded(resourceWeight), [resourceWeight]);

    const availableDonkeys = useMemo(() => {
      const resourceManager = new ResourceManager(components, dragData.fromStructureId);
      const donkeyBalance = resourceManager.balance(ResourcesIds.Donkey);
      return donkeyBalance ? Number(donkeyBalance) / RESOURCE_PRECISION : 0;
    }, [components, dragData.fromStructureId]);

    const recipientBalance = useMemo(() => {
      const resourceManager = new ResourceManager(components, dragData.toStructureId);
      const balance = resourceManager.balance(dragData.resourceId);
      return balance ? Number(balance) / RESOURCE_PRECISION : 0;
    }, [components, dragData.toStructureId, dragData.resourceId]);

    const canCarry = availableDonkeys >= neededDonkeys;
    const donkeyTrait = findResourceById(ResourcesIds.Donkey)?.trait as string;

    const isValidTransfer = amount > 0 && amount <= dragData.maxAmount && canCarry;

    const handleQueue = (e: React.FormEvent) => {
      e.preventDefault();
      isValidTransfer && onConfirm(amount);
    };

    const handleSendNow = () => isValidTransfer && onConfirm(amount, true);

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-dark-wood border border-gold/30 rounded-lg p-6 shadow-xl min-w-[400px]">
          <div className="flex items-center gap-3 mb-4">
            <ResourceIcon resource={resourceKey} size="lg" />
            <div>
              <h3 className="text-gold font-semibold">Transfer {resourceKey}</h3>
              <p className="text-xs text-gold/60">
                {fromStructure?.label} → {toStructure?.label}
              </p>
            </div>
          </div>

          <form onSubmit={handleQueue} className="space-y-4">
            <div>
              <label className="block text-sm text-gold/80 mb-2">Amount to transfer (max: {dragData.maxAmount})</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                max={dragData.maxAmount}
                min={0.01}
                step="any"
                className="w-full px-3 py-2 bg-brown/20 border border-gold/30 rounded text-gold focus:border-gold/60 focus:outline-none"
                autoFocus
              />
            </div>

            {/* Balance Preview */}
            {amount > 0 && (
              <div className="bg-brown/10 rounded p-2 border border-gold/20">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ResourceIcon resource={resourceKey} size="sm" withTooltip={false} />
                  <span className="text-xs font-medium text-gold/90">Balance Preview</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gold/70">{fromStructure?.label}:</span>
                    <span className="text-gold">
                      {dragData.maxAmount} → {dragData.maxAmount - amount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gold/70">{toStructure?.label}:</span>
                    <span className="text-green">
                      {recipientBalance} → {recipientBalance + amount}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Donkey Requirements */}
            <div className="bg-brown/10 rounded p-3 border border-gold/20">
              <div className="flex items-center gap-2 mb-2">
                <ResourceIcon resource={donkeyTrait} size="sm" withTooltip={false} />
                <span className="text-sm font-medium text-gold/90">Transport</span>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gold/70">Available:</span>
                  <span className="text-gold font-medium">{availableDonkeys.toLocaleString()} 🐴</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gold/70">Required:</span>
                  <span className={clsx("font-medium", canCarry ? "text-green" : "text-red")}>
                    {neededDonkeys.toLocaleString()} 🐴
                  </span>
                </div>
              </div>

              {!canCarry && (
                <div className="mt-3 p-2 bg-red/10 border border-red/20 rounded text-xs text-red">
                  ❌ Need {(neededDonkeys - availableDonkeys).toLocaleString()} more donkeys
                </div>
              )}
              {canCarry && neededDonkeys > 0 && (
                <div className="mt-3 p-2 bg-green/10 border border-green/20 rounded text-xs text-green">
                  Sufficient Donkey Capacity
                </div>
              )}
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex gap-2">
              {[0.25, 0.5, 0.75, 1].map((percentage) => (
                <button
                  key={percentage}
                  type="button"
                  onClick={() => setAmount(Number((dragData.maxAmount * percentage).toFixed(2)))}
                  className="px-3 py-1 text-xs bg-gold/20 text-gold rounded hover:bg-gold/30 transition-colors"
                >
                  {percentage === 1 ? "All" : `${percentage * 100}%`}
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={!isValidTransfer}
                className="flex-1 px-4 py-2 bg-blue/20 text-blue rounded hover:bg-blue/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!canCarry ? "Insufficient Donkeys" : "Queue"}
              </button>
              <button
                type="button"
                onClick={handleSendNow}
                disabled={!isValidTransfer}
                className="flex-1 px-4 py-2 bg-gold/20 text-gold rounded hover:bg-gold/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 bg-red/20 text-red rounded hover:bg-red/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  },
);
