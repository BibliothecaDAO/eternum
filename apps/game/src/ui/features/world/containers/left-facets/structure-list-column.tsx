import type { StructureWithMetadata } from "../top-header/structure-picker/chip";
import type { LeftListFilter } from "@/hooks/store/use-ui-store";
import { StructureRealmActions } from "../top-header/structure-picker/chip";
import { InfoBubble } from "../../components/entities/collapsible-bubble";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { StructureStatusRowView } from "@/ui/features/world/components/structure-status-row/structure-status-row";
import { useStructuresWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import {
  FilterChipsRow,
  useStructureCategoryFilter,
} from "@/ui/features/world/containers/left-facets/structure-category-filter";
import { Position, structureMapPosition } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useQuery } from "@/hooks/helpers/use-query";
import { type ID, StructureType } from "@bibliothecadao/types";
import { memo, useCallback, useState, type ReactNode } from "react";

export const StructureListColumn = memo(() => {
  const { setup } = useGame();
  const store = setup.store;
  const { isMapView } = useQuery();

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const playerStructures = useFactView(playerStructuresView);
  const structureNameVersion = useUIStore((state) => state.structureNameVersion);

  const goToStructure = useGoToStructure(setup);

  const allStructures = useStructuresWithMetadata({
    structures: playerStructures,
    store,
    nameUpdateVersion: structureNameVersion,
  });

  const { effectiveFilter, setFilter } = useStructureCategoryFilter(allStructures);

  const handleSelectStructure = useCallback(
    (entityId: ID) => {
      const target = playerStructures.find((structure) => structure.entityId === entityId);
      if (target?.structure) {
        const position = structureMapPosition(store, target.structure);
        if (!position) return;
        void goToStructure(entityId, Position.fromContract(position), isMapView);
      } else {
        setStructureEntityId(entityId);
      }
    },
    [goToStructure, isMapView, playerStructures, setStructureEntityId, store],
  );

  if (allStructures.length === 0) return null;

  return (
    <StructureListColumnView
      structures={allStructures}
      selectedId={structureEntityId}
      filterValue={effectiveFilter}
      onFilterChange={setFilter}
      onSelect={handleSelectStructure}
      renderActions={(id) => <StructureRealmActions structureEntityId={id} />}
    />
  );
});

StructureListColumn.displayName = "StructureListColumn";

export function StructureListColumnView({
  structures,
  selectedId,
  onSelect,
  filterValue,
  onFilterChange,
  renderActions,
}: {
  structures: StructureWithMetadata[];
  selectedId: number;
  onSelect: (id: number) => void;
  filterValue: LeftListFilter;
  onFilterChange: (filter: LeftListFilter) => void;
  renderActions: (id: number) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const counts = new Map<number, number>();
  for (const row of structures) counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
  const visible = structures.filter(
    (row) =>
      (filterValue === "all" || row.category === filterValue) &&
      row.displayName.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="holdings-panel" data-group="Structures">
      <InfoBubble title={<span data-notice>Your structures · {structures.length}</span>} collapsible={false}>
        <FilterChipsRow
          availableCategories={[...counts.keys()] as StructureType[]}
          filterValue={filterValue}
          onFilterChange={onFilterChange}
          counts={counts}
        />
        <input
          data-notice
          aria-label="Find a structure"
          placeholder="Find a structure…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="structure-scroll">
          {visible.map((row) => (
            <StructureStatusRowView
              key={row.entityId}
              structure={row}
              isActive={row.entityId === selectedId}
              onSelect={onSelect}
              variant="guided"
              realmActions={renderActions(row.entityId)}
            />
          ))}
          {visible.length === 0 && <p role="status">No matching structures</p>}
        </div>
      </InfoBubble>
    </section>
  );
}
