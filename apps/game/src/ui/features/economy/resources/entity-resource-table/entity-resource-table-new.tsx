import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { structureMapPosition } from "@bibliothecadao/eternum";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { ResourceBurnPopover } from "@/ui/features/economy/resources/resource-burn-popover";
import { openTransfer } from "@/ui/features/economy/transfers/transfer-window";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView, RESOURCE_FACTS } from "@/sync/fact-views";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ProductionModal } from "@/ui/features/settlement/production/production-modal";
import {
  configManager,
  getBuildingQuantity,
  getRealmNameById,
  isMilitaryResource,
  Position,
  ResourceManager,
} from "@bibliothecadao/eternum";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { getBuildingFromResource, ID, ResourcesIds, StructureType } from "@bibliothecadao/types";
import clsx from "clsx";

import React, { useCallback, useMemo, useState } from "react";
import {
  ALWAYS_SHOW_RESOURCES,
  formatProductionPerHour,
  formatResourceAmount,
  formatTimeRemaining,
  HIDE_TIME_REMAINING_FOR,
  TIER_DISPLAY_NAMES,
} from "./utils";
import { presentedMineKind } from "@bibliothecadao/eternum";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

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

interface DragState {
  isDragging: boolean;
  dragData?: {
    structureId: number;
    resourceId: ResourcesIds;
    amount: number;
  };
  dragOverStructureId?: number;
}

interface EntityResourceTableNewProps {
  entityId: ID | undefined;
}

export const EntityResourceTableNew = React.memo(({ entityId }: EntityResourceTableNewProps) => {
  const [showAllResources, setShowAllResources] = useState(false);
  const [showProductionOnly, setShowProductionOnly] = useState(
    () => localStorage.getItem("entityResourceTableShowProductionOnly") === "true",
  );
  const [showMilitaryOnly, setShowMilitaryOnly] = useState(
    () => localStorage.getItem("entityResourceTableShowMilitaryOnly") === "true",
  );
  const [collapsedTiers, setCollapsedTiers] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem("entityResourceTableCollapsedTiers");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [dragState, setDragState] = useState<DragState>({ isDragging: false });
  const [showHelpBanner, setShowHelpBanner] = useState(() => localStorage.getItem("hideResourceTableHelp") !== "true");
  const [pinSelectedColumn, setPinSelectedColumn] = useState(
    () => localStorage.getItem("pinSelectedColumn") === "true",
  );

  const playerStructures = useFactView(playerStructuresView);
  const openSurface = usePopoverStore((state) => state.openSurface);
  const closeSurface = usePopoverStore((state) => state.closeSurface);
  const { isMapView } = useQuery();
  const {
    setup,
    setup: { store },
  } = useGame();

  const mode = useGameModeConfig();
  const goToStructure = useGoToStructure(setup);
  const currentDefaultTick = useCurrentDefaultTick();

  const selectedStructureId = entityId && entityId !== 0 ? safeInteger(entityId) : null;

  const structureColumns = useMemo<StructureColumn[]>(() => {
    const columns = playerStructures
      .filter((structure) => structure.isMine)
      .map((structure) => {
        const realmId = Number(structure.structure.metadata.realm_id || 0);
        const label = realmId
          ? getRealmNameById(realmId) || `Realm #${realmId}`
          : mode.structure.getTypeName(
              structure.structure.base.category as StructureType,
              presentedMineKind(structure.structure),
            ) || "Structure";

        return {
          entityId: safeInteger(structure.entityId),
          label,
          level: structure.structure.base.level || 1,
          isSelected: selectedStructureId ? safeInteger(structure.entityId) === selectedStructureId : false,
        };
      })
      .toSorted((a, b) => a.entityId - b.entityId);

    // If pin is enabled and there's a selected column, move it to the front
    if (pinSelectedColumn && selectedStructureId) {
      const selectedIndex = columns.findIndex((col) => col.entityId === selectedStructureId);
      if (selectedIndex > 0) {
        const [selectedColumn] = columns.splice(selectedIndex, 1);
        columns.unshift(selectedColumn);
      }
    }

    return columns;
  }, [mode.structure, pinSelectedColumn, playerStructures, selectedStructureId]);

  const structureIdSet = useMemo(() => new Set(structureColumns.map((column) => column.entityId)), [structureColumns]);

  const relicCraftableStructureIds = useMemo(() => {
    const craftableStructureIds = new Set<number>();

    structureColumns.forEach((structureColumn) => {
      const structure = store.get("Structure", {
        game_id: configManager.getActiveGameId(),
        entity_id: structureColumn.entityId,
      });
      const structureCategory = structure?.base.category;

      if (structureCategory === StructureType.Realm || structureCategory === StructureType.Village) {
        craftableStructureIds.add(structureColumn.entityId);
      }
    });

    return craftableStructureIds;
  }, [store, structureColumns]);

  // The resources revision is the recompute signal; only the columns' own rows are read, never every Resource row.
  const resourcesRevision = useNativeRevision(RESOURCE_FACTS);

  const resourcesByStructure = useMemo(() => {
    const map = new Map<number, ResourceManager>();
    void resourcesRevision;
    structureIdSet.forEach((structureEntityId) => {
      const resourceValue = new ResourceManager(store, structureEntityId);
      if (resourceValue.hasResources()) map.set(structureEntityId, resourceValue);
    });

    return map;
  }, [resourcesRevision, structureIdSet, store]);

  const resourceSummaries = useMemo(() => {
    const summaries = new Map<ResourcesIds, ResourceSummary>();

    resourcesByStructure.forEach((resourceValue, structure) => {
      // A structure whose resources this client cannot see adds nothing to the summary.
      const balances = resourceValue.balances(currentDefaultTick);
      if (!balances) return;

      balances.forEach(({ resourceId, amount }) => {
        const productionInfo = resourceValue.current(resourceId);
        const withProduction = resourceValue.balanceWithProduction(currentDefaultTick, resourceId);
        if (!productionInfo || !withProduction) return;
        const { hasReachedMaxCapacity, balance } = withProduction;

        const { productionPerSecond, isProducing, outputRemaining, timeRemainingSeconds } =
          ResourceManager.calculateResourceProductionData(resourceId, productionInfo, currentDefaultTick);

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

  const tiers = useMemo(() => Object.entries(mode.resources.getTiers()), [mode.resources]);

  if (structureColumns.length === 0) {
    return <div className="p-3 text-xs text-gold/70">Own a structure to begin tracking your resources.</div>;
  }

  const highlightedStructure = structureColumns.find((structure) => structure.isSelected)?.label;

  const handleToggleTierVisibility = useCallback((tierKey: string) => {
    setCollapsedTiers((prev) => {
      const next = { ...prev, [tierKey]: !prev[tierKey] };
      localStorage.setItem("entityResourceTableCollapsedTiers", JSON.stringify(next));
      return next;
    });
  }, []);

  const handleSelectStructure = useCallback(
    (structureId: number) => {
      // Don't do anything if clicking the already selected structure
      if (selectedStructureId === structureId) return;

      // Get structure position and navigate based on current view mode
      const structure = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: structureId });
      if (structure) {
        const site = structureMapPosition(store, structure);
        if (!site) return;
        const position = Position.fromContract(site);
        // Use goToStructure which handles both map view and hex view
        void goToStructure(structureId as ID, position, isMapView);
      }
    },
    [store, goToStructure, isMapView, selectedStructureId],
  );

  const handleManageProduction = useCallback(
    (structureId: number, resourceId: ResourcesIds) => {
      openSurface({
        id: "production",
        content: <ProductionModal preSelectedRealmId={structureId} preSelectedResource={resourceId} />,
      });
    },
    [openSurface],
  );

  const handleOpenCraftRelic = useCallback(
    (structureId: number) => {
      import("../craft-relic-popup").then(({ CraftRelicPopup }) => {
        openSurface({
          id: "craft-relic",
          content: <CraftRelicPopup structureId={structureId} onClose={closeSurface} />,
        });
      });
    },
    [closeSurface, openSurface],
  );

  const handleDragStart = (structureId: number, resourceId: ResourcesIds, amount: number) => {
    setDragState({
      isDragging: true,
      dragData: { structureId, resourceId, amount },
    });
  };

  // Dropping a resource on another holding opens the one transfer window between the two, that good ready to type.
  const handleDragEnd = () => {
    const { dragData, dragOverStructureId } = dragState;
    setDragState({ isDragging: false });
    if (dragData && dragOverStructureId && dragOverStructureId !== dragData.structureId) {
      openTransfer({
        sourceId: dragData.structureId,
        destinationIds: [dragOverStructureId],
        resource: dragData.resourceId,
      });
    }
  };

  const handleDragOver = (e: React.DragEvent, targetStructureId: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragState.isDragging && dragState.dragOverStructureId !== targetStructureId) {
      setDragState((prev) => ({ ...prev, dragOverStructureId: targetStructureId }));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleDragEnd();
  };

  // A double-click opens the window from that holding, the good ready to type.
  const handleDoubleClick = (structureId: number, resourceId: ResourcesIds) =>
    openTransfer({ sourceId: structureId, destinationIds: [], resource: resourceId });

  const handleDismissHelp = () => {
    setShowHelpBanner(false);
    localStorage.setItem("hideResourceTableHelp", "true");
  };

  return (
    <div className="flex h-full flex-col gap-4 p-2">
      {/* Help Banner */}
      {showHelpBanner && (
        <div className="rounded-xl border border-blueish/30 bg-blueish/10 p-3 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-blueish">💡 Quick Tips</span>
              </div>
              <ul className="space-y-1 text-xs text-blueish/90">
                <li className="flex items-start gap-2">
                  <span className="text-blueish/70">•</span>
                  <span>
                    <strong>Drag & Drop:</strong> Drag resources between columns to transfer them across realms
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blueish/70">•</span>
                  <span>
                    <strong>Cycle Realms:</strong> Click column headers to navigate between realms in{" "}
                    {isMapView ? "world" : "local"} view
                  </span>
                </li>
              </ul>
            </div>
            <button
              onClick={handleDismissHelp}
              className="text-blueish/60 hover:text-blueish transition-colors"
              title="Dismiss"
            >
              <SemanticIcon name="close" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gold/25 bg-brown/80 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
        <div className="sticky top-0 z-20 -mx-4 -mt-4 px-4 pt-4 pb-3 bg-brown/95 backdrop-blur border-b border-gold/15">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-gold">Resource overview</h4>
              <p className="text-[11px] text-gold/60">
                {structureColumns.length} structures synced
                {highlightedStructure ? ` • ${highlightedStructure} highlighted` : " • select a structure to manage"}
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 text-[11px] text-gold/70 sm:w-auto sm:justify-end">
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1">
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
                <label className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1">
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
                <label className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1">
                  <span className={clsx(showProductionOnly && "text-gold")}>Production only</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={showProductionOnly}
                      onChange={() => {
                        const nextValue = !showProductionOnly;
                        setShowProductionOnly(nextValue);
                        localStorage.setItem("entityResourceTableShowProductionOnly", String(nextValue));
                      }}
                    />
                    <div className="h-5 w-9 rounded-full bg-brown/50 transition peer-checked:bg-gold/30">
                      <div className="absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-gold transition peer-checked:translate-x-4" />
                    </div>
                  </div>
                </label>
                <label className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-3 py-1">
                  <span className={clsx(showMilitaryOnly && "text-gold")}>Military only</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={showMilitaryOnly}
                      onChange={() => {
                        const nextValue = !showMilitaryOnly;
                        setShowMilitaryOnly(nextValue);
                        localStorage.setItem("entityResourceTableShowMilitaryOnly", String(nextValue));
                      }}
                    />
                    <div className="h-5 w-9 rounded-full bg-brown/50 transition peer-checked:bg-gold/30">
                      <div className="absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-gold transition peer-checked:translate-x-4" />
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-gold/15 bg-brown/60">
          <table className="min-w-full text-left text-xxs">
            <thead className="sticky top-0 bg-brown/80 backdrop-blur">
              <tr className="border-b border-gold/15 text-[10px] uppercase text-gold/70">
                <th className="px-3 py-2 font-semibold border-r border-gold/[0.07] sticky left-0 bg-brown/95 backdrop-blur z-10 shadow-sm">
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
                      {structure.isSelected && <SemanticIcon name="target" className="h-3 w-3 text-gold" />}
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
                  const hasAmount = summary ? summary.totalAmount > 0 : false;
                  const shouldShow = showAllResources || hasAmount || ALWAYS_SHOW_RESOURCES.includes(resourceId);
                  const passesProduction = !showProductionOnly || (summary?.totalProductionPerSecond ?? 0) > 0;
                  const passesMilitary = !showMilitaryOnly || isMilitaryResource(resourceId);

                  return shouldShow && passesProduction && passesMilitary;
                });

                if (rows.length === 0) return null;

                const isCollapsed = collapsedTiers[tier] ?? false;

                return (
                  <React.Fragment key={tier}>
                    <tr className="bg-gold/5 text-[10px] uppercase tracking-wide text-gold/70">
                      <td className="px-2 py-1" colSpan={structureColumns.length + 2}>
                        <button
                          type="button"
                          onClick={() => handleToggleTierVisibility(tier)}
                          className="flex w-full items-center justify-between text-left"
                        >
                          <span>{TIER_DISPLAY_NAMES[tier] || tier}</span>
                          <span className="flex items-center gap-2 text-[9px] font-medium text-gold/60">
                            {rows.length}
                            {isCollapsed ? (
                              <SemanticIcon name="arrow-down" className="h-3 w-3" />
                            ) : (
                              <SemanticIcon name="arrow-up" className="h-3 w-3" />
                            )}
                          </span>
                        </button>
                      </td>
                    </tr>
                    {!isCollapsed &&
                      rows.map((resourceId: ResourcesIds) => {
                        const summary = resourceSummaries.get(resourceId);
                        const resourceKey = ResourcesIds[resourceId];

                        return (
                          <tr
                            key={resourceId}
                            className="border-b border-gold/10 last:border-b-0 hover:bg-gold/[0.02] transition-colors"
                          >
                            <td className="px-3 py-2 border-r border-gold/[0.07] sticky left-0 bg-brown/95 backdrop-blur z-10 shadow-sm">
                              <div className="flex items-center gap-2">
                                <ResourceIcon resource={resourceId} size="md" />
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
                                store,
                              );
                              const hasProductionBuilding = Boolean(
                                actualBuildingCount > 0 && configManager.canRefillProduction(resourceId),
                              );
                              const canCraftRelic =
                                resourceId === ResourcesIds.Research &&
                                Number(cell?.amount ?? 0) > 0 &&
                                relicCraftableStructureIds.has(structure.entityId);

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
                                      canCraftRelic={canCraftRelic}
                                      onCraftRelic={() => handleOpenCraftRelic(structure.entityId)}
                                      onDragStart={handleDragStart}
                                      onDragEnd={handleDragEnd}
                                      onDoubleClick={handleDoubleClick}
                                      dragState={dragState}
                                      onDragOver={handleDragOver}
                                      onDrop={handleDrop}
                                    />
                                  ) : (
                                    <div
                                      className={clsx(
                                        "min-h-[40px] flex items-center justify-center rounded-md transition-all",
                                        dragState.isDragging &&
                                          dragState.dragOverStructureId === structure.entityId &&
                                          dragState.dragData?.resourceId === resourceId &&
                                          dragState.dragData.structureId !== structure.entityId
                                          ? "bg-gold/20 border-2 border-dashed border-gold/60"
                                          : "border border-transparent",
                                      )}
                                      onDragOver={(e) => handleDragOver(e, structure.entityId)}
                                      onDrop={handleDrop}
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
  canCraftRelic: boolean;
  onCraftRelic: () => void;
  onDragStart: (structureId: number, resourceId: ResourcesIds, amount: number) => void;
  onDragEnd: () => void;
  onDoubleClick: (structureId: number, resourceId: ResourcesIds) => void;
  dragState: DragState;
  onDragOver: (e: React.DragEvent, targetStructureId: number) => void;
  onDrop: (e: React.DragEvent) => void;
}

const TransferCell = React.memo((props: TransferCellProps) => {
  const {
    structureId,
    resourceId,
    cell,
    isSelectedStructure,
    hasProductionBuilding,
    onManageProduction,
    canCraftRelic,
    onCraftRelic,
    onDragStart,
    onDragEnd,
    onDoubleClick,
    dragState,
    onDragOver,
    onDrop,
  } = props;
  const [isHovered, setIsHovered] = useState(false);
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
      )}
      draggable={cell.amount > 0}
      onDragStart={() => cell.amount > 0 && onDragStart(structureId, resourceId, cell.amount)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, structureId)}
      onDrop={onDrop}
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
            {canCraftRelic && (
              <span className="rounded border border-relic/40 bg-relic/15 px-1 py-0 text-[9px] uppercase tracking-[0.08em] text-relic2">
                Forge
              </span>
            )}
          </div>
          {cell.isProducing && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gold/60">{formatProductionPerHour(cell.productionPerSecond)}</span>
              {cell.outputRemaining > 0 && !cell.isStorageCapped && !HIDE_TIME_REMAINING_FOR.includes(resourceId) && (
                <span className="text-[10px] text-blueish/60" title="Time until production runs out">
                  ({formatTimeRemaining(cell.timeRemainingSeconds)})
                </span>
              )}
            </div>
          )}
          {cell.isStorageCapped && <span className="text-[10px] text-danger/70">Storage full</span>}
        </div>

        {/* Right: Action Buttons */}
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
              <SemanticIcon name="production" className="h-2.5 w-2.5" />
            </button>
          )}
          {canCraftRelic && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onCraftRelic();
              }}
              className="rounded border border-relic/35 bg-relic/15 p-0.5 text-relic2 transition hover:bg-relic/25"
              title="Craft relic from research"
              aria-label="Craft relic from research"
            >
              <SemanticIcon name="research" className="h-2.5 w-2.5" />
            </button>
          )}
          {isSelectedStructure && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openTransfer({ sourceId: structureId, destinationIds: [], resource: resourceId });
                }}
                className="rounded border border-gold/20 bg-gold/10 p-0.5 text-gold transition hover:bg-gold/20 opacity-0 group-hover:opacity-100"
                title="Transfer"
              >
                <SemanticIcon name="swap" className="h-2.5 w-2.5" />
              </button>
              {cell.amount > 0 && (
                <ResourceBurnPopover
                  structureId={structureId}
                  resourceId={resourceId}
                  trigger={(toggle) => (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggle();
                      }}
                      className="rounded border border-gold/20 bg-gold/10 p-0.5 text-gold transition hover:bg-gold/20 opacity-0 group-hover:opacity-100"
                      title="Burn"
                    >
                      <SemanticIcon name="flame" className="h-2.5 w-2.5" />
                    </button>
                  )}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Drag Feedback */}
      {isDragTarget && (
        <div className="absolute inset-0 flex items-center justify-center bg-gold/20 rounded-md">
          <SemanticIcon name="target" className="h-6 w-6 text-gold animate-bounce" />
        </div>
      )}
    </div>
  );
});
