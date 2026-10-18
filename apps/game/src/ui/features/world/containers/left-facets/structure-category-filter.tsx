import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { useUIStore, type LeftListFilter } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { kindsHeld } from "@/ui/features/world/hud/holdings-model";
import { StructureType } from "@bibliothecadao/types";
import { memo, useMemo } from "react";

/** A kind of holding the player owns, as every holdings list names and paints it (holdings-model). */
type HeldKind = ReturnType<typeof kindsHeld>[number];

/**
 * Shared category-filter state for the structure list (left rail) and the modal
 * structure sidebar (Military/Build/Production). Drives off the same
 * `leftListFilter` store value so the chosen category is consistent everywhere.
 *
 * @param structures the structures available to this surface
 * @param universe   optional whitelist of categories this surface may show
 *                   (e.g. Build is Realm + Village only)
 */
export const useStructureCategoryFilter = (structures: StructureWithMetadata[], universe?: StructureType[]) => {
  const leftListFilter = useUIStore((state) => state.leftListFilter);
  const setLeftListFilter = useUIStore((state) => state.setLeftListFilter);

  const availableCategories = useMemo(
    () => kindsHeld(structures).filter(({ kind }) => !universe || universe.includes(kind)),
    [structures, universe],
  );

  // Fall back to the first owned category when the saved filter has nothing
  // here (e.g. saved "Realm" but this surface only shows Camps).
  // Generic is explicit: availableCategories[0] is a non-nullable StructureType,
  // so `?? "all"` would otherwise collapse the inferred type to StructureType and
  // the shorthand return would drop "all" — making `=== "all"` look impossible
  // at every call site. Forcing <LeftListFilter> keeps the union intact.
  const effectiveFilter = useMemo<LeftListFilter>(() => {
    if (leftListFilter !== "all" && availableCategories.some(({ kind }) => kind === leftListFilter)) {
      return leftListFilter;
    }
    return availableCategories[0]?.kind ?? "all";
  }, [availableCategories, leftListFilter]);

  return { availableCategories, effectiveFilter, setFilter: setLeftListFilter };
};

interface FilterChipsRowProps {
  availableCategories: HeldKind[];
  filterValue: LeftListFilter;
  onFilterChange: (filter: LeftListFilter) => void;
}

// Single-line category filter row. The active category is gold-highlighted so
// it doubles as the "which list am I looking at" label — no separate text.
export const FilterChipsRow = memo(({ availableCategories, filterValue, onFilterChange }: FilterChipsRowProps) => {
  return (
    <div className="flex items-center gap-1">
      {availableCategories.map((option) => {
        const isActive = option.kind === filterValue;
        return (
          <button
            key={String(option.kind)}
            type="button"
            onClick={() => onFilterChange(option.kind)}
            className={cn(
              "inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border transition",
              isActive
                ? "border-hud-line-strong bg-hud-hover text-hud-ink shadow-[0_0_6px_rgba(223,170,84,0.22)]"
                : "border-hud-divider bg-hud-well text-hud-muted hover:border-hud-line-strong hover:text-hud-ink",
            )}
            aria-pressed={isActive}
            aria-label={option.plural}
            title={option.plural}
          >
            <SemanticIcon name={option.icon} className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
});
FilterChipsRow.displayName = "FilterChipsRow";
