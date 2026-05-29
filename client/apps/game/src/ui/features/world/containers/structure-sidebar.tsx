import { useUIStore } from "@/hooks/store/use-ui-store";
import { HUD_BODY_MUTED, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { StructureStatusRow } from "@/ui/features/world/components/structure-status-row/structure-status-row";
import { useFavoriteStructures } from "@/ui/features/world/containers/top-header/favorites";
import { useStructuresWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import {
  FilterChipsRow,
  useStructureCategoryFilter,
} from "@/ui/features/world/containers/left-facets/structure-category-filter";
import { sortStructures } from "@/ui/features/world/containers/structure-list-utils";
import { useDojo } from "@bibliothecadao/react";
import { type ID, StructureType } from "@bibliothecadao/types";
import { memo, useMemo } from "react";
import type { StructureWithMetadata } from "./top-header/structure-picker/chip";

interface StructureSidebarProps {
  selectedEntityId: ID;
  onSelectStructure: (entityId: ID) => void;
  /**
   * Per-row attention flag. Modal consumers wire this to surface conditions
   * the row should highlight (production stall, empty guard slot…).
   */
  attention?: (structure: StructureWithMetadata) => boolean;
  /**
   * Restrict the sidebar to a subset of categories. Defaults to realms only —
   * which is what every current modal wants.
   */
  filter?: StructureType[];
  /** Optional label shown above the list. */
  title?: string;
  /**
   * Which stats badges each row renders. `military` swaps pop/tiles for
   * guard armies + explorer armies, which is what the Military modal wants.
   */
  statsVariant?: "default" | "military";
  /**
   * Show a category-filter chip row (Realm / Camp / …) and let the player switch
   * categories — shares the rail's filter. `filter` then acts as the universe of
   * selectable categories. Default false: the modal shows the `filter` set as
   * one flat list with no chips.
   */
  enableCategoryFilter?: boolean;
}

/**
 * Shared realm switcher consumed by every centered modal that needs to swap
 * focus between owned structures. One look, one sort order, one set of
 * status star tones — so a player moving Build → Production → Military sees
 * the same list in the same place every time.
 */
export const StructureSidebar = memo(
  ({
    selectedEntityId,
    onSelectStructure,
    attention,
    filter,
    title = "Your realms",
    statsVariant,
    enableCategoryFilter = false,
  }: StructureSidebarProps) => {
    const {
      setup: { components },
    } = useDojo();
    const playerStructures = useUIStore((state) => state.playerStructures);
    const structureNameVersion = useUIStore((state) => state.structureNameVersion);
    const leftListSort = useUIStore((state) => state.leftListSort);
    const { favorites } = useFavoriteStructures();

    const allMetadata = useStructuresWithMetadata({
      structures: playerStructures,
      components,
      nameUpdateVersion: structureNameVersion,
    });

    // Shared with the left rail; when enabled, `filter` is the selectable
    // universe and the player picks one category via the chips.
    const { availableCategories, effectiveFilter, setFilter } = useStructureCategoryFilter(allMetadata, filter);

    const filtered = useMemo(() => {
      if (enableCategoryFilter) {
        if (effectiveFilter === "all") return allMetadata;
        return allMetadata.filter((structure) => structure.category === effectiveFilter);
      }
      if (!filter || filter.length === 0) return allMetadata;
      const set = new Set(filter);
      return allMetadata.filter((structure) => set.has(structure.category as StructureType));
    }, [allMetadata, filter, enableCategoryFilter, effectiveFilter]);

    const favoriteOrder = useMemo(
      () => new Map(favorites.map((id, index) => [id, index] as const)),
      [favorites],
    );

    const ordered = useMemo(
      () => sortStructures(filtered, leftListSort, selectedEntityId, favoriteOrder),
      [filtered, leftListSort, selectedEntityId, favoriteOrder],
    );

    if (ordered.length === 0) {
      return (
        <div className="flex h-full flex-col gap-2 px-3 py-3">
          <span className={HUD_LABEL}>{title}</span>
          <p className={HUD_BODY_MUTED}>No matching structures.</p>
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col gap-2 px-2 py-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className={HUD_LABEL}>{title}</span>
          {enableCategoryFilter && availableCategories.length > 1 && (
            <FilterChipsRow
              availableCategories={availableCategories}
              filterValue={effectiveFilter}
              onFilterChange={setFilter}
            />
          )}
        </div>
        <div className="flex flex-1 min-h-0 flex-col gap-1.5 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
          {ordered.map((structure) => (
            <StructureStatusRow
              key={structure.entityId}
              structure={structure}
              isActive={structure.entityId === selectedEntityId}
              onSelect={onSelectStructure}
              variant="compact"
              hasAttention={attention?.(structure) ?? false}
              statsVariant={statsVariant}
            />
          ))}
        </div>
      </div>
    );
  },
);

StructureSidebar.displayName = "StructureSidebar";

// Default filter for modals that don't pass one. Most flows are realm-only.
export const REALMS_ONLY_FILTER: StructureType[] = [StructureType.Realm];

// Construction includes villages because they can build too.
export const BUILDABLE_FILTER: StructureType[] = [StructureType.Realm, StructureType.Village];
