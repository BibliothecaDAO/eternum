import type { LeftListFilter, LeftListSort } from "@/hooks/store/use-ui-store";
import { resolveStatusTone } from "@/ui/features/world/components/structure-status-row/structure-status-row";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { type ID, StructureType } from "@bibliothecadao/types";

/**
 * Returns structures matching `filter`. `"all"` keeps everything (only used
 * when the player owns nothing in the currently-selected category and the
 * rail falls back to "show what you have"); otherwise we keep entries whose
 * `category` matches the requested StructureType.
 */
export const filterStructures = (
  structures: StructureWithMetadata[],
  filter: LeftListFilter,
): StructureWithMetadata[] => {
  if (filter === "all") return structures;
  return structures.filter((structure) => structure.category === filter);
};

const STATUS_PRIORITY: Record<"red" | "amber" | "green", number> = {
  red: 0,
  amber: 1,
  green: 2,
};

const compareNames = (a: StructureWithMetadata, b: StructureWithMetadata) =>
  a.displayName.localeCompare(b.displayName);

/**
 * Sorts structures by the requested mode. "smart" surfaces what needs the
 * player's attention first (red star → amber star → green / none), then
 * favorites, then alphabetical — the default that drives the rail and every
 * modal sidebar.
 */
export const sortStructures = (
  structures: StructureWithMetadata[],
  sort: LeftListSort,
  activeEntityId: ID,
  favoriteOrder?: ReadonlyMap<ID, number>,
): StructureWithMetadata[] => {
  const order = favoriteOrder ?? new Map<ID, number>();

  return structures.toSorted((a, b) => {
    // Active structure always at the top — consistent across all surfaces.
    if (a.entityId === activeEntityId) return -1;
    if (b.entityId === activeEntityId) return 1;

    if (sort === "favorites") {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      const aOrder = order.get(a.entityId) ?? Number.POSITIVE_INFINITY;
      const bOrder = order.get(b.entityId) ?? Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return compareNames(a, b);
    }

    if (sort === "level") {
      const diff = (b.realmLevel ?? 0) - (a.realmLevel ?? 0);
      if (diff !== 0) return diff;
      return compareNames(a, b);
    }

    if (sort === "population") {
      const aPct = a.populationCapacity > 0 ? a.population / a.populationCapacity : 0;
      const bPct = b.populationCapacity > 0 ? b.population / b.populationCapacity : 0;
      if (aPct !== bPct) return bPct - aPct;
      return compareNames(a, b);
    }

    if (sort === "name") {
      return compareNames(a, b);
    }

    // "smart" — attention first, then favorites, then name.
    const aTone = resolveStatusTone(a)?.tone ?? "green";
    const bTone = resolveStatusTone(b)?.tone ?? "green";
    const aPriority = STATUS_PRIORITY[aTone];
    const bPriority = STATUS_PRIORITY[bTone];
    if (aPriority !== bPriority) return aPriority - bPriority;
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return compareNames(a, b);
  });
};

/** Category filter chips, ordered. "All" is intentionally excluded — the
 *  player always sees exactly one category. The rail derives which chips to
 *  render from what they actually own; categories with zero structures don't
 *  get a chip. */
export const CATEGORY_FILTER_OPTIONS: Array<{
  value: StructureType;
  label: string;
}> = [
  { value: StructureType.Realm, label: "Realms" },
  { value: StructureType.Village, label: "Villages" },
  { value: StructureType.FragmentMine, label: "Mines" },
  { value: StructureType.Hyperstructure, label: "Hyperstructures" },
];

export const SORT_OPTIONS: Array<{ value: LeftListSort; label: string }> = [
  { value: "smart", label: "Smart" },
  { value: "favorites", label: "Favorites" },
  { value: "level", label: "Level" },
  { value: "population", label: "Population" },
  { value: "name", label: "Name" },
];
