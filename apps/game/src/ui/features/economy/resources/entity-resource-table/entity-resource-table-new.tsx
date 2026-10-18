import { knownAmount } from "@/ui/utils/utils";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { realmLevelNumber } from "@/ui/lib/realm-level";
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
import {
  getBuildingFromResource,
  ID,
  ResourcesIds,
  StructureType,
  structureName,
  formatAmount,
  formatRate,
} from "@bibliothecadao/types";
import clsx from "clsx";
import { HudChip, HudIconButton, HudPanel, HudSwitch } from "@/ui/design-system/kit/hud-elements";

import React, { useCallback, useMemo, useState } from "react";
import { ALWAYS_SHOW_RESOURCES, productionTimeLeft, HIDE_TIME_REMAINING_FOR, TIER_DISPLAY_NAMES } from "./utils";
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
          ? getRealmNameById(realmId) || structureName(StructureType.Realm)
          : mode.structure.getTypeName(
              structure.structure.base.category as StructureType,
              presentedMineKind(structure.structure),
            ) || "Structure";

        return {
          entityId: safeInteger(structure.entityId),
          label,
          level: realmLevelNumber(structure.structure.base.level),
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
    return <p className="p-3 text-hud-muted">Own a structure to begin tracking your resources.</p>;
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

  const filter = (label: string, on: boolean, toggle: () => void) => (
    <span className="inline-flex items-center gap-2 text-hud-label">
      <span className={on ? "text-hud-accent" : undefined}>{label}</span>
      <HudSwitch on={on} label={label} onChange={toggle} />
    </span>
  );

  return (
    <div className="flex h-full flex-col gap-4">
      {showHelpBanner && (
        <HudPanel
          kind="section"
          title="Quick Tips"
          collapsible={false}
          cue={<HudIconButton icon="close" label="Dismiss" kind="quiet" size="sm" onClick={handleDismissHelp} />}
        >
          <ul className="flex flex-col gap-1">
            <li>
              <strong>Drag & Drop:</strong> Drag resources between columns to transfer them across realms
            </li>
            <li>
              <strong>Cycle Realms:</strong> Click column headers to navigate between realms in{" "}
              {isMapView ? "world" : "local"} view
            </li>
          </ul>
        </HudPanel>
      )}

      <div className="flex flex-col">
        <div className="sticky top-0 z-20 border-b border-hud-divider bg-hud-surface pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h4 className="text-hud-title text-hud-accent">Resource overview</h4>
              <p className="text-hud-label text-hud-muted">
                {structureColumns.length} structures synced
                {highlightedStructure ? ` • ${highlightedStructure} highlighted` : " • select a structure to manage"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {filter("Pin Selected Realm", pinSelectedColumn, () => {
                const newValue = !pinSelectedColumn;
                setPinSelectedColumn(newValue);
                localStorage.setItem("pinSelectedColumn", String(newValue));
              })}
              {filter("Hide empty", !showAllResources, () => setShowAllResources((prev) => !prev))}
              {filter("Production only", showProductionOnly, () => {
                const nextValue = !showProductionOnly;
                setShowProductionOnly(nextValue);
                localStorage.setItem("entityResourceTableShowProductionOnly", String(nextValue));
              })}
              {filter("Military only", showMilitaryOnly, () => {
                const nextValue = !showMilitaryOnly;
                setShowMilitaryOnly(nextValue);
                localStorage.setItem("entityResourceTableShowMilitaryOnly", String(nextValue));
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-hud-label">
            <thead className="sticky top-0 bg-hud-surface">
              <tr className="border-b border-hud-divider text-hud-muted">
                <th className="sticky left-0 z-10 border-r border-hud-divider bg-hud-surface px-3 py-2">Resource</th>
                <th className="border-r border-hud-divider px-3 py-2">Total</th>
                {structureColumns.map((structure) => (
                  <th
                    key={structure.entityId}
                    className={clsx(
                      "cursor-pointer border-r border-hud-divider px-3 py-2 last:border-r-0 hover:bg-hud-hover",
                      structure.isSelected && "bg-hud-chosen",
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
                      {structure.isSelected && <SemanticIcon name="target" className="h-3 w-3 text-hud-accent" />}
                      <div className="flex flex-col gap-0.5">
                        <span className={structure.isSelected ? "text-hud-accent" : "text-hud-ink"}>
                          {structure.label}
                        </span>
                        <span className="text-hud-badge text-hud-cue">Level {structure.level}</span>
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
                    <tr className="bg-hud-hover text-hud-muted">
                      <td className="px-2 py-1" colSpan={structureColumns.length + 2}>
                        <button
                          type="button"
                          onClick={() => handleToggleTierVisibility(tier)}
                          className="flex w-full items-center justify-between text-left"
                        >
                          <span>{TIER_DISPLAY_NAMES[tier] || tier}</span>
                          <span className="flex items-center gap-2 text-hud-cue">
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
                          <tr key={resourceId} className="border-b border-hud-divider last:border-b-0">
                            <td className="sticky left-0 z-10 border-r border-hud-divider bg-hud-surface px-3 py-2">
                              <div className="flex items-center gap-2">
                                <ResourceIcon resource={resourceId} size="md" />
                                <span className="text-hud-ink">{resourceKey}</span>
                              </div>
                            </td>
                            <td className="border-r border-hud-divider px-3 py-2">
                              {summary ? (
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-hud-strong text-hud-accent">
                                    {formatAmount(knownAmount(summary.totalAmount))}
                                  </span>
                                  <span
                                    className={summary.totalProductionPerSecond > 0 ? "text-hud-good" : "text-hud-cue"}
                                  >
                                    {formatRate(summary.totalProductionPerSecond)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-hud-cue">—</span>
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
                                    "cursor-pointer border-r border-hud-divider px-2 py-1.5 align-top last:border-r-0",
                                    structure.isSelected && "bg-hud-chosen",
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
                                        "flex min-h-10 items-center justify-center rounded-md",
                                        dragState.isDragging &&
                                          dragState.dragOverStructureId === structure.entityId &&
                                          dragState.dragData?.resourceId === resourceId &&
                                          dragState.dragData.structureId !== structure.entityId
                                          ? "border-2 border-dashed border-hud-line-strong bg-hud-chosen"
                                          : "border border-transparent",
                                      )}
                                      onDragOver={(e) => handleDragOver(e, structure.entityId)}
                                      onDrop={handleDrop}
                                    >
                                      <span className="text-hud-cue">-</span>
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
        "group relative min-h-10 rounded-md p-1.5",
        isSelectedStructure && "bg-hud-hover",
        isDragTarget && "scale-105 border-2 border-dashed border-hud-line-strong bg-hud-chosen",
        isHovered && !isDragTarget && "bg-hud-chosen",
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
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-hud-ink">{formatAmount(knownAmount(cell.amount))}</span>
            {canCraftRelic && <HudChip>Forge</HudChip>}
          </div>
          {cell.isProducing && (
            <div className="flex items-center gap-1.5 text-hud-cue">
              <span>{formatRate(cell.productionPerSecond)}</span>
              {cell.outputRemaining > 0 && !cell.isStorageCapped && !HIDE_TIME_REMAINING_FOR.includes(resourceId) && (
                <span title="Time until production runs out">({productionTimeLeft(cell.timeRemainingSeconds)})</span>
              )}
            </div>
          )}
          {cell.isStorageCapped && <span className="text-hud-bad">Storage full</span>}
        </div>

        <div className="flex flex-shrink-0 items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
          {hasProductionBuilding && (
            <HudIconButton
              icon="production"
              label="Manage production"
              kind="quiet"
              size="sm"
              onClick={onManageProduction}
            />
          )}
          {canCraftRelic && (
            <HudIconButton
              icon="research"
              label="Craft relic from research"
              kind="quiet"
              size="sm"
              onClick={onCraftRelic}
            />
          )}
          {isSelectedStructure && (
            // Transfer and burn show on the hovered cell of the selected holding.
            <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
              <HudIconButton
                icon="swap"
                label="Transfer"
                kind="quiet"
                size="sm"
                onClick={() => openTransfer({ sourceId: structureId, destinationIds: [], resource: resourceId })}
              />
              {cell.amount > 0 && (
                <ResourceBurnPopover
                  structureId={structureId}
                  resourceId={resourceId}
                  trigger={(toggle) => (
                    <HudIconButton icon="flame" label="Burn" kind="quiet" size="sm" onClick={toggle} />
                  )}
                />
              )}
            </span>
          )}
        </div>
      </div>

      {isDragTarget && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-hud-chosen">
          <SemanticIcon name="target" className="h-6 w-6 animate-bounce text-hud-accent" />
        </div>
      )}
    </div>
  );
});
