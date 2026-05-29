import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY_MUTED, HUD_CUE, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { StructureStatusRow } from "@/ui/features/world/components/structure-status-row/structure-status-row";
import { useFavoriteStructures } from "@/ui/features/world/containers/top-header/favorites";
import { useStructuresWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import {
  FilterChipsRow,
  useStructureCategoryFilter,
} from "@/ui/features/world/containers/left-facets/structure-category-filter";
import { filterStructures, sortStructures } from "@/ui/features/world/containers/structure-list-utils";
import { Position } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { type ID } from "@bibliothecadao/types";
import { memo, useCallback, useMemo } from "react";

/**
 * The left rail. A flat, filterable list of every owned structure with the
 * Empire-wide Suggested Actions panel pinned below. Default filter is
 * realms-only; ordering is always "favorites" (starred first, then alphabetical)
 * — there's no sort control, so the row stays compact.
 *
 * Active structure always renders at the top regardless of order, so the
 * player's current focus is consistently the first row. The list caps its
 * height to ~3 rows and scrolls for the rest.
 */
export const StructureListColumn = memo(() => {
  const { setup } = useDojo();
  const components = setup.components;
  const { isMapView } = useQuery();

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const structureNameVersion = useUIStore((state) => state.structureNameVersion);
  const setPendingRenameStructureEntityId = useUIStore((state) => state.setPendingRenameStructureEntityId);

  const goToStructure = useGoToStructure(setup);
  const { favorites, toggleFavorite } = useFavoriteStructures();

  const allStructures = useStructuresWithMetadata({
    structures: playerStructures,
    components,
    nameUpdateVersion: structureNameVersion,
  });

  const favoriteOrder = useMemo(
    () => new Map(favorites.map((id, index) => [id, index] as const)),
    [favorites],
  );

  // Shared category-filter (includes Camps); same store value as the modal
  // structure sidebar so the chosen category stays consistent.
  const { availableCategories, effectiveFilter, setFilter } = useStructureCategoryFilter(allStructures);

  const visibleStructures = useMemo(() => {
    const filtered = filterStructures(allStructures, effectiveFilter);
    // Ordering is fixed to "favorites" — favorites pinned, then alphabetical.
    return sortStructures(filtered, "favorites", structureEntityId, favoriteOrder);
  }, [allStructures, effectiveFilter, structureEntityId, favoriteOrder]);

  const handleSelectStructure = useCallback(
    (entityId: ID) => {
      if (entityId === structureEntityId) return;
      const target = playerStructures.find((structure) => structure.entityId === entityId);
      const coords = target?.structure?.base;
      if (coords && coords.coord_x !== undefined && coords.coord_y !== undefined) {
        const col = Number(coords.coord_x);
        const row = Number(coords.coord_y);
        if (Number.isFinite(col) && Number.isFinite(row)) {
          setSelectedHex({ col, row });
        }
        void goToStructure(entityId, new Position({ x: coords.coord_x, y: coords.coord_y }), isMapView);
      } else {
        setStructureEntityId(entityId);
      }
    },
    [goToStructure, isMapView, playerStructures, setSelectedHex, setStructureEntityId, structureEntityId],
  );

  const handleRequestRename = useCallback(
    (entityId: ID) => setPendingRenameStructureEntityId(entityId),
    [setPendingRenameStructureEntityId],
  );

  if (allStructures.length === 0) {
    return (
      <div className={cn("pointer-events-auto rounded-xl px-3 py-2", OVERLAY_SURFACE_BASE)}>
        <span className={HUD_LABEL}>No structures synced yet</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      {/* Header: single-line category filter on the left, owned count on the
          right. No label (the active chip is highlighted) and no sort control. */}
      <div className={cn(OVERLAY_SURFACE_BASE, "pointer-events-auto rounded-xl")}>
        <div className="flex items-center justify-between gap-2 border-b border-gold/15 px-3 py-2">
          <FilterChipsRow
            availableCategories={availableCategories}
            filterValue={effectiveFilter}
            onFilterChange={setFilter}
          />
          <span className={cn(HUD_CUE, "flex-shrink-0")}>{visibleStructures.length}</span>
        </div>
        <div className="px-3 pb-3 pt-1">
          {visibleStructures.length === 0 ? (
            <p className={cn(HUD_BODY_MUTED)}>No structures match this filter.</p>
          ) : (
            // Cap at ~3 rows; scroll for the rest.
            <div className="flex max-h-[clamp(180px,24vh,212px)] flex-col gap-2 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
              {visibleStructures.map((structure) => (
                <StructureStatusRow
                  key={structure.entityId}
                  structure={structure}
                  isActive={structure.entityId === structureEntityId}
                  onSelect={handleSelectStructure}
                  variant="full"
                  onToggleFavorite={toggleFavorite}
                  onRequestRename={handleRequestRename}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

StructureListColumn.displayName = "StructureListColumn";
