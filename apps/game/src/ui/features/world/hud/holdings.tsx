import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGame } from "@/hooks/context/game-context";
import { realmLevelNumber } from "@/ui/lib/realm-level";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useQuery } from "@/hooks/helpers/use-query";
import { type LeftListFilter, useUIStore } from "@/hooks/store/use-ui-store";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { useFavoriteStructures } from "@/ui/features/world/containers/top-header/favorites";
import {
  StructureRealmActions,
  type StructureWithMetadata,
} from "@/ui/features/world/containers/top-header/structure-picker/chip";
import { useStructuresWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import { Position, structureMapPosition } from "@bibliothecadao/eternum";
import { safeInteger } from "@bibliothecadao/eternum/game-client";
import { type ID, StructureType } from "@bibliothecadao/types";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { holdingIcon, kindsHeld, listHoldings, needsSearch, shownKind } from "./holdings-model";
import { HudField, HudIconButton, HudPanel, HudRing, HudRow, HudTabs } from "@/ui/design-system/kit/hud-elements";

const hasLevels = (structure: StructureWithMetadata) => structure.realmLevelLabel !== null;

/**
 * The player's holdings as the list shows them: the kinds held with their counts, the kind shown (`shownKind`) with
 * starred holdings first, the search, the selected holding, and selecting one, which flies the camera to it as the
 * classic list does.
 */
export const useHoldings = () => {
  const mode = useGameModeConfig();
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const selectedId = useUIStore((state) => state.structureEntityId);
  const setStructureEntityId = useUIStore((state) => state.setStructureEntityId);
  const savedFilter = useUIStore((state) => state.leftListFilter);
  const setFilter = useUIStore((state) => state.setLeftListFilter);
  const nameVersion = useUIStore((state) => state.structureNameVersion);
  const playerStructures = useFactView(playerStructuresView);
  const goToStructure = useGoToStructure(setup);
  const [typed, setTyped] = useState<{ kind: LeftListFilter; text: string }>({ kind: "all", text: "" });

  const structures = useStructuresWithMetadata({
    structures: playerStructures,
    store: setup.store,
    nameUpdateVersion: nameVersion,
  });

  const kinds = useMemo(() => kindsHeld(structures, mode.id), [structures, mode.id]);

  const filter = shownKind(savedFilter, kinds);
  const searchable = needsSearch(kinds, filter, structures.length);
  // A search belongs to the kind it was typed in, and only while that kind's field shows: one typed elsewhere, or
  // hidden once the kind falls under SEARCH_FROM, filters nothing.
  const query = searchable && typed.kind === filter ? typed.text : "";
  const setQuery = useCallback((text: string) => setTyped({ kind: filter, text }), [filter]);

  const visible = useMemo(() => listHoldings(structures, filter, query), [structures, filter, query]);

  const select = useCallback(
    (entityId: ID) => {
      const target = playerStructures.find((structure) => structure.entityId === entityId);
      const position = target?.structure ? structureMapPosition(setup.store, target.structure) : null;
      if (position) void goToStructure(entityId, Position.fromContract(position), isMapView);
      else setStructureEntityId(entityId);
    },
    [goToStructure, isMapView, playerStructures, setStructureEntityId, setup.store],
  );

  return {
    total: structures.length,
    kinds,
    filter,
    setFilter,
    query,
    setQuery,
    searchable,
    visible,
    selectedId,
    selected: structures.find((structure) => structure.entityId === selectedId) ?? null,
    select,
  };
};

type Holdings = ReturnType<typeof useHoldings>;

const HoldingSearch = ({ holdings }: { holdings: Holdings }) =>
  holdings.searchable ? (
    <HudField
      type="search"
      aria-label="Find a holding"
      placeholder="Find a holding…"
      value={holdings.query}
      onChange={holdings.setQuery}
      onKeyDown={(event) => event.stopPropagation()}
    />
  ) : null;

/** Why the list is empty: nothing matches what was searched, or nothing is held. */
const EmptyHoldings = ({ searched }: { searched: boolean }) => (
  <p className="px-2 py-3 text-hud-body text-hud-muted">{searched ? "No holding matches." : "You hold nothing."}</p>
);

/**
 * The holdings panel: the kinds held as tabs (from the second kind), each its painting and count, the lit kind's
 * name, the search, and its holdings as rows; the selected row is kept in view.
 */
export const HoldingsList = ({ holdings }: { holdings: Holdings }) => {
  const { toggleFavorite } = useFavoriteStructures();
  const kind = holdings.kinds.find((entry) => entry.kind === holdings.filter);
  return (
    <HudPanel
      title={kind ? `${kind.plural} · ${kind.count}` : "Holdings"}
      className="flex max-h-hud-list flex-col"
      bodyClassName="flex min-h-0 flex-col gap-1.5"
    >
      {holdings.kinds.length > 1 && (
        <HudTabs
          tabs={holdings.kinds.map((entry) => ({
            key: entry.kind,
            icon: entry.icon,
            count: entry.count,
            ariaLabel: `${entry.plural}, ${entry.count}`,
          }))}
          value={holdings.filter}
          onChange={holdings.setFilter}
        />
      )}
      <HoldingSearch holdings={holdings} />
      <div role="tabpanel" className="-mx-1 min-h-0 overflow-y-auto overscroll-contain px-1 scrollbar-thin">
        {holdings.visible.map((structure) => (
          <HoldingRow
            key={structure.entityId}
            structure={structure}
            selected={structure.entityId === holdings.selectedId}
            onSelect={holdings.select}
            onStar={toggleFavorite}
          />
        ))}
        {holdings.visible.length === 0 && <EmptyHoldings searched={holdings.query.trim() !== ""} />}
      </div>
    </HudPanel>
  );
};

/**
 * One holding: its star (lit while pinned to the top), its age or kind with its level on the rim, its name, and for a
 * realm Provision or Level up with what it still needs a hover away. The selected row scrolls itself into view.
 */
const HoldingRow = memo(
  ({
    structure,
    selected,
    onSelect,
    onStar,
  }: {
    structure: StructureWithMetadata;
    selected: boolean;
    onSelect: (entityId: ID) => void;
    onStar: (entityId: number) => void;
  }) => {
    const row = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (selected) row.current?.scrollIntoView({ block: "nearest" });
    }, [selected]);
    return (
      <div ref={row}>
        <HudRow
          selected={selected}
          onClick={() => onSelect(structure.entityId)}
          lead={
            <HudIconButton
              icon="star"
              kind="quiet"
              size="sm"
              label={structure.isFavorite ? "Unpin from the top" : "Pin to the top"}
              aria-pressed={structure.isFavorite}
              onClick={() => onStar(safeInteger(structure.entityId))}
            />
          }
          title={
            <span className="flex min-w-0 items-center gap-2.5">
              <HudRing
                icon={holdingIcon(structure)}
                label={structure.displayName}
                corner={hasLevels(structure) ? realmLevelNumber(structure.realmLevel) : undefined}
              />
              <span className="min-w-0 truncate text-hud-strong">{structure.displayName}</span>
            </span>
          }
          trail={
            structure.category === StructureType.Realm ? (
              <StructureRealmActions structureEntityId={structure.entityId} />
            ) : null
          }
        />
      </div>
    );
  },
);
HoldingRow.displayName = "HoldingRow";
