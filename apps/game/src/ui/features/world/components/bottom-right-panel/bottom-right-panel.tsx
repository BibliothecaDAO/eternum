import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { surfaceAnchorFrom } from "@/ui/design-system/molecules/popover";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { buildingEntityKey, gameEntityKey } from "@/sync/game-scope";
import { useTileAt } from "@/hooks/helpers/use-tile-at";
import { isVillageLikeStructureCategory, normalizeStructureCategory } from "@/lib/structure-type-utils";
import { BuildingThumbs, FELT_CENTER } from "@/ui/config";
import { LeftView } from "@/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY, HUD_BODY_MUTED, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import Button from "@/ui/design-system/atoms/button";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { MarketModal } from "@/ui/features/economy/trading";
import {
  configManager,
  divideByPrecision,
  getEntityIdFromKeys,
  getConsumedBy,
  getBuildingCosts,
  getBalance,
  getBlockTimestamp,
  hasTileOccupier,
  isTileOccupierChest,
  isTileOccupierQuest,
  isTileOccupierReservedHyperstructure,
  isTileOccupierStructure,
} from "@bibliothecadao/eternum";
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import { useDojo, useQuery } from "@bibliothecadao/react";
import {
  BUILDINGS_CENTER,
  BuildingType,
  BuildingTypeToString,
  ID,
  ResourcesIds,
  StructureType,
  TileOccupier,
  findResourceById,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { memo, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { SelectedWorldmapEntity } from "@/ui/features/world/components/actions/selected-worldmap-entity";
import { RealmUpgradeCompact } from "@/ui/modules/entity-details/realm/realm-details";
import { ProductionModal } from "@/ui/features/settlement";
import { resolveRealmHasAvailableBuildingTile } from "@/ui/features/settlement/construction/realm-build-actions";
import { TileManager } from "@bibliothecadao/eternum";
import Bot from "lucide-react/dist/esm/icons/bot";
import Factory from "lucide-react/dist/esm/icons/factory";
import Hammer from "lucide-react/dist/esm/icons/hammer";
import Info from "lucide-react/dist/esm/icons/info";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle";
import PauseIcon from "lucide-react/dist/esm/icons/pause";
import Pickaxe from "lucide-react/dist/esm/icons/pickaxe";
import Play from "lucide-react/dist/esm/icons/play";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";

import { BOTTOM_PANEL_HEIGHT, BOTTOM_PANEL_MARGIN, LEFT_ACTIONS_GAP_FROM_MINIMAP, MINIMAP_SIZE } from "./constants";
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

interface PanelFrameProps {
  title: string;
  children: ReactNode;
  headerAction?: ReactNode;
  className?: string;
  /**
   * Optional pixel height. Defaults to BOTTOM_PANEL_HEIGHT (used by the tile
   * details panel); minimap renders at a smaller height since it's a constant
   * reference widget rather than a content panel.
   */
  height?: number;
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

const PanelFrame = ({ title, children, headerAction, className, height }: PanelFrameProps) => (
  <section
    className={cn(
      "pointer-events-auto flex h-full flex-col overflow-hidden rounded-xl",
      OVERLAY_SURFACE_BASE,
      className,
    )}
    style={{ height: height ?? BOTTOM_PANEL_HEIGHT }}
  >
    <header className="flex items-center justify-between gap-2 border-b border-gold/20 px-2 py-1 lg:px-3 lg:py-1.5">
      <p className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.35em] text-gold/70">
        {title}
      </p>
      {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
    </header>
    <div className="flex-1 min-h-0 overflow-hidden px-1.5 py-1 lg:px-2.5 lg:py-2">{children}</div>
  </section>
);

const MapTilePanel = () => {
  const selectedHex = useUIStore((state) => state.selectedHex);

  const tile = useTileAt(selectedHex?.col, selectedHex?.row) ?? null;

  const hasOccupier = useMemo(() => {
    if (!tile) return false;
    return hasTileOccupier(tile.occupier_type);
  }, [tile]);

  const occupierType = useMemo(() => tile?.occupier_type ?? 0, [tile]);

  const isSpire = useMemo(() => {
    return occupierType === TileOccupier.Spire;
  }, [occupierType]);

  const isStructure = useMemo(() => {
    return Boolean(tile?.occupier_is_structure) || isTileOccupierStructure(occupierType);
  }, [occupierType, tile?.occupier_is_structure]);

  const isReservedHyperstructure = useMemo(() => {
    return isTileOccupierReservedHyperstructure(occupierType);
  }, [occupierType]);

  const isChest = useMemo(() => {
    return isTileOccupierChest(occupierType);
  }, [occupierType]);

  const isQuest = useMemo(() => {
    return isTileOccupierQuest(occupierType);
  }, [occupierType]);

  const tileTypeLabel = useMemo(() => {
    if (!tile) return "Hex Tile";
    if (!hasOccupier) return "Biome Tile";
    if (isSpire) return "Spire Tile";
    if (isReservedHyperstructure) return "Unconstructed Hyperstructure";
    if (isStructure) return "Structure Tile";
    if (isChest) return "Relic Tile";
    if (isQuest) return "Quest Tile";
    return "Army Tile";
  }, [tile, hasOccupier, isSpire, isReservedHyperstructure, isStructure, isChest, isQuest]);

  const panelTitle = selectedHex
    ? `${tileTypeLabel} · (${selectedHex.col - FELT_CENTER()}, ${selectedHex.row - FELT_CENTER()})`
    : "No Tile Selected";

  return (
    <>
      {selectedHex ? (
        <SelectedWorldmapEntity coordsLabel={panelTitle} />
      ) : (
        <div className={cn("pointer-events-auto rounded-xl px-4 py-6 text-center", OVERLAY_SURFACE_BASE)}>
          <p className={HUD_BODY}>Tap any tile on the world map to view its occupants and resources.</p>
        </div>
      )}
    </>
  );
};

const LocalTilePanel = () => {
  const { setup, account } = useDojo();
  const buildingComponent = setup.components.Building;
  const selectedBuildingHex = useUIStore((state) => state.selectedBuildingHex);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const useSimpleCost = useUIStore((state) => state.useSimpleCost);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const openSurface = usePopoverStore((state) => state.openSurface);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const previewBuilding = useUIStore((state) => state.previewBuilding);
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const mode = useGameModeConfig();

  const selectedStructure = useMemo(() => {
    const structure = playerStructures.find((entry) => entry.entityId === structureEntityId);
    const base = structure?.structure?.base;
    if (base && base.coord_x !== undefined && base.coord_y !== undefined) {
      return {
        outerCol: Number(base.coord_x),
        outerRow: Number(base.coord_y),
        category: normalizeStructureCategory(base.category),
      };
    }

    let structureEntityKey: ReturnType<typeof getEntityIdFromKeys> | undefined;
    try {
      structureEntityKey = gameEntityKey([BigInt(structureEntityId)]);
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
        category: normalizeStructureCategory(liveBase.category),
      };
    }

    return null;
  }, [playerStructures, setup.components.Structure, structureEntityId]);

  useEffect(() => {
    if (!selectedStructure) return;
    if (
      !selectedBuildingHex ||
      selectedBuildingHex.outerCol !== selectedStructure.outerCol ||
      selectedBuildingHex.outerRow !== selectedStructure.outerRow
    ) {
      setSelectedBuildingHex({
        outerCol: selectedStructure.outerCol,
        outerRow: selectedStructure.outerRow,
        innerCol: BUILDINGS_CENTER[0],
        innerRow: BUILDINGS_CENTER[1],
      });
    }
  }, [selectedBuildingHex, selectedStructure, setSelectedBuildingHex]);

  const building = useMemo(() => {
    if (!selectedBuildingHex || !buildingComponent) return null;
    // Building keys on s2 are (game_id, alt, outer_col, outer_row, inner_col,
    // inner_row) — the dedicated helper inserts the alt key; a plain
    // gameEntityKey lookup always missed, so every built tile read as empty.
    return getComponentValue(
      buildingComponent,
      buildingEntityKey(
        selectedBuildingHex.outerCol,
        selectedBuildingHex.outerRow,
        selectedBuildingHex.innerCol,
        selectedBuildingHex.innerRow,
      ),
    );
  }, [buildingComponent, selectedBuildingHex]);

  const buildingCategory = useMemo(() => {
    if (!building) return null;
    return typeof building.category === "bigint" ? Number(building.category) : building.category;
  }, [building]);

  const isCastleTile =
    !!selectedBuildingHex &&
    selectedBuildingHex.innerCol === BUILDINGS_CENTER[0] &&
    selectedBuildingHex.innerRow === BUILDINGS_CENTER[1];

  const selectedStructureCategory = selectedStructure?.category ?? null;
  const hasBuilding = buildingCategory !== null && buildingCategory !== BuildingType.None;
  const buildingName = (() => {
    if (isCastleTile) {
      if (selectedStructureCategory === StructureType.Realm) return "Castle";
      if (isVillageLikeStructureCategory(selectedStructureCategory)) return mode.labels.village;
      if (selectedStructureCategory === StructureType.FragmentMine) return mode.labels.fragmentMine;
      if (selectedStructureCategory === StructureType.Hyperstructure) return "Hyperstructure";
      if (selectedStructureCategory === StructureType.Bank) return "Bank";
      return "Structure";
    }
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

  // Cancel any active "build another" preview when the player picks a
  // different tile. Otherwise the preview from one building leaks into the
  // next click and ghost-places a new building on an occupied tile, which
  // the player reads as the panel being broken.
  useEffect(() => {
    setPreviewBuilding(null);
    // We intentionally only run on tile changes — the preview is local to a
    // building selection, and resetting on every render would block the
    // pickaxe toggle below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedBuildingHex?.outerCol,
    selectedBuildingHex?.outerRow,
    selectedBuildingHex?.innerCol,
    selectedBuildingHex?.innerRow,
  ]);

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

  // ---- Local-tile render ---------------------------------------------------
  // Two bubbles max for buildings: a header strip and a single "Building"
  // bubble that groups production / consumes / population / build cost /
  // actions into compact rows separated by hairlines. The previous version
  // had five separate bubbles and felt over-atomized.
  if (!selectedBuildingHex) {
    return (
      <div
        className={cn(
          "pointer-events-auto flex flex-col items-center justify-center rounded-xl px-4 py-6 text-center",
          OVERLAY_SURFACE_BASE,
        )}
      >
        <p className={HUD_BODY}>Tap a building tile to view its details.</p>
      </div>
    );
  }

  // Castle tile — the realm rail already prints level / population / guards
  // so we don't repeat them here. Just the header strip (coords + Re-sync)
  // and the upgrade card, which carries its own production + missing-
  // resource breakdown.
  if (isCastleTile) {
    return (
      <InfoBubble title={panelTitle} bodyClassName="pt-0">
        <RealmUpgradeCompact />
      </InfoBubble>
    );
  }

  if (!hasBuilding) {
    return (
      <InfoBubble title={panelTitle}>
        <p className={HUD_BODY_MUTED}>Empty tile. Pick a building from the menu to start construction here.</p>
      </InfoBubble>
    );
  }

  const populationChips: Array<{ key: string; label: string }> = [];
  if (populationCost !== 0) populationChips.push({ key: "cost", label: `Cost +${populationCost}` });
  if (populationCapacity !== 0) populationChips.push({ key: "cap", label: `Capacity +${populationCapacity}` });

  // Compact row helper used inside the consolidated building bubble.
  const SectionRow = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="space-y-1">
      <span className={HUD_LABEL}>{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );

  // One chip style for every section (produces / consumes / population /
  // build cost). The variant just colors the value text — the wrapper is
  // always the same etched-bronze chip so the rows read as one design.
  const chipBase =
    "flex items-center gap-1 rounded border border-gold/20 bg-black/40 px-1.5 py-1 text-[11px] font-semibold tabular-nums";
  const valueClassFor = (variant: "neutral" | "good" | "bad" | "warn") => {
    switch (variant) {
      case "good":
        return "text-emerald-300";
      case "bad":
        return "text-red-300";
      case "warn":
        return "text-amber-200";
      default:
        return "text-gold";
    }
  };

  // "Build another" affordance — gated by owner + sufficient resources for
  // every cost entry + at least one open building tile inside the realm
  // radius. Computed inline (no hook) so it stays below the early returns
  // without breaking hook order rules. resolveRealmHasAvailableBuildingTile
  // is the same helper the Build modal uses; it reads from RECS so it's
  // cheap to call once per render.
  const hasAvailableTile = (() => {
    if (!structureEntityId || !selectedStructure) return false;
    return resolveRealmHasAvailableBuildingTile({
      entityId: structureEntityId,
      realmPosition: { x: selectedStructure.outerCol, y: selectedStructure.outerRow },
      world: {
        components: setup.components,
        systemCalls: setup.systemCalls,
      },
    });
  })();

  const canBuildAnother = (() => {
    if (!isOwnedByPlayer) return false;
    if (buildCost.length === 0) return false;
    if (!hasAvailableTile) return false;
    return buildCost.every((entry) => {
      const balanceInfo = getBalance(structureEntityId ?? 0, entry.resource, currentDefaultTick, setup.components);
      return divideByPrecision(balanceInfo.balance) >= entry.amount;
    });
  })();

  const buildBlockedReason = !isOwnedByPlayer
    ? "Not your structure"
    : !hasAvailableTile
      ? "No empty tiles available — destroy a building to free a slot"
      : !canBuildAnother
        ? "Not enough resources to build another"
        : "";

  return (
    <>
      {/* Building bubble — merges the tile header with the type's stats. The
          name + coords + Re-sync live in the bubble's title/cue. */}
      <InfoBubble title={panelTitle} icon={Factory}>
        <div className="flex flex-col gap-2.5 divide-y divide-gold/10 [&>*:not(:first-child)]:pt-2.5">
          {isPaused && isOwnedByPlayer && (
            <div className="flex items-center justify-between gap-2 rounded border border-red-400/40 bg-red-900/25 px-2 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-200">
                ⚠️ Production paused
              </span>
              <Button
                size="xs"
                variant="outline"
                disabled={isActionLoading}
                onClick={handleToggleProduction}
                className="h-7 border-green/50 bg-green/20 px-2 text-xxs hover:bg-green/40"
              >
                ▶ Resume
              </Button>
            </div>
          )}

          {producedResource && producedResourceName && (
            <SectionRow label="Produces / sec">
              <span className={chipBase} title={producedResourceName}>
                <span className={valueClassFor("good")}>+{producedPerTick}</span>
                <ResourceIcon withTooltip={false} resource={producedResourceName} size="xs" />
              </span>
              <button
                type="button"
                onMouseEnter={() =>
                  setTooltip({
                    position: "right",
                    content: (
                      <div className="space-y-2">
                        <p className="text-xxs uppercase tracking-[0.25em] text-gold/60">Consumed by</p>
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
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-gold/20 bg-black/40 text-gold/70 hover:text-gold"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </SectionRow>
          )}

          {ongoingCost.length > 0 && (
            <SectionRow label="Consumes / sec">
              {ongoingCost.map((entry, index) => {
                const name = findResourceById(Number(entry.resource))?.trait ?? `Resource ${entry.resource}`;
                return (
                  <span key={`${entry.resource}-${index}`} className={chipBase} title={name}>
                    <span className={valueClassFor("bad")}>-{entry.amount}</span>
                    <ResourceIcon withTooltip={false} resource={name} size="xs" />
                  </span>
                );
              })}
            </SectionRow>
          )}

          {populationChips.length > 0 && (
            <SectionRow label="Population">
              {populationChips.map((chip) => (
                <span key={chip.key} className={chipBase} title={chip.label}>
                  <span className={valueClassFor("neutral")}>{chip.label}</span>
                </span>
              ))}
            </SectionRow>
          )}
        </div>
      </InfoBubble>

      {/* Actions bubble — build cost + the live action buttons. Pickaxe
          is always rendered (greyed out when constraints don't allow), so
          the player knows it's a real affordance and gets a tooltip with
          why it's disabled. */}
      {isOwnedByPlayer && (
        <InfoBubble title="Actions" icon={Hammer}>
          <div className="flex flex-col gap-2.5">
            {buildCost.length > 0 && (
              <SectionRow label="Build cost">
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
                    <span key={`build-cost-${entry.resource}-${index}`} className={chipBase} title={name}>
                      <ResourceIcon withTooltip={false} resource={name} size="xs" />
                      <span className={valueClassFor(hasEnough ? "neutral" : "bad")}>
                        {formatResourceAmount(balance)}
                      </span>
                      <span className={hasEnough ? "text-gold/55" : "text-red-300/80"}>/ {entry.amount}</span>
                    </span>
                  );
                })}
              </SectionRow>
            )}

            <div className="flex items-center justify-center gap-1.5">
              {buildingCategory !== null &&
                (() => {
                  const isPreviewing =
                    previewBuilding?.type === buildingCategory && previewBuilding?.resource === producedResource;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (isPreviewing) {
                          // Toggle off — exit build mode and unstick clicks.
                          setPreviewBuilding(null);
                          return;
                        }
                        if (!canBuildAnother) return;
                        setPreviewBuilding({ type: buildingCategory, resource: producedResource });
                      }}
                      disabled={!isPreviewing && (!canBuildAnother || isActionLoading)}
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-md border shadow transition",
                        isPreviewing
                          ? "border-emerald-400 bg-emerald-500/30 text-emerald-100 shadow-[0_0_10px_rgba(110,231,183,0.5)] animate-pulse"
                          : canBuildAnother
                            ? "border-amber-500/80 bg-amber-400/90 text-black hover:bg-amber-300"
                            : "border-gold/20 bg-black/40 text-gold/40 cursor-not-allowed",
                      )}
                      title={
                        isPreviewing
                          ? "Cancel build — click again to place a new building"
                          : canBuildAnother
                            ? "Build another — pick an empty tile to place it"
                            : buildBlockedReason
                      }
                      aria-label={isPreviewing ? "Cancel build" : "Build another"}
                      aria-pressed={isPreviewing}
                    >
                      <Pickaxe className="h-3.5 w-3.5" />
                    </button>
                  );
                })()}
              {canAddProduction && (
                <button
                  type="button"
                  onClick={(event) =>
                    openSurface({
                      id: "production",
                      content: <ProductionModal preSelectedResource={producedResource} />,
                      anchor: surfaceAnchorFrom(event.currentTarget),
                    })
                  }
                  disabled={isActionLoading}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gold/40 bg-gold/10 text-gold shadow transition hover:border-gold hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Automate production"
                  aria-label="Automate production"
                >
                  <Bot className="h-3.5 w-3.5" />
                </button>
              )}
              {buildingCategory !== BuildingType.WorkersHut && (
                <button
                  type="button"
                  onClick={handleToggleProduction}
                  disabled={isActionLoading}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-md border text-white shadow transition disabled:cursor-not-allowed disabled:opacity-60",
                    isPaused
                      ? "border-green-700/80 bg-green-900/90 hover:bg-green-800"
                      : "border-amber-700/80 bg-amber-900/90 hover:bg-amber-800",
                  )}
                  title={isPaused ? "Resume" : "Pause"}
                  aria-label={isPaused ? "Resume" : "Pause"}
                >
                  {isPaused ? <Play className="h-3.5 w-3.5" /> : <PauseIcon className="h-3.5 w-3.5" />}
                </button>
              )}
              <button
                type="button"
                onClick={handleDestroy}
                disabled={isActionLoading}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md border border-red-700/80 bg-red-900/90 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60",
                  !showDestroyConfirm && "w-7 justify-center px-0",
                )}
                title={showDestroyConfirm ? "Confirm delete" : "Delete"}
                aria-label={showDestroyConfirm ? "Confirm delete" : "Delete"}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {showDestroyConfirm && <span>OK</span>}
              </button>
            </div>
          </div>
        </InfoBubble>
      )}
    </>
  );
};

const MinimapPanel = () => {
  const [tiles, setTiles] = useState<MinimapTile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const navigationTarget = useUIStore((state) => state.navigationTarget);
  const cameraTargetHex = useUIStore((state) => state.cameraTargetHex);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const playerStructures = useUIStore((state) => state.playerStructures);

  // Local mode: lock the minimap to the active realm's coords so the player
  // keeps a stable reference while they're zoomed into one keep. World mode
  // uses the camera/selected hex priority HexMinimap already implements.
  const activeRealmHex = useMemo(() => {
    if (isMapView) return null;
    const active = playerStructures.find((entry) => entry.entityId === structureEntityId);
    const base = active?.structure?.base;
    if (!base || base.coord_x === undefined || base.coord_y === undefined) return null;
    return { col: Number(base.coord_x), row: Number(base.coord_y) };
  }, [isMapView, playerStructures, structureEntityId]);

  const focusHex = activeRealmHex ?? cameraTargetHex;
  const focusSelectedHex = activeRealmHex ?? selectedHex;

  useEffect(() => {
    const projection = getActiveGameSyncRuntime()?.getWorldSpatialProjection();
    if (!projection) {
      console.error("[MinimapPanel] WorldSpatialProjection is unavailable for the active game");
      setIsLoading(false);
      return;
    }

    const readTiles = () => {
      setTiles(
        projection.getTiles().map((tile) =>
          normalizeMinimapTile({
            col: tile.hexCoords.col,
            row: tile.hexCoords.row,
            biome: tile.biome,
            occupier_id: tile.occupierId.toString(),
            occupier_type: tile.occupierType,
            occupier_is_structure: tile.occupierIsStructure,
          }),
        ),
      );
      setIsLoading(false);
    };

    readTiles();
    return projection.subscribeTiles(readTiles);
  }, []);

  return (
    <PanelFrame title="Minimap" height={MINIMAP_SIZE}>
      <div className="relative flex h-full min-h-0 flex-col">
        <div className="relative flex-1 min-h-[220px] overflow-hidden rounded-b-xl rounded-t-none border border-gold/15 bg-gradient-to-br from-black/70 via-black/60 to-amber-900/20">
          <HexMinimap
            tiles={tiles}
            selectedHex={focusSelectedHex}
            navigationTarget={navigationTarget}
            cameraTargetHex={focusHex}
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold/40 border-t-gold" />
            </div>
          )}
        </div>
      </div>
    </PanelFrame>
  );
};

/**
 * BottomRightPanel — atomized into two independent floating widgets:
 *   - TileDetailsAtom: bottom-right, only when a tile/building is selected.
 *   - MinimapAtom: bottom-left, persistent in map view.
 * They no longer share a frame or tab strip.
 */
export const BottomRightPanel = memo(() => {
  const { isMapView } = useQuery();
  const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);
  const selectedHex = useUIStore((state) => state.selectedHex);
  const selectedBuildingHex = useUIStore((state) => state.selectedBuildingHex);

  if (showBlankOverlay) return null;

  // Tile details visibility: in map view follow the selected hex; in local
  // (hex) view follow the selected building hex. Either source produces the
  // same panel chrome but different content.
  const showTileDetails = isMapView ? selectedHex !== null : selectedBuildingHex !== null;
  // Minimap + action row stay persistent in both map and local views — the
  // player wants to keep an eye on activity near their realm even while they
  // manage tiles up close.
  const showMinimap = true;

  return (
    <>
      {showMinimap && (
        <>
          <LeftActionsRow
            style={{ bottom: `calc(${BOTTOM_PANEL_MARGIN} + ${MINIMAP_SIZE}px + ${LEFT_ACTIONS_GAP_FROM_MINIMAP}px)` }}
          />
          <div
            className="pointer-events-auto fixed left-3 z-[25]"
            style={{ bottom: BOTTOM_PANEL_MARGIN, width: MINIMAP_SIZE }}
            aria-label="Minimap"
          >
            <MinimapPanel />
          </div>
        </>
      )}
      {showTileDetails && (
        <div
          className="pointer-events-auto fixed right-3 top-1/2 z-30 flex w-[280px] max-h-[calc(100vh-32px)] -translate-y-1/2 flex-col gap-2 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent"
          aria-label="Tile details"
        >
          {isMapView ? <MapTilePanel /> : <LocalTilePanel />}
        </div>
      )}
    </>
  );
});

BottomRightPanel.displayName = "BottomRightPanel";

// ---------------------------------------------------------------------------
// LeftActionsRow — small horizontal row of CircleButtons floating above the
// minimap. Each button opens its corresponding modal/popup:
//   Build           → ConstructionView modal (SelectPreviewBuildingMenu)
//   Transfer        → LogisticsView modal (with Transfer tab pre-selected)
//   Chat            → Chat modal
//   Trade           → MarketModal (openSurface)
//   Prediction      → PredictionMarket modal
// Replaces the old vertical view-switcher pill strip on the left edge.
// ---------------------------------------------------------------------------

const LeftActionsRow = ({ style }: { style?: React.CSSProperties }) => {
  const view = useUIStore((state) => state.leftNavigationView);
  const setView = useUIStore((state) => state.setLeftNavigationView);
  const openSurface = usePopoverStore((state) => state.openSurface);
  const setLogisticsActiveTab = useUIStore((state) => state.setLogisticsActiveTab);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const arrivedArrivalsNumber = useUIStore((state) => state.arrivedArrivalsNumber);
  const pendingArrivalsNumber = useUIStore((state) => state.pendingArrivalsNumber);
  const isSpectating = useUIStore((state) => state.isSpectating);
  const mode = useGameModeConfig();
  const showTradeAction = mode.ui.showTradeMenu && !isSpectating;
  const handleOpenLogistics = useCallback(() => {
    // If anything is in flight or ready, land the user on Arrivals so the
    // badge they just clicked actually points at the relevant tab.
    const hasArrivals = arrivedArrivalsNumber > 0 || pendingArrivalsNumber > 0;
    setLogisticsActiveTab(hasArrivals ? "arrivals" : "transfer");
    setView(view === LeftView.ResourceArrivals ? LeftView.None : LeftView.ResourceArrivals);
  }, [arrivedArrivalsNumber, pendingArrivalsNumber, setLogisticsActiveTab, setView, view]);
  const handleOpenProduction = useCallback(() => {
    if (!structureEntityId) return;
    openSurface({ id: "production", content: <ProductionModal preSelectedRealmId={Number(structureEntityId)} /> });
  }, [structureEntityId, openSurface]);
  const toggleView = useCallback(
    (target: LeftView) => () => setView(view === target ? LeftView.None : target),
    [setView, view],
  );

  return (
    <div
      className="pointer-events-auto fixed left-3 z-[25] flex items-center gap-2 rounded-full border border-gold/30 bg-black/60 px-2.5 py-1.5 shadow-[0_4px_18px_rgba(0,0,0,0.6)] backdrop-blur-sm"
      style={style}
      aria-label="Quick actions"
    >
      {!isSpectating && (
        <>
          <CircleButton
            variant="action"
            size="md"
            tooltipLocation="top"
            image={BuildingThumbs.construction}
            label="Build"
            active={view === LeftView.ConstructionView}
            onClick={toggleView(LeftView.ConstructionView)}
          />
          <CircleButton
            variant="action"
            size="md"
            tooltipLocation="top"
            image={BuildingThumbs.production}
            label="Production"
            onClick={handleOpenProduction}
            disabled={!structureEntityId}
          />
          <CircleButton
            variant="action"
            size="md"
            tooltipLocation="top"
            image={BuildingThumbs.military}
            label="Military"
            active={view === LeftView.MilitaryView}
            onClick={toggleView(LeftView.MilitaryView)}
            disabled={!structureEntityId}
          />
          <CircleButton
            variant="action"
            size="md"
            tooltipLocation="top"
            image={BuildingThumbs.transfer}
            label="Transfer"
            active={view === LeftView.ResourceArrivals}
            onClick={handleOpenLogistics}
            primaryNotification={
              arrivedArrivalsNumber > 0
                ? { value: arrivedArrivalsNumber, color: "green", location: "topright" }
                : undefined
            }
            secondaryNotification={
              pendingArrivalsNumber > 0
                ? { value: pendingArrivalsNumber, color: "yellow", location: "bottomright" }
                : undefined
            }
          />
        </>
      )}
      <CircleButton
        variant="action"
        size="md"
        tooltipLocation="top"
        label="Chat"
        active={view === LeftView.ChatView}
        onClick={toggleView(LeftView.ChatView)}
      >
        <MessageCircle className="h-5 w-5 md:h-6 md:w-6 text-[#2a1c0c]" strokeWidth={2.25} />
      </CircleButton>
      {showTradeAction && (
        <CircleButton
          variant="action"
          size="md"
          tooltipLocation="top"
          image={BuildingThumbs.scale}
          label="Trade"
          onClick={() => openSurface({ id: "market", content: <MarketModal /> })}
        />
      )}
      {/* Prediction Market button retired: the PM deployment is gone until
          W6 — the modal would initialize against a dead host. */}
    </div>
  );
};
