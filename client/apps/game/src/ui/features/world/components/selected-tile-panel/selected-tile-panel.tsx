import { useUIStore } from "@/hooks/store/use-ui-store";
import { FELT_CENTER } from "@/ui/config";
import { cn } from "@/ui/design-system/atoms/lib/utils";
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
} from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { BUILDINGS_CENTER, BuildingType, BuildingTypeToString, ResourcesIds, findResourceById } from "@bibliothecadao/types";
import { LeftView } from "@/types";
import { getComponentValue } from "@dojoengine/recs";
import { memo, ReactNode, useEffect, useMemo, useState } from "react";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { SelectedWorldmapEntity } from "@/ui/features/world/components/actions/selected-worldmap-entity";
import { useStructureUpgrade } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import { RealmUpgradeCompact } from "@/ui/modules/entity-details/realm/realm-details";
import { ProductionModal } from "@/ui/features/settlement";
import Button from "@/ui/design-system/atoms/button";
import { TileManager } from "@bibliothecadao/eternum";
import { Info, Trash2 } from "lucide-react";

import { BOTTOM_PANEL_HEIGHT, BOTTOM_PANEL_MARGIN } from "./constants";

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

interface PanelFrameProps {
  title: string;
  children: ReactNode;
  className?: string;
}

const PanelFrame = ({ title, children, className }: PanelFrameProps) => (
  <section
    className={cn(
      "pointer-events-auto panel-wood panel-wood-corners border border-gold/20 bg-black/60 shadow-2xl flex h-full flex-col overflow-hidden",
      className,
    )}
    style={{ height: BOTTOM_PANEL_HEIGHT }}
  >
    <header className="flex items-center justify-between border-b border-gold/20 px-4 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-gold/70">{title}</p>
    </header>
    <div className="flex-1 min-h-0 overflow-hidden px-3 py-2">{children}</div>
  </section>
);

const MapTilePanel = () => {
  const selectedHex = useUIStore((state) => state.selectedHex);
  const { setup } = useDojo();
  const tileComponent = setup.components.Tile;

  const tile = useMemo(() => {
    if (!selectedHex || !tileComponent) return null;
    const selectedHexContract = new PositionInterface({
      x: selectedHex.col,
      y: selectedHex.row,
    }).getContract();
    return getComponentValue(
      tileComponent,
      getEntityIdFromKeys([BigInt(selectedHexContract.x), BigInt(selectedHexContract.y)]),
    );
  }, [selectedHex?.col, selectedHex?.row, tileComponent]);

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

  return (
    <PanelFrame title={panelTitle}>
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
  const { setup, account } = useDojo();
  const buildingComponent = setup.components.Building;
  const selectedBuildingHex = useUIStore((state) => state.selectedBuildingHex);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const leftView = useUIStore((state) => state.leftNavigationView);
  const useSimpleCost = useUIStore((state) => state.useSimpleCost);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const structureUpgrade = useStructureUpgrade(structureEntityId ?? null);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const structureBase = useMemo(() => {
    const structure = playerStructures.find((entry) => entry.entityId === structureEntityId);
    const base = structure?.structure?.base;
    if (!base || base.coord_x === undefined || base.coord_y === undefined) {
      return null;
    }
    return {
      outerCol: Number(base.coord_x),
      outerRow: Number(base.coord_y),
    };
  }, [playerStructures, structureEntityId]);

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
    return producedResource !== undefined ? findResourceById(producedResource)?.trait ?? null : null;
  }, [producedResource]);

  const ongoingCost = useMemo(() => {
    if (producedResource === undefined) return [];
    const costs =
      (useSimpleCost
        ? configManager.simpleSystemResourceInputs[producedResource]
        : configManager.complexSystemResourceInputs[producedResource]) ?? {};
    const values = Array.isArray(costs) ? costs : Object.values(costs);
    return values.filter((entry) => entry && entry.resource !== undefined);
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
  }, [selectedBuildingHex?.outerCol, selectedBuildingHex?.outerRow, selectedBuildingHex?.innerCol, selectedBuildingHex?.innerRow]);

  const buildCost = useMemo(() => {
    if (!hasBuilding || buildingCategory === null) return [];
    const rawCost =
      getBuildingCosts(structureEntityId ?? 0, setup.components, buildingCategory as BuildingType, useSimpleCost) ?? [];
    const values = Array.isArray(rawCost) ? rawCost : Object.values(rawCost);
    return values.filter((entry) => entry && entry.resource !== undefined);
  }, [buildingCategory, hasBuilding, setup.components, structureEntityId, useSimpleCost]);

  const isOwnedByPlayer = useMemo(() => {
    if (!building) return false;
    const ownerId = typeof building.outer_entity_id === "bigint" ? Number(building.outer_entity_id) : building.outer_entity_id;
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
    <PanelFrame title={panelTitle}>
      {selectedBuildingHex ? (
        isCastleTile ? (
          <div className="h-full min-h-0 overflow-auto">
            <RealmUpgradeCompact />
          </div>
        ) : hasBuilding ? (
          <div className="h-full min-h-0 overflow-hidden">
            <div className="flex flex-col gap-3 text-xs text-gold">
              {isPaused && (
                <div className="flex justify-end">
                  <span className="rounded-full bg-red/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-red-200">
                    Paused
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xxs uppercase tracking-[0.2em] text-gold/60">
                    {isCastleTile ? "Labor rate" : "Produces per sec"}
                  </p>
                  {producedResource && producedResourceName ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-green-300">
                        +{producedPerTick}
                      </span>
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
                                      const name = findResourceById(Number(resourceId))?.trait ?? `Resource ${resourceId}`;
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
                    <span className="text-xxs text-gold/70">
                      {structureUpgrade.nextLevelName ?? "Max level"}
                    </span>
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
                              <div
                                className="h-full rounded bg-gold"
                                style={{ width: `${pct}%` }}
                              />
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

export const SelectedTilePanel = memo(() => {
  const { isMapView } = useQuery();
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const shouldShow = !showBlankOverlay;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[35] flex flex-col gap-4 px-0 transition-all duration-300 md:flex-row md:items-end md:justify-end",
        shouldShow ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-6",
      )}
      aria-hidden={!shouldShow}
      style={{ bottom: BOTTOM_PANEL_MARGIN }}
    >
      <div className="w-full md:w-[37%] lg:w-[27%] md:ml-auto">
        {isMapView ? <MapTilePanel /> : <LocalTilePanel />}
      </div>
    </div>
  );
});

SelectedTilePanel.displayName = "SelectedTilePanel";
