import { useUIStore, type LeftListFilter } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { CATEGORY_FILTER_OPTIONS } from "@/ui/features/world/containers/structure-list-utils";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { StructureType } from "@bibliothecadao/types";
import { memo, useMemo } from "react";

// Display order of the category chips. The rail/sidebar only renders chips for
// categories the player actually owns (and, when given, within the allowed
// universe), so this list is just the ordering.
const CATEGORY_ORDER: StructureType[] = [
  StructureType.Realm,
  StructureType.Village,
  StructureType.Camp,
  StructureType.FragmentMine,
  StructureType.Hyperstructure,
];

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

  const availableCategories = useMemo(() => {
    const present = new Set<StructureType>();
    for (const structure of structures) {
      present.add(structure.category as StructureType);
    }
    return CATEGORY_ORDER.filter((category) => present.has(category) && (!universe || universe.includes(category)));
  }, [structures, universe]);

  // Fall back to the first owned category when the saved filter has nothing
  // here (e.g. saved "Realm" but this surface only shows Camps).
  // Generic is explicit: availableCategories[0] is a non-nullable StructureType,
  // so `?? "all"` would otherwise collapse the inferred type to StructureType and
  // the shorthand return would drop "all" — making `=== "all"` look impossible
  // at every call site. Forcing <LeftListFilter> keeps the union intact.
  const effectiveFilter = useMemo<LeftListFilter>(() => {
    if (leftListFilter !== "all" && availableCategories.includes(leftListFilter as StructureType)) {
      return leftListFilter;
    }
    return availableCategories[0] ?? "all";
  }, [availableCategories, leftListFilter]);

  return { availableCategories, effectiveFilter, setFilter: setLeftListFilter };
};

interface FilterChipsRowProps {
  availableCategories: StructureType[];
  filterValue: LeftListFilter;
  onFilterChange: (filter: LeftListFilter) => void;
}

// Single-line category filter row. The active category is gold-highlighted so
// it doubles as the "which list am I looking at" label — no separate text.
export const FilterChipsRow = memo(({ availableCategories, filterValue, onFilterChange }: FilterChipsRowProps) => {
  return (
    <div className="flex items-center gap-1">
      {CATEGORY_FILTER_OPTIONS.filter((option) => availableCategories.includes(option.value)).map((option) => {
        const isActive = option.value === filterValue;
        const Icon = option.icon;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onFilterChange(option.value)}
            className={cn(
              "inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border transition",
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
});
FilterChipsRow.displayName = "FilterChipsRow";
