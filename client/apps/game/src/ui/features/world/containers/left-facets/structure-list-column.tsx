import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore, type LeftListFilter, type LeftListSort } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY_MUTED, HUD_CUE, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
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
import { type ID, StructureType } from "@bibliothecadao/types";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// One-liner descriptions exposed via the option tooltip so the player can
// hover and learn what each mode does without leaving the menu.
const SORT_DESCRIPTIONS: Record<LeftListSort, string> = {
  favorites: "Favorites at the top, then alphabetical.",
  level: "Highest realm level first.",
  population: "Highest population % first.",
  name: "Alphabetical.",
};

// Compact filter chip row, designed to live inside the REALMS panel header.
// Used to be a standalone strip above the panel; merging it removed one row
// of vertical chrome.
const FilterChipsRow = memo(
  ({
    availableCategories,
    filterValue,
    onFilterChange,
  }: {
    availableCategories: StructureType[];
    filterValue: LeftListFilter;
    onFilterChange: (filter: LeftListFilter) => void;
  }) => {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {CATEGORY_FILTER_OPTIONS.filter((option) => availableCategories.includes(option.value)).map((option) => {
          const isActive = option.value === filterValue;
          const Icon = option.icon;
          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onFilterChange(option.value)}
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-md border transition",
                isActive
                  ? "border-gold/60 bg-gold/15 text-gold shadow-[0_0_6px_rgba(223,170,84,0.22)]"
                  : "border-gold/15 bg-black/20 text-gold/65 hover:border-gold/40 hover:text-gold",
              )}
              aria-pressed={isActive}
              aria-label={option.label}
              title={option.label}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>
    );
  },
);
FilterChipsRow.displayName = "FilterChipsRow";

// Portal the sort menu to document.body so it escapes the rail's
// `overflow-y-auto` clipping — previously the dropdown rendered below the
// fold and was unreachable.
const SortMenu = memo(
  ({
    value,
    onChange,
  }: {
    value: LeftListSort;
    onChange: (sort: LeftListSort) => void;
  }) => {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
      if (!open) return;
      const measure = () => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        // Anchor the right edge of the menu to the right edge of the button.
        setPosition({ top: rect.bottom + 6, left: rect.right - 160 });
      };
      measure();
      window.addEventListener("resize", measure);
      window.addEventListener("scroll", measure, true);
      return () => {
        window.removeEventListener("resize", measure);
        window.removeEventListener("scroll", measure, true);
      };
    }, [open]);

    useEffect(() => {
      if (!open) return;
      const handlePointerDown = (event: MouseEvent | TouchEvent) => {
        const target = event.target as Node | null;
        if (buttonRef.current?.contains(target)) return;
        if (menuRef.current?.contains(target)) return;
        setOpen(false);
      };
      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("touchstart", handlePointerDown);
      return () => {
        document.removeEventListener("mousedown", handlePointerDown);
        document.removeEventListener("touchstart", handlePointerDown);
      };
    }, [open]);

    const activeLabel = SORT_OPTIONS.find((option) => option.value === value)?.label ?? "Favorites";

    return (
      <>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/80 transition",
            open ? "border-gold/60 bg-gold/10 text-gold" : "border-gold/30 bg-black/30 hover:border-gold/50 hover:text-gold",
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
          title={SORT_DESCRIPTIONS[value]}
        >
          <span className="text-gold/55">Sort ·</span>
          <span>{activeLabel}</span>
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>
        {open &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={menuRef}
              className={cn(
                "pointer-events-auto fixed z-[110] w-40 overflow-hidden rounded-md text-left",
                OVERLAY_SURFACE_BASE,
              )}
              style={{ top: position.top, left: position.left }}
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
                    title={SORT_DESCRIPTIONS[option.value]}
                    className={cn(
                      "block w-full px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition",
                      isActive ? "bg-gold/15 text-gold" : "text-gold/75 hover:bg-gold/10 hover:text-gold",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>,
            document.body,
          )}
      </>
    );
  },
);
SortMenu.displayName = "SortMenu";

/**
 * The left rail. A flat, filterable, sortable list of every owned structure
 * with the Empire-wide Suggested Actions panel pinned below. Default filter
 * is realms-only; sort defaults to "favorites" (starred first, then
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

  // Which categories does the player actually own? We use this both to render
  // only the relevant chips and to auto-fall-back the filter when the player
  // has nothing in their last-saved category (e.g. lost their last realm).
  const availableCategories = useMemo(() => {
    const present = new Set<StructureType>();
    for (const structure of allStructures) {
      present.add(structure.category as StructureType);
    }
    return [
      StructureType.Realm,
      StructureType.Village,
      StructureType.FragmentMine,
      StructureType.Hyperstructure,
    ].filter((category) => present.has(category));
  }, [allStructures]);

  // If the saved filter no longer has any structures, fall back to the first
  // category the player owns — never an empty list under a chip they can't
  // see.
  const effectiveFilter: LeftListFilter = useMemo(() => {
    if (leftListFilter === "all") {
      return availableCategories[0] ?? "all";
    }
    if (availableCategories.includes(leftListFilter as StructureType)) {
      return leftListFilter;
    }
    return availableCategories[0] ?? "all";
  }, [availableCategories, leftListFilter]);

  const visibleStructures = useMemo(() => {
    const filtered = filterStructures(allStructures, effectiveFilter);
    return sortStructures(filtered, leftListSort, structureEntityId, favoriteOrder);
  }, [allStructures, effectiveFilter, leftListSort, structureEntityId, favoriteOrder]);

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

  const activeFilterOption = CATEGORY_FILTER_OPTIONS.find((option) => option.value === effectiveFilter);
  const filterLabel = activeFilterOption?.label ?? "Structures";

  return (
    <div className="flex min-w-0 flex-col">
      {/* Custom bubble: header carries the filter chips + sort menu so the
          control surface is fused into the panel it filters (no separate strip
          above the list). Body matches the InfoBubble rhythm used elsewhere. */}
      <div className={cn(OVERLAY_SURFACE_BASE, "pointer-events-auto rounded-xl")}>
        <div className="flex items-center justify-between gap-2 border-b border-gold/15 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <FilterChipsRow
              availableCategories={availableCategories}
              filterValue={effectiveFilter}
              onFilterChange={setLeftListFilter}
            />
            <span className={cn(HUD_LABEL, "truncate")}>{filterLabel}</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className={HUD_CUE}>{visibleStructures.length}</span>
            <SortMenu value={leftListSort} onChange={setLeftListSort} />
          </div>
        </div>
        <div className="px-3 pb-3 pt-1">
          {visibleStructures.length === 0 ? (
            <p className={cn(HUD_BODY_MUTED)}>No structures match this filter.</p>
          ) : (
            <div className="flex max-h-[clamp(220px,32vh,520px)] flex-col gap-2 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
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
