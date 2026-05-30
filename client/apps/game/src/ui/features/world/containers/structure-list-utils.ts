import type { LeftListFilter, LeftListSort } from "@/hooks/store/use-ui-store";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { type ID, StructureType } from "@bibliothecadao/types";
import Castle from "lucide-react/dist/esm/icons/castle";
import Crown from "lucide-react/dist/esm/icons/crown";
import type { LucideIcon } from "lucide-react";
import Pickaxe from "lucide-react/dist/esm/icons/pickaxe";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Tent from "lucide-react/dist/esm/icons/tent";

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

const compareNames = (a: StructureWithMetadata, b: StructureWithMetadata) => a.displayName.localeCompare(b.displayName);

/**
 * Sorts structures by the requested mode. "favorites" is the default —
 * starred entries first (in user-defined order), then alphabetical. The
 * active structure is NOT pinned to the top; selection is purely a
 * highlight so positions stay stable when the player clicks.
 */
export const sortStructures = (
  structures: StructureWithMetadata[],
  sort: LeftListSort,
  _activeEntityId: ID,
  favoriteOrder?: ReadonlyMap<ID, number>,
): StructureWithMetadata[] => {
  void _activeEntityId;
  const order = favoriteOrder ?? new Map<ID, number>();

  return structures.toSorted((a, b) => {
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

    return compareNames(a, b);
  });
};

/** Category filter chips, ordered. "All" is intentionally excluded — the
 *  player always sees exactly one category. The rail derives which chips to
 *  render from what they actually own; categories with zero structures don't
 *  get a chip. Each option carries an icon so the filter bar is a row of
 *  glyphs and the label only appears as the hover tooltip. */
export const CATEGORY_FILTER_OPTIONS: Array<{
  value: StructureType;
  label: string;
  icon: LucideIcon;
}> = [
  { value: StructureType.Realm, label: "Realms", icon: Crown },
  { value: StructureType.Village, label: "Villages", icon: Castle },
  { value: StructureType.Camp, label: "Camps", icon: Tent },
  { value: StructureType.FragmentMine, label: "Mines", icon: Pickaxe },
  { value: StructureType.Hyperstructure, label: "Hyperstructures", icon: Sparkles },
];

const SORT_OPTIONS: Array<{ value: LeftListSort; label: string }> = [
  { value: "favorites", label: "Favorites" },
  { value: "level", label: "Level" },
  { value: "population", label: "Population" },
  { value: "name", label: "Name" },
];
