import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { knownBalance } from "@/ui/utils/utils";

import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { getMinePresentation } from "@bibliothecadao/types";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { InlineProduction } from "@/ui/features/settlement/production/inline-production";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useTileAt } from "@/hooks/helpers/use-tile-at";
import { isVillageLikeStructureCategory, normalizeStructureCategory } from "@/lib/structure-type-utils";
import { formatTilePanelTitle } from "./tile-panel-title";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY, HUD_BODY_MUTED, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { HudButton, HudIconButton, HudNotice, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import {
  configManager,
  divideByPrecision,
  getConsumedBy,
  getBuildingCosts,
  getBalance,
  hasTileOccupier,
  isTileOccupierArmy,
  isTileOccupierChest,
  isTileOccupierReservedHyperstructure,
  isTileOccupierStructure,
  structureMapPosition,
  resolveUseSimpleCost,
} from "@bibliothecadao/eternum";
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import { useGame } from "@/hooks/context/game-context";
import { useQuery } from "@/hooks/helpers/use-query";
import { useNativeRevision, useNativeRow } from "@/hooks/helpers/use-native-facts";
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
import { memo, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { SelectedWorldmapEntity } from "@/ui/features/world/components/actions/selected-worldmap-entity";
import { RealmUpgradeCompact } from "@/ui/modules/entity-details/realm/realm-details";
import { resolveRealmHasAvailableBuildingTile } from "@/ui/features/settlement/construction/realm-build-actions";
import { requireActiveGameClient } from "@/sync/active-game-client";

import { BOTTOM_PANEL_HEIGHT, MINIMAP_SIZE } from "./constants";
import { HexMinimap, readMinimapTiles, type MinimapTile } from "./hex-minimap";
import { presentedMineKind } from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore } from "@bibliothecadao/eternum/game-client";

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
  height?: number | string;
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
    <header className="flex items-center justify-between gap-2 border-b border-hud-divider px-2 py-1 lg:px-3 lg:py-1.5">
      <p className="min-w-0 flex-1 truncate text-hud-label uppercase tracking-[0.35em] text-hud-muted">{title}</p>
      {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
    </header>
    <div className="flex-1 min-h-0 overflow-hidden px-1.5 py-1 lg:px-2.5 lg:py-2">{children}</div>
  </section>
);

const LocalTilePanel = () => {
  const { setup } = useGame();
  const ordersAllowed = useUIStore(canIssueOrders);
  const selectedBuildingHex = useUIStore((state) => state.selectedBuildingHex);
  const setSelectedBuildingHex = useUIStore((state) => state.setSelectedBuildingHex);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const playerStructures = useFactView(playerStructuresView);
  const requestedSimpleCost = useUIStore((state) => state.useSimpleCost);
  const setTooltip = useTooltipStore((state) => state.setTooltip);
  const setPreviewBuilding = useUIStore((state) => state.setPreviewBuilding);
  const previewBuilding = useUIStore((state) => state.previewBuilding);
  const currentDefaultTick = useCurrentDefaultTick();
  const mode = useGameModeConfig();
  const useSimpleCost = resolveUseSimpleCost(configManager.buildingCostMode, requestedSimpleCost);

  const liveStructure = useNativeRow("Structure", {
    game_id: configManager.getActiveGameId(),
    entity_id: structureEntityId,
  });
  useNativeRevision([
    "ResourceBalance",
    "ResourceProduction",
    "ResourceWeight",
    "StructureBuildings",
    "Building",
    "RealmKnowledge",
  ]);
  const selectedStructure = useMemo(() => {
    const base = liveStructure?.base;
    if (!base) return null;
    return {
      structureId: safeInteger(liveStructure.entity_id),
      category: normalizeStructureCategory(base.category),
    };
  }, [liveStructure]);

  useEffect(() => {
    if (!selectedStructure) return;
    if (!selectedBuildingHex || selectedBuildingHex.structureId !== selectedStructure.structureId) {
      setSelectedBuildingHex({
        structureId: selectedStructure.structureId,
        innerCol: BUILDINGS_CENTER[0],
        innerRow: BUILDINGS_CENTER[1],
      });
    }
  }, [selectedBuildingHex, selectedStructure, setSelectedBuildingHex]);

  const building = useNativeRow(
    "Building",
    selectedBuildingHex && selectedStructure && selectedBuildingHex.structureId === selectedStructure.structureId
      ? {
          game_id: configManager.getActiveGameId(),
          structure_id: selectedStructure.structureId,
          inner_col: selectedBuildingHex.innerCol,
          inner_row: selectedBuildingHex.innerRow,
        }
      : undefined,
  );

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
      if (selectedStructureCategory === StructureType.Mine)
        return getMinePresentation(presentedMineKind(liveStructure!)!).name;
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

  // Undefined when the recipe is unknown here: shown as "—", never as a free cost.
  const ongoingCost = useMemo<ResourceAmountEntry[] | undefined>(() => {
    if (producedResource === undefined) return [];
    const costs = configManager.getRecipeInputs(producedResource, useSimpleCost);
    return costs === undefined ? undefined : normalizeResourceEntries(costs);
  }, [producedResource, useSimpleCost]);

  const consumedBy = useMemo(() => {
    if (producedResource === undefined) return [];
    return getConsumedBy(producedResource);
  }, [producedResource]);

  const populationConfig = useMemo(() => {
    if (!hasBuilding || buildingCategory === null) return null;
    return configManager.getBuildingCategoryConfig(buildingCategory as BuildingType);
  }, [buildingCategory, hasBuilding]);

  const populationCost = populationConfig?.population_cost ?? 0;
  const populationCapacity = populationConfig?.capacity_grant ?? 0;
  const isPaused = !!building?.paused;
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);

  useEffect(() => {
    setShowDestroyConfirm(false);
  }, [selectedBuildingHex?.structureId, selectedBuildingHex?.innerCol, selectedBuildingHex?.innerRow]);

  const nextBuildCost =
    hasBuilding && buildingCategory !== null
      ? getBuildingCosts(structureEntityId, setup.store, buildingCategory as BuildingType, useSimpleCost)
      : undefined;
  const buildCost = normalizeResourceEntries(nextBuildCost ?? []);

  const canManageBuilding =
    ordersAllowed && playerStructures.some((structure) => structure.entityId === structureEntityId);

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
  }, [selectedBuildingHex?.structureId, selectedBuildingHex?.innerCol, selectedBuildingHex?.innerRow]);

  const canAddProduction =
    producedResource !== undefined &&
    configManager.canRefillProduction(producedResource) &&
    buildingCategory !== BuildingType.ResourceFish &&
    buildingCategory !== BuildingType.ResourceWheat &&
    buildingCategory !== BuildingType.WorkersHut;

  const panelTitle = selectedBuildingHex
    ? `${buildingName} · (${selectedBuildingHex.innerCol}, ${selectedBuildingHex.innerRow})`
    : "No Tile Selected";

  const handleToggleProduction = async () => {
    if (!selectedBuildingHex || !canManageBuilding || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const { actions } = requireActiveGameClient();
      const slot = {
        structureId: structureEntityId,
        hex: { col: selectedBuildingHex.innerCol, row: selectedBuildingHex.innerRow },
      };
      if (isPaused) {
        await actions.resumeProduction(slot);
      } else {
        await actions.pauseProduction(slot);
      }
    } catch (error) {
      console.error("Failed to toggle production", error);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDestroy = async () => {
    if (!selectedBuildingHex || !canManageBuilding || isActionLoading) return;
    if (isCastleTile) return;
    if (!showDestroyConfirm) {
      setShowDestroyConfirm(true);
      return;
    }
    setIsActionLoading(true);
    try {
      await requireActiveGameClient().actions.destroyBuilding({
        structureId: structureEntityId,
        hex: { col: selectedBuildingHex.innerCol, row: selectedBuildingHex.innerRow },
      });
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
      <HudPanel title={panelTitle} bodyClassName="pt-0">
        <RealmUpgradeCompact />
      </HudPanel>
    );
  }

  if (!hasBuilding) {
    return (
      <HudPanel title={panelTitle}>
        <p className={HUD_BODY_MUTED}>
          {canManageBuilding
            ? "Open building plot. Choose a building in the plot picker."
            : "Open building plot. Select a completed building to inspect its production."}
        </p>
      </HudPanel>
    );
  }

  const populationChips: Array<{ key: string; label: string }> = [];
  if (populationCost !== 0) populationChips.push({ key: "cost", label: `Cost +${populationCost}` });
  if (populationCapacity !== 0) populationChips.push({ key: "cap", label: `Capacity +${populationCapacity}` });

  // Compact row helper used inside the consolidated building bubble.
  const SectionRow = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex items-center gap-2">
      <span className={cn(HUD_LABEL, "w-28 shrink-0 whitespace-nowrap")}>{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );

  // One chip style for every section (produces / consumes / population /
  // build cost). The variant just colors the value text — the wrapper is
  // always the same etched-bronze chip so the rows read as one design.
  const chipBase =
    "flex items-center gap-1 rounded border border-hud-divider bg-hud-well px-1.5 py-1 text-hud-label tabular-nums";
  const valueClassFor = (variant: "neutral" | "good" | "bad" | "warn") => {
    switch (variant) {
      case "good":
        return "text-hud-good";
      case "bad":
        return "text-hud-bad";
      case "warn":
        return "text-hud-warn";
      default:
        return "text-hud-ink";
    }
  };

  // "Build another" affordance — gated by owner + sufficient resources for
  // every cost entry + at least one open building tile inside the realm
  // radius. Computed inline (no hook) so it stays below the early returns
  // without breaking hook order rules. resolveRealmHasAvailableBuildingTile
  // is the same helper the Build modal uses; it reads from native store so it's
  // cheap to call once per render.
  const hasAvailableTile = (() => {
    if (!structureEntityId || !selectedStructure) return false;
    return resolveRealmHasAvailableBuildingTile({
      entityId: structureEntityId,
      realmPosition: liveStructure ? (structureMapPosition(setup.store, liveStructure) ?? undefined) : undefined,
    });
  })();

  const canBuildAnother = (() => {
    if (!canManageBuilding) return false;
    if (buildCost.length === 0) return false;
    if (!hasAvailableTile) return false;
    return buildCost.every((entry) => {
      const { balance } = getBalance(structureEntityId, entry.resource, currentDefaultTick, setup.store);
      return balance !== undefined && divideByPrecision(balance) >= entry.amount;
    });
  })();

  const buildBlockedReason = !canManageBuilding
    ? "Not your structure"
    : !hasAvailableTile
      ? "No empty tiles available — destroy a building to free a slot"
      : !canBuildAnother
        ? "Not enough resources to build another"
        : "";

  // The building's actions sit in the bubble's header, so the building and what can be done with it read as one panel.
  // A header cue must keep its clicks from collapsing the bubble.
  const buildingActions = canManageBuilding ? (
    <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
      {buildingCategory !== null &&
        (() => {
          const isPreviewing =
            previewBuilding?.type === buildingCategory && previewBuilding?.resource === producedResource;
          return (
            <HudIconButton
              icon="pickaxe"
              label={isPreviewing ? "Cancel build" : "Build another"}
              kind={isPreviewing || !canBuildAnother ? "secondary" : "primary"}
              size="sm"
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
              title={
                isPreviewing
                  ? "Cancel build — click again to place a new building"
                  : canBuildAnother
                    ? "Build another — pick an empty tile to place it"
                    : buildBlockedReason
              }
              aria-pressed={isPreviewing}
            />
          );
        })()}
      {buildingCategory !== BuildingType.WorkersHut &&
        configManager.isCommandEnabled(isPaused ? "ResumeBuildingProduction" : "PauseBuildingProduction") && (
          <HudIconButton
            icon={isPaused ? "play" : "pause"}
            label={isPaused ? "Resume" : "Stop"}
            title={isPaused ? "Resume" : "Stop"}
            size="sm"
            onClick={handleToggleProduction}
            disabled={isActionLoading}
          />
        )}
      {showDestroyConfirm ? (
        <HudButton
          kind="secondary"
          size="sm"
          tone="bad"
          icon="trash"
          onClick={handleDestroy}
          disabled={isActionLoading}
          title="Confirm delete"
          aria-label="Confirm delete"
        >
          OK
        </HudButton>
      ) : (
        <HudIconButton
          icon="trash"
          label="Delete"
          title="Delete"
          size="sm"
          tone="bad"
          onClick={handleDestroy}
          disabled={isActionLoading}
        />
      )}
    </div>
  ) : undefined;

  return (
    <>
      {/* One bubble: the building's name and coordinates with its actions, then one line each for what it makes and
          uses, its population, what another costs and its production. */}
      <HudPanel title={panelTitle} icon={"production" as const} cue={buildingActions}>
        <div className="flex flex-col gap-1.5 divide-y divide-hud-divider [&>*:not(:first-child)]:pt-1.5">
          {isPaused && (
            <div className="flex items-center justify-between gap-2">
              <HudNotice tone="bad" line="Production paused" />
              {canManageBuilding && (
                <HudButton
                  kind="secondary"
                  size="sm"
                  icon="play"
                  disabled={isActionLoading}
                  onClick={handleToggleProduction}
                >
                  Resume
                </HudButton>
              )}
            </div>
          )}

          {producedResource && producedResourceName && (
            <SectionRow label="Produces / sec">
              <span className={chipBase} title={producedResourceName}>
                <span className={valueClassFor("good")}>+{producedPerTick}</span>
                <ResourceIcon withTooltip={false} resource={producedResource} size="xs" />
              </span>
              <button
                type="button"
                onMouseEnter={() =>
                  setTooltip({
                    position: "right",
                    content: (
                      <div className="space-y-2">
                        <p className="text-hud-label text-hud-muted">Consumed by</p>
                        {consumedBy.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {consumedBy.map((resourceId) => {
                              const name = findResourceById(Number(resourceId))?.trait ?? `Resource ${resourceId}`;
                              return (
                                <div
                                  key={resourceId}
                                  className="flex items-center gap-1 rounded border border-hud-divider bg-hud-well px-2 py-1"
                                >
                                  <ResourceIcon withTooltip={false} resource={Number(resourceId)} size="xs" />
                                  <span className="text-hud-label text-hud-ink">{name}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-hud-label text-hud-muted">Not consumed by other buildings.</p>
                        )}
                      </div>
                    ),
                  })
                }
                onMouseLeave={() => setTooltip(null)}
                aria-label="Show consumers"
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-hud-divider bg-hud-well text-hud-muted hover:text-hud-ink"
              >
                <SemanticIcon name="info" className="h-3.5 w-3.5" />
              </button>
            </SectionRow>
          )}

          {ongoingCost === undefined && (
            <SectionRow label="Consumes / sec">
              <span className="text-hud-muted">—</span>
            </SectionRow>
          )}
          {ongoingCost !== undefined && ongoingCost.length > 0 && (
            <SectionRow label="Consumes / sec">
              {ongoingCost.map((entry, index) => {
                const name = findResourceById(Number(entry.resource))?.trait ?? `Resource ${entry.resource}`;
                return (
                  <span key={`${entry.resource}-${index}`} className={chipBase} title={name}>
                    <span className={valueClassFor("bad")}>-{entry.amount}</span>
                    <ResourceIcon withTooltip={false} resource={entry.resource} size="xs" />
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

          {canManageBuilding && (
            <>
              {nextBuildCost === undefined && <SectionRow label="Build cost">—</SectionRow>}
              {buildCost.length > 0 && (
                <SectionRow label="Build cost">
                  {buildCost.map((entry, index) => {
                    const name = findResourceById(Number(entry.resource))?.trait ?? `Resource ${entry.resource}`;
                    const balanceInfo = getBalance(structureEntityId, entry.resource, currentDefaultTick, setup.store);
                    const balance = knownBalance(balanceInfo.balance);
                    const hasEnough = balance !== undefined && balance >= entry.amount;
                    return (
                      <span key={`build-cost-${entry.resource}-${index}`} className={chipBase} title={name}>
                        <ResourceIcon withTooltip={false} resource={entry.resource} size="xs" />
                        <span className={valueClassFor(hasEnough ? "neutral" : "bad")}>
                          {balance === undefined ? "—" : formatResourceAmount(balance)}
                        </span>
                        <span className={hasEnough ? "text-hud-muted" : "text-hud-bad"}>/ {entry.amount}</span>
                      </span>
                    );
                  })}
                </SectionRow>
              )}
            </>
          )}

          {canManageBuilding && canAddProduction && producedResource !== undefined && (
            <InlineProduction entityId={structureEntityId} resource={producedResource} />
          )}
        </div>
      </HudPanel>
    </>
  );
};

/**
 * What a minimap draws: the active map layer's tiles with their occupants, the hex to keep in view and the hex to
 * mark. In the realm view both stay on the active realm, so the player keeps a stable reference while zoomed into one
 * keep; on the world map they follow the camera and the selection.
 */
export const useMinimapReading = () => {
  const {
    setup: { store },
  } = useGame();
  useNativeRevision(["Structure"]);
  const [tiles, setTiles] = useState<MinimapTile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const navigationTarget = useUIStore((state) => state.navigationTarget);
  const cameraTargetHex = useUIStore((state) => state.cameraTargetHex);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const playerStructures = useFactView(playerStructuresView);

  const activeRealmHex = useMemo(() => {
    if (isMapView) return null;
    const active = playerStructures.find((entry) => entry.entityId === structureEntityId);
    if (!active?.structure) return null;
    const position = structureMapPosition(store, active.structure);
    if (!position) return;
    return { col: position.x, row: position.y };
  }, [isMapView, playerStructures, store, structureEntityId]);

  const mapLayer = useUIStore((state) => state.mapLayer);

  useEffect(() => {
    const projection = getActiveGameSyncRuntime()?.getWorldSpatialProjection();
    if (!projection) {
      console.error("[MinimapPanel] WorldSpatialProjection is unavailable for the active game");
      setIsLoading(false);
      return;
    }

    const readTiles = () => {
      setTiles(readMinimapTiles(projection, mapLayer));
      setIsLoading(false);
    };

    readTiles();
    const stopTiles = projection.subscribeTiles(readTiles);
    const stopStructures = projection.subscribeStructures(readTiles);
    return () => {
      stopTiles();
      stopStructures();
    };
  }, [mapLayer]);

  const drawn = useMemo(
    () => tiles.map((tile) => ({ ...tile, mineKind: mineKindOnTile(store, tile.occupier_id) })),
    [tiles, store],
  );

  return {
    tiles: drawn,
    isLoading,
    cameraTargetHex: activeRealmHex ?? cameraTargetHex,
    selectedHex: activeRealmHex ?? selectedHex,
    navigationTarget,
  };
};

export const MinimapPanel = ({ compact = false }: { compact?: boolean }) => {
  const { tiles, isLoading, cameraTargetHex, selectedHex, navigationTarget } = useMinimapReading();
  return (
    <PanelFrame title="Minimap" height={compact ? "clamp(180px, 35dvh, 320px)" : MINIMAP_SIZE}>
      <div className="relative flex h-full min-h-0 flex-col">
        <div className="relative flex-1 min-h-0 overflow-hidden rounded-b-xl rounded-t-none border border-hud-divider bg-gradient-to-br from-black/70 via-black/60 to-amber-900/20">
          <HexMinimap
            tiles={tiles}
            selectedHex={selectedHex}
            navigationTarget={navigationTarget}
            cameraTargetHex={cameraTargetHex}
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-hud-well">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-hud-line-strong border-t-gold" />
            </div>
          )}
        </div>
      </div>
    </PanelFrame>
  );
};

/** Local building selection never takes precedence over the world view. */
export const useSelectedTileDetails = (): ReactNode => {
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const selectedBuildingHex = useUIStore((state) => state.selectedBuildingHex);
  if (!isMapView && selectedBuildingHex) return <LocalTilePanel />;
  if (selectedHex) return <SelectedWorldmapEntity />;
  return null;
};

/** The mine kind a minimap tile's occupier is drawn as, when it is a mine. */
const mineKindOnTile = (store: NativeFactStore, occupierId: number | string | bigint | null | undefined) => {
  if (!occupierId) return undefined;
  const structure = store.get("Structure", {
    game_id: configManager.getActiveGameId(),
    entity_id: safeInteger(occupierId),
  });
  return structure ? presentedMineKind(structure) : undefined;
};
