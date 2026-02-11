import { BottomPanelTabId, useUIStore } from "@/hooks/store/use-ui-store";
import { debouncedGetEntitiesFromTorii } from "@/dojo/debounced-queries";
import { getStructuresDataFromTorii } from "@/dojo/queries";
import { useEntityResync } from "@/hooks/helpers/use-entity-resync";
import { FELT_CENTER } from "@/ui/config";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import Button from "@/ui/design-system/atoms/button";
import { sqlApi } from "@/services/api";
import {
  configManager,
  divideByPrecision,
  getEntityIdFromKeys,
  getConsumedBy,
  getBuildingCosts,
  getBalance,
  getBlockTimestamp,
  isTileOccupierChest,
  isTileOccupierQuest,
  isTileOccupierStructure,
  Position as PositionInterface,
  getTileAt,
  DEFAULT_COORD_ALT,
} from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import {
  BUILDINGS_CENTER,
  BuildingType,
  BuildingTypeToString,
  ID,
  ResourcesIds,
  findResourceById,
} from "@bibliothecadao/types";
import { Component, getComponentValue, Metadata, Schema } from "@dojoengine/recs";
import { memo, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { SelectedWorldmapEntity } from "@/ui/features/world/components/actions/selected-worldmap-entity";
import { useStructureUpgrade } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import { RealmUpgradeCompact } from "@/ui/modules/entity-details/realm/realm-details";
import { ProductionModal } from "@/ui/features/settlement";
import { TileManager } from "@bibliothecadao/eternum";
import { type LucideIcon } from "lucide-react";
import CircleHelp from "lucide-react/dist/esm/icons/circle-help";
import Info from "lucide-react/dist/esm/icons/info";
import Loader from "lucide-react/dist/esm/icons/loader";
import MapIcon from "lucide-react/dist/esm/icons/map";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { toast } from "sonner";

import { BOTTOM_PANEL_HEIGHT, BOTTOM_PANEL_MARGIN } from "./constants";
import { HexMinimap, normalizeMinimapTile, type MinimapTile } from "./hex-minimap";

const compactResourceFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const formatResourceAmount = (value: number): string => {
  const flooredValue = Math.floor(value);
  if (flooredValue >= 1000) {
    return compactResourceFormatter.format(flooredValue);
  }
  return flooredValue.toLocaleString();
};

const ENTITY_SYNC_MODELS = {
  explorer: ["s1_eternum-ExplorerTroops"],
  structure: ["s1_eternum-Structure"],
} as const;

type SyncableEntityType = keyof typeof ENTITY_SYNC_MODELS;

const ENTITY_TYPE_LABELS: Record<SyncableEntityType, string> = {
  explorer: "Explorer",
  structure: "Structure",
};

interface PanelFrameProps {
  title: string;
  children: ReactNode;
  headerAction?: ReactNode;
  className?: string;
  attached?: boolean;
}

interface ResourceAmountEntry {
  resource: number;
  amount: number;
}

const normalizeResourceEntries = (value: unknown): ResourceAmountEntry[] => {
  if (!value) return [];

  const toEntry = (entry: unknown): ResourceAmountEntry | null => {
    if (!entry || typeof entry !== "object") return null;

    const typedEntry = entry as {
      resource?: number | string | bigint;
      resourceId?: number | string | bigint;
      amount?: number | string | bigint;
    };

    const resource = Number(typedEntry.resource ?? typedEntry.resourceId);
    const amount = Number(typedEntry.amount);
    if (!Number.isFinite(resource) || !Number.isFinite(amount)) return null;
    return { resource, amount };
  };

  if (Array.isArray(value)) {
    return value.map(toEntry).filter((entry): entry is ResourceAmountEntry => Boolean(entry));
  }

  return Object.values(value as Record<string, unknown>)
    .map(toEntry)
    .filter((entry): entry is ResourceAmountEntry => Boolean(entry));
};

const PanelFrame = ({ title, children, headerAction, className, attached = false }: PanelFrameProps) => (
  <section
    className={cn(
      "pointer-events-auto panel-wood panel-wood-corners border border-gold/20 bg-black/60 shadow-2xl flex h-full flex-col overflow-hidden",
      attached && "rounded-t-none border-t-0",
      className,
    )}
    style={{ height: BOTTOM_PANEL_HEIGHT }}
  >
    <header className="flex items-center justify-between gap-2 border-b border-gold/20 px-4 py-2">
      <p className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.35em] text-gold/70">{title}</p>
      {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
    </header>
    <div className="flex-1 min-h-0 overflow-hidden px-3 py-2">{children}</div>
  </section>
);

type TabDefinition = {
  id: BottomPanelTabId;
  label: string;
  icon: LucideIcon;
};

const BOTTOM_PANEL_TABS: TabDefinition[] = [
  { id: "tile", label: "Selected tile", icon: CircleHelp },
  { id: "minimap", label: "Minimap", icon: MapIcon },
];

const PanelTabs = ({
  tabs,
  activeTab,
  onSelect,
  className,
}: {
  tabs: TabDefinition[];
  activeTab: BottomPanelTabId | null;
  onSelect: (tab: BottomPanelTabId) => void;
  className?: string;
}) => (
  <div className={cn("pointer-events-auto flex gap-2", className)}>
    {tabs.map(({ id, label, icon: Icon }) => {
      const isActive = activeTab === id;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          aria-pressed={isActive}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-md border transition",
            isActive
              ? "border-gold/80 bg-black/80 text-gold shadow-[0_6px_18px_rgba(255,209,128,0.25)] ring-1 ring-gold/40"
              : "border-gold/30 bg-black/70 text-gold/70 hover:border-gold/60 hover:text-gold",
          )}
          title={label}
        >
          <Icon className="h-4 w-4" />
        </button>
      );
    })}
  </div>
);

const MapTilePanel = () => {
  const selectedHex = useUIStore((state) => state.selectedHex);
  const {
    setup,
    network: { contractComponents, toriiClient },
  } = useDojo();
  const { syncEntity, isSyncing } = useEntityResync();

  const tile = useMemo(() => {
    if (!selectedHex) return null;
    const selectedHexContract = new PositionInterface({
      x: selectedHex.col,
      y: selectedHex.row,
    }).getContract();
    return getTileAt(setup.components, DEFAULT_COORD_ALT, selectedHexContract.x, selectedHexContract.y);
  }, [selectedHex, setup.components]);

  const hasOccupier = useMemo(() => {
    if (!tile) return false;
    return tile.occupier_id !== 0;
  }, [tile]);

  const isStructure = useMemo(() => {
    return isTileOccupierStructure(tile?.occupier_type || 0);
  }, [tile]);

  const isChest = useMemo(() => {
    return isTileOccupierChest(tile?.occupier_type || 0);
  }, [tile]);

  const isQuest = useMemo(() => {
    return isTileOccupierQuest(tile?.occupier_type || 0);
  }, [tile]);

  const tileTypeLabel = useMemo(() => {
    if (!tile) return "Hex Tile";
    if (!hasOccupier) return "Biome Tile";
    if (isStructure) return "Structure Tile";
    if (isChest) return "Relic Tile";
    if (isQuest) return "Quest Tile";
    return "Army Tile";
  }, [tile, hasOccupier, isStructure, isChest, isQuest]);

  const panelTitle = selectedHex
    ? `${tileTypeLabel} · (${selectedHex.col - FELT_CENTER()}, ${selectedHex.row - FELT_CENTER()})`
    : "No Tile Selected";

  const syncableEntityType = useMemo<SyncableEntityType | null>(() => {
    if (!tile || !hasOccupier || isChest || isQuest) return null;
    return isStructure ? "structure" : "explorer";
  }, [hasOccupier, isChest, isQuest, isStructure, tile]);

  const syncableEntityId = useMemo<ID | null>(() => {
    if (!tile || !syncableEntityType) return null;
    const entityId = Number(tile.occupier_id);
    if (!Number.isFinite(entityId) || entityId <= 0) return null;
    return entityId as ID;
  }, [syncableEntityType, tile]);

  const getEntitySyncKey = useCallback(
    (entityType: SyncableEntityType, entityId: ID) => `${entityType}:${String(entityId)}`,
    [],
  );

  const isSyncingCurrentEntity = useMemo(() => {
    if (!syncableEntityType || syncableEntityId === null) return false;
    return isSyncing(getEntitySyncKey(syncableEntityType, syncableEntityId));
  }, [getEntitySyncKey, isSyncing, syncableEntityId, syncableEntityType]);

  const handleResyncCurrentEntity = useCallback(() => {
    if (!syncableEntityType || syncableEntityId === null) return;

    if (!toriiClient || !contractComponents) {
      toast.error("Unable to sync right now.");
      return;
    }

    const entitySyncKey = getEntitySyncKey(syncableEntityType, syncableEntityId);
    void syncEntity({
      syncKey: entitySyncKey,
      entityLabel: ENTITY_TYPE_LABELS[syncableEntityType],
      successMessage: `${ENTITY_TYPE_LABELS[syncableEntityType]} #${String(syncableEntityId)} synced.`,
      runSync: () =>
        new Promise<void>((resolve, reject) => {
          let settled = false;

          const complete = () => {
            if (settled) return;
            settled = true;
            resolve();
          };

          void debouncedGetEntitiesFromTorii(
            toriiClient,
            contractComponents as unknown as Component<Schema, Metadata, undefined>[],
            [syncableEntityId],
            [...ENTITY_SYNC_MODELS[syncableEntityType]],
            complete,
          ).catch((error) => {
            if (settled) return;
            settled = true;
            reject(error);
          });
        }),
    });
  }, [contractComponents, getEntitySyncKey, syncEntity, syncableEntityId, syncableEntityType, toriiClient]);

  const headerAction =
    syncableEntityType && syncableEntityId !== null ? (
      <Button
        variant="outline"
        size="xs"
        className="gap-1.5 rounded-full border-gold/60 px-3 py-1 text-[11px]"
        forceUppercase={false}
        onClick={handleResyncCurrentEntity}
        withoutSound
        disabled={isSyncingCurrentEntity}
        aria-label={`Re-sync ${syncableEntityType} ${String(syncableEntityId)}`}
      >
        {isSyncingCurrentEntity ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        <span>{isSyncingCurrentEntity ? "Syncing..." : "Re-sync"}</span>
      </Button>
    ) : null;

  return (
    <PanelFrame title={panelTitle} headerAction={headerAction} attached>
      {selectedHex ? (
        <div className="h-full min-h-0 overflow-hidden">
          <SelectedWorldmapEntity />
        </div>
      ) : (
        <div className="flex min-h-[140px] flex-col items-center justify-center text-center">
          <p className="text-xs text-gold/70">Tap any tile on the world map to view its occupants and resources.</p>
        </div>
      )}
    </PanelFrame>
  );
};

const LocalTilePanel = () => {
  const {
    setup,
    account,
    network: { toriiClient, contractComponents },
  } = useDojo();
  const { syncEntity, isSyncing } = useEntityResync();
  const buildingComponent = setup.components.Building;
  const selectedBuildingHex = useUIStore((state) => state.selectedBuildingHex);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const useSimpleCost = useUIStore((state) => state.useSimpleCost);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const structureUpgrade = useStructureUpgrade(structureEntityId ?? null);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const structureBase = useMemo(() => {
    const structure = playerStructures.find((entry) => entry.entityId === structureEntityId);
    const base = structure?.structure?.base;
    if (base && base.coord_x !== undefined && base.coord_y !== undefined) {
      return {
        outerCol: Number(base.coord_x),
        outerRow: Number(base.coord_y),
      };
    }

    let structureEntityKey: string | undefined;
    try {
      structureEntityKey = getEntityIdFromKeys([BigInt(structureEntityId)]);
    } catch {
      structureEntityKey = undefined;
    }

    const liveStructure = structureEntityKey ? getComponentValue(setup.components.Structure, structureEntityKey) : null;
    const liveBase = liveStructure?.base;
    const hasLiveCoords = liveBase?.coord_x !== undefined && liveBase?.coord_y !== undefined;
    if (hasLiveCoords) {
      return {
        outerCol: Number(liveBase.coord_x),
        outerRow: Number(liveBase.coord_y),
      };
    }

    return null;
  }, [playerStructures, setup.components.Structure, structureEntityId]);

  const structureSyncTarget = useMemo(() => {
    const entityId = Number(structureEntityId);
    if (!Number.isFinite(entityId) || entityId <= 0) return null;
    const syncPosition = selectedBuildingHex
      ? { col: selectedBuildingHex.outerCol, row: selectedBuildingHex.outerRow }
      : structureBase
        ? { col: structureBase.outerCol, row: structureBase.outerRow }
        : null;
    if (!syncPosition) return null;
    return {
      entityId: entityId as ID,
      position: syncPosition,
    };
  }, [selectedBuildingHex, structureBase, structureEntityId]);
  const structureSyncKey = structureSyncTarget ? `structure:${String(structureSyncTarget.entityId)}` : null;
  const isSyncingStructure = isSyncing(structureSyncKey);

  useEffect(() => {
    if (!structureBase) return;
    if (
      !selectedBuildingHex ||
      selectedBuildingHex.outerCol !== structureBase.outerCol ||
      selectedBuildingHex.outerRow !== structureBase.outerRow
    ) {
      setSelectedBuildingHex({
        outerCol: structureBase.outerCol,
        outerRow: structureBase.outerRow,
        innerCol: BUILDINGS_CENTER[0],
        innerRow: BUILDINGS_CENTER[1],
      });
    }
  }, [selectedBuildingHex, setSelectedBuildingHex, structureBase]);

  const building = useMemo(() => {
    if (!selectedBuildingHex || !buildingComponent) return null;
    const entityKeys = [
      BigInt(selectedBuildingHex.outerCol),
      BigInt(selectedBuildingHex.outerRow),
      BigInt(selectedBuildingHex.innerCol),
      BigInt(selectedBuildingHex.innerRow),
    ];

    return getComponentValue(buildingComponent, getEntityIdFromKeys(entityKeys));
  }, [buildingComponent, selectedBuildingHex]);

  const buildingCategory = useMemo(() => {
    if (!building) return null;
    return typeof building.category === "bigint" ? Number(building.category) : building.category;
  }, [building]);

  const isCastleTile =
    !!selectedBuildingHex &&
    selectedBuildingHex.innerCol === BUILDINGS_CENTER[0] &&
    selectedBuildingHex.innerRow === BUILDINGS_CENTER[1];

  const hasBuilding = buildingCategory !== null && buildingCategory !== BuildingType.None;
  const buildingName = (() => {
    if (isCastleTile) return "Castle";
    if (hasBuilding) {
      return BuildingTypeToString[buildingCategory as keyof typeof BuildingTypeToString] ?? "Building";
    }
    if (building) return "Empty Tile";
    return "Local Tile";
  })();

  const producedResource = useMemo<ResourcesIds | undefined>(() => {
    if (!hasBuilding || buildingCategory === null) return undefined;
    return configManager.getResourceBuildingProduced(buildingCategory as BuildingType);
  }, [buildingCategory, hasBuilding]);

  const producedPerTick = useMemo(() => {
    if (producedResource === undefined) return 0;
    return divideByPrecision(configManager.getResourceOutputs(producedResource));
  }, [producedResource]);

  const producedResourceName = useMemo(() => {
    return producedResource !== undefined ? (findResourceById(producedResource)?.trait ?? null) : null;
  }, [producedResource]);

  const ongoingCost = useMemo<ResourceAmountEntry[]>(() => {
    if (producedResource === undefined) return [];
    const costs =
      (useSimpleCost
        ? configManager.simpleSystemResourceInputs[producedResource]
        : configManager.complexSystemResourceInputs[producedResource]) ?? [];
    return normalizeResourceEntries(costs);
  }, [producedResource, useSimpleCost]);

  const consumedBy = useMemo(() => {
    if (producedResource === undefined) return [];
    return getConsumedBy(producedResource) ?? [];
  }, [producedResource]);

  const populationConfig = useMemo(() => {
    if (!hasBuilding || buildingCategory === null) return null;
    return configManager.getBuildingCategoryConfig(buildingCategory as BuildingType);
  }, [buildingCategory, hasBuilding]);

  const populationCost = populationConfig?.population_cost ?? 0;
  const populationCapacity = populationConfig?.capacity_grant ?? 0;
  const [isPaused, setIsPaused] = useState<boolean>(!!building?.paused);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);

  useEffect(() => {
    setIsPaused(!!building?.paused);
  }, [building?.paused]);
  useEffect(() => {
    setShowDestroyConfirm(false);
  }, [
    selectedBuildingHex?.outerCol,
    selectedBuildingHex?.outerRow,
    selectedBuildingHex?.innerCol,
    selectedBuildingHex?.innerRow,
  ]);

  const buildCost = useMemo<ResourceAmountEntry[]>(() => {
    if (!hasBuilding || buildingCategory === null) return [];
    const rawCost =
      getBuildingCosts(structureEntityId ?? 0, setup.components, buildingCategory as BuildingType, useSimpleCost) ?? [];
    return normalizeResourceEntries(rawCost);
  }, [buildingCategory, hasBuilding, setup.components, structureEntityId, useSimpleCost]);

  const isOwnedByPlayer = useMemo(() => {
    if (!building) return false;
    const ownerId =
      typeof building.outer_entity_id === "bigint" ? Number(building.outer_entity_id) : building.outer_entity_id;
    return playerStructures.some((structure) => structure.entityId === ownerId);
  }, [building, playerStructures]);

  const canAddProduction =
    producedResource !== undefined &&
    buildingCategory !== BuildingType.ResourceFish &&
    buildingCategory !== BuildingType.ResourceWheat &&
    buildingCategory !== BuildingType.WorkersHut;

  const panelTitle = selectedBuildingHex
    ? `${buildingName} · (${selectedBuildingHex.innerCol}, ${selectedBuildingHex.innerRow})`
    : "No Tile Selected";

  const handleResyncStructure = useCallback(() => {
    if (!structureSyncTarget) return;
    if (!toriiClient || !contractComponents) {
      toast.error("Unable to sync right now.");
      return;
    }

    const { entityId, position } = structureSyncTarget;
    const toriiComponents = contractComponents as Parameters<typeof getStructuresDataFromTorii>[1];

    void syncEntity({
      syncKey: `structure:${String(entityId)}`,
      entityLabel: "Structure",
      successMessage: `Structure #${String(entityId)} synced.`,
      runSync: () =>
        new Promise<void>((resolve, reject) => {
          let settled = false;

          const complete = () => {
            if (settled) return;
            settled = true;
            resolve();
          };

          void getStructuresDataFromTorii(toriiClient, toriiComponents, [{ entityId, position }], complete).catch(
            (error) => {
              if (settled) return;
              settled = true;
              reject(error);
            },
          );
        }),
    });
  }, [contractComponents, structureSyncTarget, syncEntity, toriiClient]);

  const headerAction =
    structureSyncTarget ? (
      <Button
        variant="outline"
        size="xs"
        className="gap-1.5 rounded-full border-gold/60 px-3 py-1 text-[11px]"
        forceUppercase={false}
        onClick={handleResyncStructure}
        withoutSound
        disabled={isSyncingStructure}
        aria-label={`Re-sync structure ${String(structureSyncTarget.entityId)}`}
      >
        {isSyncingStructure ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        <span>{isSyncingStructure ? "Syncing..." : "Re-sync"}</span>
      </Button>
    ) : null;

  const handleToggleProduction = async () => {
    if (!selectedBuildingHex) return;
    setIsActionLoading(true);
    try {
      const tileManager = new TileManager(setup.components, setup.systemCalls, {
        col: selectedBuildingHex.outerCol,
        row: selectedBuildingHex.outerRow,
      });
      if (isPaused) {
        await tileManager.resumeProduction(
          account.account,
          structureEntityId,
          selectedBuildingHex.innerCol,
          selectedBuildingHex.innerRow,
        );
        setIsPaused(false);
      } else {
        await tileManager.pauseProduction(
          account.account,
          structureEntityId,
          selectedBuildingHex.innerCol,
          selectedBuildingHex.innerRow,
        );
        setIsPaused(true);
      }
    } catch (error) {
      console.error("Failed to toggle production", error);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDestroy = async () => {
    if (!selectedBuildingHex) return;
    if (isCastleTile) return;
    if (!showDestroyConfirm) {
      setShowDestroyConfirm(true);
      return;
    }
    setIsActionLoading(true);
    try {
      const tileManager = new TileManager(setup.components, setup.systemCalls, {
        col: selectedBuildingHex.outerCol,
        row: selectedBuildingHex.outerRow,
      });
      await tileManager.destroyBuilding(
        account.account,
        structureEntityId,
        selectedBuildingHex.innerCol,
        selectedBuildingHex.innerRow,
      );
    } catch (error) {
      console.error("Failed to destroy building", error);
    } finally {
      setIsActionLoading(false);
      setShowDestroyConfirm(false);
    }
  };

  return (
    <PanelFrame title={panelTitle} headerAction={headerAction} attached>
      {selectedBuildingHex ? (
        isCastleTile ? (
          <div className="h-full min-h-0 overflow-auto">
            <RealmUpgradeCompact />
          </div>
        ) : hasBuilding ? (
          <div className="h-full min-h-0 overflow-hidden">
            <div className="flex flex-col gap-3 text-xs text-gold">
              {isPaused && (
                <div className="flex items-center justify-between gap-2 py-2 px-3 bg-red/20 rounded">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-200">
                    ⚠️ Production Paused
                  </span>
                  {isOwnedByPlayer && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={isActionLoading}
                        onClick={handleToggleProduction}
                        className="text-xxs h-6 bg-green/20 hover:bg-green/40 border-green/50"
                      >
                        ▶ Resume
                      </Button>
                      {!isCastleTile && (
                        <Button
                          size="xs"
                          variant="danger"
                          disabled={isActionLoading}
                          onClick={handleDestroy}
                          className="text-xxs h-6"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xxs uppercase tracking-[0.2em] text-gold/60">
                    {isCastleTile ? "Labor rate" : "Produces per sec"}
                  </p>
                  {producedResource && producedResourceName ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-green-300">+{producedPerTick}</span>
                      <ResourceIcon withTooltip={false} resource={producedResourceName} size="sm" />
                      <button
                        type="button"
                        className="text-xxs uppercase tracking-[0.2em] text-gold/60"
                        onMouseEnter={() =>
                          setTooltip({
                            position: "right",
                            content: (
                              <div className="space-y-2">
                                <p className="text-xxs uppercase tracking-[0.25em] text-gold/60">Consumed By</p>
                                {consumedBy.length > 0 ? (
                                  <div className="grid grid-cols-3 gap-2">
                                    {consumedBy.map((resourceId) => {
                                      const name =
                                        findResourceById(Number(resourceId))?.trait ?? `Resource ${resourceId}`;
                                      return (
                                        <div
                                          key={resourceId}
                                          className="flex items-center gap-1 rounded border border-gold/20 bg-black/40 px-2 py-1"
                                        >
                                          <ResourceIcon withTooltip={false} resource={name} size="xs" />
                                          <span className="text-xxs text-gold/80">{name}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xxs text-gold/60">Not consumed by other buildings.</p>
                                )}
                              </div>
                            ),
                          })
                        }
                        onMouseLeave={() => setTooltip(null)}
                        aria-label="Show consumers"
                      >
                        <Info className="h-4 w-4 text-gold/70" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xxs text-gold/60">No production</p>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xxs uppercase tracking-[0.2em] text-gold/60">Population</p>
                  <div className="flex items-center gap-2 text-sm">
                    {populationCost !== 0 && (
                      <span className="rounded bg-black/40 px-2 py-1 text-xxs font-semibold text-gold">
                        Cost +{populationCost}
                      </span>
                    )}
                    {populationCapacity !== 0 && (
                      <span className="rounded bg-black/40 px-2 py-1 text-xxs font-semibold text-gold">
                        Capacity +{populationCapacity}
                      </span>
                    )}
                    {populationCost === 0 && populationCapacity === 0 && (
                      <span className="text-xxs text-gold/60">No population impact</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xxs uppercase tracking-[0.2em] text-gold/60">Consumes per sec</p>
                {ongoingCost.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {ongoingCost.map((entry, index) => {
                      const name = findResourceById(Number(entry.resource))?.trait ?? `Resource ${entry.resource}`;
                      return (
                        <div
                          key={`${entry.resource}-${index}`}
                          className="flex items-center gap-2 rounded border border-gold/20 bg-black/40 px-2 py-1"
                        >
                          <span className="text-xxs font-semibold text-red-200">-{entry.amount}</span>
                          <button
                            type="button"
                            className="flex h-6 w-6 items-center justify-center rounded"
                            onMouseEnter={() =>
                              setTooltip({
                                position: "top",
                                content: (
                                  <div className="flex items-center gap-2 text-xxs text-gold">
                                    <ResourceIcon withTooltip={false} resource={name} size="xs" />
                                    <span className="font-semibold">{name}</span>
                                  </div>
                                ),
                              })
                            }
                            onMouseLeave={() => setTooltip(null)}
                            aria-label={`Consumes ${entry.amount} ${name} per second`}
                          >
                            <ResourceIcon withTooltip={false} resource={name} size="xs" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xxs text-gold/60">No ongoing inputs</p>
                )}
              </div>

              {buildCost.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xxs uppercase tracking-[0.2em] text-gold/60">Build Cost</p>
                  <div className="flex flex-wrap gap-2">
                    {buildCost.map((entry, index) => {
                      const name = findResourceById(Number(entry.resource))?.trait ?? `Resource ${entry.resource}`;
                      const balanceInfo = getBalance(
                        structureEntityId ?? 0,
                        entry.resource,
                        currentDefaultTick,
                        setup.components,
                      );
                      const balance = divideByPrecision(balanceInfo.balance);
                      const hasEnough = balance >= entry.amount;
                      return (
                        <button
                          type="button"
                          key={`build-cost-${entry.resource}-${index}`}
                          className={cn(
                            "relative flex items-center gap-2 rounded px-2 py-1.5 text-[11px] shadow-inner",
                            hasEnough
                              ? "bg-gold/5 border border-gold/10 text-gold/80"
                              : "bg-red-900/15 border border-red-500/30 text-red-100",
                          )}
                          onMouseEnter={() =>
                            setTooltip({
                              position: "top",
                              content: (
                                <div className="flex items-center gap-2 text-xxs text-gold">
                                  <ResourceIcon withTooltip={false} resource={name} size="xs" />
                                  <span className="font-semibold">{name}</span>
                                </div>
                              ),
                            })
                          }
                          onMouseLeave={() => setTooltip(null)}
                          aria-label={`${name} build cost`}
                        >
                          <ResourceIcon withTooltip={false} resource={name} size="xs" />
                          <span className={cn("text-[11px]", hasEnough ? "text-gold font-semibold" : "text-red-200")}>
                            {formatResourceAmount(balance)}
                          </span>
                          <span className={cn("text-[11px]", hasEnough ? "text-gold/70" : "text-red-200")}>
                            / {entry.amount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isOwnedByPlayer && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {canAddProduction && (
                    <Button
                      size="xs"
                      variant="gold"
                      disabled={isActionLoading}
                      onClick={() => toggleModal(<ProductionModal preSelectedResource={producedResource} />)}
                      className="text-xxs h-7"
                    >
                      + Production
                    </Button>
                  )}
                  {buildingCategory !== BuildingType.WorkersHut && (
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={isActionLoading}
                      onClick={handleToggleProduction}
                      className="text-xxs h-7"
                    >
                      {isPaused ? "▶ Resume" : "⏸ Pause"}
                    </Button>
                  )}
                  {!isCastleTile && (
                    <Button
                      size="xs"
                      variant="danger"
                      disabled={isActionLoading}
                      onClick={handleDestroy}
                      className="text-xxs h-7 flex items-center gap-2"
                    >
                      <Trash2 className="h-3 w-3" />
                      {showDestroyConfirm ? "Confirm" : "Delete"}
                    </Button>
                  )}
                </div>
              )}

              {isCastleTile && structureUpgrade && (
                <div className="space-y-2 rounded border border-gold/15 bg-black/40 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xxs uppercase tracking-[0.25em] text-gold/60">
                      Upgrade {structureUpgrade.nextLevelName ? `to ${structureUpgrade.nextLevelName}` : "(max)"}
                    </p>
                    <span className="text-xxs text-gold/70">{structureUpgrade.nextLevelName ?? "Max level"}</span>
                  </div>
                  {structureUpgrade.nextLevel ? (
                    <div className="space-y-1">
                      {structureUpgrade.requirements.map((req) => {
                        const name = findResourceById(Number(req.resource))?.trait ?? `Resource ${req.resource}`;
                        const pct = Math.min(100, Math.floor((req.current * 100) / (req.amount || 1)));
                        return (
                          <div key={req.resource} className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xxs text-gold">
                              <span className="flex items-center gap-1">
                                <ResourceIcon withTooltip={false} resource={name} size="xs" />
                                {name}
                              </span>
                              <span className="text-gold/80">
                                {formatResourceAmount(req.current)} / {req.amount.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1.5 rounded bg-gold/10">
                              <div className="h-full rounded bg-gold" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      {!structureUpgrade.isOwner && (
                        <p className="text-xxs text-gold/60">Only the owner can upgrade.</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xxs text-gold/60">Castle at maximum level.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[140px] flex-col items-center justify-center text-center">
            <p className="text-xs text-gold/70">
              Empty tile. Pick a building from the menu to start construction here.
            </p>
          </div>
        )
      ) : (
        <div className="flex min-h-[140px] flex-col items-center justify-center text-center">
          <p className="text-xs text-gold/70">Tap a building tile to view its details.</p>
        </div>
      )}
    </PanelFrame>
  );
};

const MinimapPanel = () => {
  const [tiles, setTiles] = useState<MinimapTile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeTab = useUIStore((state) => state.activeBottomPanelTab);
  const selectedHex = useUIStore((state) => state.selectedHex);
  const navigationTarget = useUIStore((state) => state.navigationTarget);
  const cameraTargetHex = useUIStore((state) => state.cameraTargetHex);

  useEffect(() => {
    if (activeTab !== "minimap") return;
    let cancelled = false;
    const loadTiles = async () => {
      setIsLoading(true);
      try {
        const fetched = await sqlApi.fetchAllTiles();
        if (!cancelled) {
          setTiles(
            fetched.map((tile) =>
              normalizeMinimapTile({
                col: tile.col,
                row: tile.row,
                biome: tile.biome,
                occupier_id: tile.occupier_id?.toString(),
                occupier_type: tile.occupier_type,
                occupier_is_structure: tile.occupier_is_structure,
              }),
            ),
          );
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load minimap data");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadTiles();
    const interval = setInterval(loadTiles, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeTab]);

  return (
    <PanelFrame title="Minimap" attached>
      <div className="relative flex h-full min-h-0 flex-col">
        <div className="relative flex-1 min-h-[220px] overflow-hidden rounded-b-xl rounded-t-none border border-gold/15 bg-gradient-to-br from-black/70 via-black/60 to-amber-900/20">
          <HexMinimap
            tiles={tiles}
            selectedHex={selectedHex}
            navigationTarget={navigationTarget}
            cameraTargetHex={cameraTargetHex}
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold/40 border-t-gold" />
            </div>
          )}
          {error && (
            <div className="absolute bottom-3 right-3 rounded bg-black/70 px-3 py-1 text-xxs text-red-200">{error}</div>
          )}
        </div>
      </div>
    </PanelFrame>
  );
};

export const BottomRightPanel = memo(() => {
  const { isMapView } = useQuery();
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const activeTab = useUIStore((state) => state.activeBottomPanelTab);
  const setActiveTab = useUIStore((state) => state.setActiveBottomPanelTab);
  const shouldShow = !showBlankOverlay;
  const isPanelOpen = shouldShow && activeTab !== null;

  const availableTabs = useMemo(
    () => (isMapView ? BOTTOM_PANEL_TABS : BOTTOM_PANEL_TABS.filter((tab) => tab.id === "tile")),
    [isMapView],
  );

  useEffect(() => {
    if (!isMapView && activeTab === "minimap") {
      setActiveTab("tile");
    }
  }, [activeTab, isMapView, setActiveTab]);

  const handleTabToggle = (tab: BottomPanelTabId) => {
    setActiveTab(activeTab === tab ? null : tab);
  };

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[35] flex flex-col gap-4 px-0 transition-all duration-300 md:flex-row md:items-end md:justify-end",
        shouldShow ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-6",
      )}
      aria-hidden={!shouldShow}
      style={{ bottom: BOTTOM_PANEL_MARGIN }}
    >
      <div className="relative w-full md:w-[37%] lg:w-[27%] md:ml-auto min-h-[44px]">
        <PanelTabs
          tabs={availableTabs}
          activeTab={activeTab}
          onSelect={handleTabToggle}
          className="absolute right-2 bottom-full pb-2"
        />
        <div className="pointer-events-auto">
          <div className={cn(activeTab === "tile" && isPanelOpen ? "block" : "hidden")}>
            {isMapView ? <MapTilePanel /> : <LocalTilePanel />}
          </div>
          <div className={cn(activeTab === "minimap" && isPanelOpen ? "block" : "hidden")}>
            <MinimapPanel />
          </div>
        </div>
      </div>
    </div>
  );
});

BottomRightPanel.displayName = "BottomRightPanel";
