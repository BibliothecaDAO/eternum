import { useGame } from "@/hooks/context/game-context";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import {
  FilterChipsRow,
  useStructureCategoryFilter,
} from "@/ui/features/world/containers/left-facets/structure-category-filter";
import { filterStructures, sortStructures } from "@/ui/features/world/containers/structure-list-utils";
import { useFavoriteStructures } from "@/ui/features/world/containers/top-header/favorites";
import {
  type StructureWithMetadata,
  useStructuresWithMetadata,
} from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import { Position, structureMapPosition } from "@bibliothecadao/eternum";
import type { ID } from "@bibliothecadao/types";
import { useCallback, useMemo } from "react";

/**
 * The player's structures in the chosen category (favorites first, then by name), the selected one, and the one way
 * to select a structure: the camera goes to it and its card opens.
 */
export const useRealmList = () => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const playerStructures = useFactView(playerStructuresView);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const structureNameVersion = useUIStore((state) => state.structureNameVersion);
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const setSelectedHex = useUIStore((state) => state.setSelectedHex);
  const goToStructure = useGoToStructure(setup);
  const { favorites } = useFavoriteStructures();

  const all = useStructuresWithMetadata({
    structures: playerStructures,
    store: setup.store,
    nameUpdateVersion: structureNameVersion,
  });
  const filter = useStructureCategoryFilter(all);
  const realms = useMemo(() => {
    const favoriteOrder = new Map(favorites.map((id, index) => [id, index] as const));
    return sortStructures(filterStructures(all, filter.effectiveFilter), "favorites", structureEntityId, favoriteOrder);
  }, [all, filter.effectiveFilter, favorites, structureEntityId]);

  const select = useCallback(
    (entityId: ID) => {
      const target = playerStructures.find((structure) => structure.entityId === entityId);
      const position = target?.structure ? structureMapPosition(setup.store, target.structure) : null;
      if (!position) {
        setStructureEntityId(entityId);
        return;
      }
      setSelectedHex({ col: position.x, row: position.y });
      void goToStructure(entityId, Position.fromContract(position), isMapView);
    },
    [goToStructure, isMapView, playerStructures, setSelectedHex, setStructureEntityId, setup.store],
  );

  const selected = all.find((structure) => structure.entityId === structureEntityId) ?? null;
  return { realms, selected, select, filter };
};

/** A structure's state in a few words, read off its guards: what a row says beside the name. */
const rowStatus = (structure: StructureWithMetadata): { word: string; tone: "ok" | "warn" | "danger" } | null => {
  const max = structure.structure.base.troop_max_guard_count;
  if (max <= 0 || structure.guardCount === undefined) return null;
  if (structure.guardCount === 0) return { word: "No guards", tone: "danger" };
  if (structure.guardCount < max) return { word: `Guards ${structure.guardCount}/${max}`, tone: "warn" };
  return { word: "Guarded", tone: "ok" };
};

const TONE_DOT = { ok: "bg-emerald-400", warn: "bg-amber-400", danger: "bg-rose-500" } as const;
const TONE_TEXT = { ok: "text-kit-muted", warn: "text-amber-300", danger: "text-rose-300" } as const;

/** The player's structures as one row each: a status dot, the name, and its state; the selected row is lit. */
export const RealmRows = ({ list }: { list: ReturnType<typeof useRealmList> }) => {
  const { realms, selected, select, filter } = list;
  return (
    <div className="flex flex-col gap-1">
      {filter.availableCategories.length > 1 && (
        <FilterChipsRow
          availableCategories={filter.availableCategories}
          filterValue={filter.effectiveFilter}
          onFilterChange={filter.setFilter}
        />
      )}
      {realms.map((realm) => {
        const status = rowStatus(realm);
        const isSelected = realm.entityId === selected?.entityId;
        return (
          <button
            key={realm.entityId}
            type="button"
            aria-pressed={isSelected}
            onClick={() => select(realm.entityId)}
            className={cn(
              "flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 text-left transition",
              isSelected ? "border-gold/60 bg-gold/10" : "border-transparent hover:border-gold/30",
            )}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn("h-2.5 w-2.5 shrink-0 rounded-full", status ? TONE_DOT[status.tone] : "bg-kit-muted")}
              />
              <span className="truncate text-base font-semibold text-kit-cream">{realm.displayName}</span>
            </span>
            {status && <span className={cn("shrink-0 text-sm", TONE_TEXT[status.tone])}>{status.word}</span>}
          </button>
        );
      })}
    </div>
  );
};
