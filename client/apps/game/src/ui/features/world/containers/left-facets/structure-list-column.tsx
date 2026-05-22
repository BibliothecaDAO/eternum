import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore, type LeftListFilter, type LeftListSort } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY_MUTED, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { StructureStatusRow } from "@/ui/features/world/components/structure-status-row/structure-status-row";
import { useFavoriteStructures } from "@/ui/features/world/containers/top-header/favorites";
import { useStructuresWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import {
  CATEGORY_FILTER_OPTIONS,
  filterStructures,
  SORT_OPTIONS,
  sortStructures,
} from "@/ui/features/world/containers/structure-list-utils";
import { Position } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { type ID } from "@bibliothecadao/types";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmpireSuggestions } from "./empire-suggestions";

const FilterChips = memo(
  ({
    value,
    onChange,
  }: {
    value: LeftListFilter;
    onChange: (filter: LeftListFilter) => void;
  }) => (
    <div className={cn("pointer-events-auto flex flex-wrap items-center gap-1 rounded-xl p-1", OVERLAY_SURFACE_BASE)}>
      {CATEGORY_FILTER_OPTIONS.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition",
              isActive
                ? "border-gold/60 bg-gold/15 text-gold shadow-[0_0_8px_rgba(223,170,84,0.25)]"
                : "border-gold/15 bg-black/20 text-gold/65 hover:border-gold/40 hover:text-gold",
            )}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  ),
);
FilterChips.displayName = "FilterChips";

const SortMenu = memo(
  ({
    value,
    onChange,
  }: {
    value: LeftListSort;
    onChange: (sort: LeftListSort) => void;
  }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!open) return;
      const handlePointerDown = (event: MouseEvent | TouchEvent) => {
        if (!ref.current?.contains(event.target as Node)) setOpen(false);
      };
      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("touchstart", handlePointerDown);
      return () => {
        document.removeEventListener("mousedown", handlePointerDown);
        document.removeEventListener("touchstart", handlePointerDown);
      };
    }, [open]);

    const activeLabel = SORT_OPTIONS.find((option) => option.value === value)?.label ?? "Smart";

    return (
      <div ref={ref} className="pointer-events-auto relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/80 transition",
            open ? "border-gold/60 bg-gold/10 text-gold" : "border-gold/30 bg-black/30 hover:border-gold/50 hover:text-gold",
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="text-gold/55">Sort ·</span>
          <span>{activeLabel}</span>
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div
            className={cn(
              "absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-md text-left",
              OVERLAY_SURFACE_BASE,
            )}
            role="listbox"
          >
            {SORT_OPTIONS.map((option) => {
              const isActive = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "block w-full px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition",
                    isActive ? "bg-gold/15 text-gold" : "text-gold/75 hover:bg-gold/10 hover:text-gold",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  },
);
SortMenu.displayName = "SortMenu";

/**
 * The left rail. A flat, filterable, sortable list of every owned structure
 * with the Empire-wide Suggested Actions panel pinned below. Default filter
 * is realms-only; sort defaults to "smart" (attention first, then favorites,
 * then alphabetical).
 *
 * Active structure always renders at the top regardless of sort, so the
 * player's current focus is consistently the first row.
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
  const leftListFilter = useUIStore((state) => state.leftListFilter);
  const setLeftListFilter = useUIStore((state) => state.setLeftListFilter);
  const leftListSort = useUIStore((state) => state.leftListSort);
  const setLeftListSort = useUIStore((state) => state.setLeftListSort);

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

  const visibleStructures = useMemo(() => {
    const filtered = filterStructures(allStructures, leftListFilter);
    return sortStructures(filtered, leftListSort, structureEntityId, favoriteOrder);
  }, [allStructures, leftListFilter, leftListSort, structureEntityId, favoriteOrder]);

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
    <div className="flex min-w-0 flex-col gap-2">
      <FilterChips value={leftListFilter} onChange={setLeftListFilter} />
      <div className="flex items-center justify-between gap-2 px-1">
        <span className={cn(HUD_LABEL, "text-gold/55")}>
          {visibleStructures.length} {visibleStructures.length === 1 ? "structure" : "structures"}
        </span>
        <SortMenu value={leftListSort} onChange={setLeftListSort} />
      </div>
      {visibleStructures.length === 0 ? (
        <p className={cn(HUD_BODY_MUTED, "px-1")}>No structures match this filter.</p>
      ) : (
        <div className="flex flex-col gap-2">
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
      <EmpireSuggestions />
    </div>
  );
});

StructureListColumn.displayName = "StructureListColumn";
