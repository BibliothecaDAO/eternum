import { useGame } from "@/hooks/context/game-context";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { useQuery } from "@/hooks/helpers/use-query";
import { type LeftListFilter, useUIStore } from "@/hooks/store/use-ui-store";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { realmMeaning, structureMeaning } from "@/ui/design-system/domain-icon-meaning";
import type { IconMeaning } from "@/ui/design-system/icon";
import { Icon } from "@/ui/design-system/icon";
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
import { HUD_PANEL } from "./hud-panel";
import { Medallion } from "./medallion";

/** Every kind a player can hold, in the order the filters show them. */
const KINDS: Array<{ kind: StructureType; plural: string }> = [
  { kind: StructureType.Realm, plural: "Realms" },
  { kind: StructureType.Village, plural: "Villages" },
  { kind: StructureType.Camp, plural: "Camps" },
  { kind: StructureType.Mine, plural: "Mines" },
  { kind: StructureType.Rift, plural: "Rifts" },
  { kind: StructureType.BitcoinMine, plural: "Bitcoin mines" },
  { kind: StructureType.Hyperstructure, plural: "Hyperstructures" },
  { kind: StructureType.Bank, plural: "Banks" },
  { kind: StructureType.Ruin, plural: "Ruins" },
  { kind: StructureType.Stragglers, plural: "Stragglers" },
];
const KIND_RANK = new Map(KINDS.map(({ kind }, index) => [kind, index]));

/** A search box earns its place once the kind shown no longer fits on one screen. */
const SEARCH_FROM = 12;

const hasLevels = (structure: StructureWithMetadata) => structure.realmLevelLabel !== null;

/** A realm shows its age's painting; every other holding its kind's. */
const holdingIcon = (structure: StructureWithMetadata): IconMeaning =>
  structure.category === StructureType.Realm
    ? realmMeaning(structure.realmLevel)
    : structureMeaning(structure.category as StructureType);

/** Never every holding at once: the saved kind while one is held, else the first held (realms come first). */
const shownKind = (saved: LeftListFilter, held: ReadonlyArray<{ kind: StructureType }>): LeftListFilter =>
  saved !== "all" && held.some(({ kind }) => kind === saved) ? saved : (held[0]?.kind ?? "all");

/**
 * The player's holdings as the list shows them: the kinds held with their counts, the kind shown (`shownKind`) with
 * starred holdings first, the search, the selected holding, and selecting one, which flies the camera to it as the
 * classic list does.
 */
export const useHoldings = () => {
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

  const kinds = useMemo(() => {
    const counts = new Map<StructureType, number>();
    for (const structure of structures) {
      const kind = structure.category as StructureType;
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    return KINDS.filter(({ kind }) => counts.has(kind)).map((entry) => ({ ...entry, count: counts.get(entry.kind)! }));
  }, [structures]);

  const filter = shownKind(savedFilter, kinds);
  const searchable = (kinds.find(({ kind }) => kind === filter)?.count ?? structures.length) >= SEARCH_FROM;
  // A search belongs to the kind it was typed in, and only while that kind's field shows: one typed elsewhere, or
  // hidden once the kind falls under SEARCH_FROM, filters nothing.
  const query = searchable && typed.kind === filter ? typed.text : "";
  const setQuery = useCallback((text: string) => setTyped({ kind: filter, text }), [filter]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return structures
      .filter((structure) => filter === "all" || structure.category === filter)
      .filter((structure) => needle === "" || structure.displayName.toLowerCase().includes(needle))
      .toSorted(
        (a, b) =>
          (KIND_RANK.get(a.category as StructureType) ?? 99) - (KIND_RANK.get(b.category as StructureType) ?? 99) ||
          Number(b.isFavorite) - Number(a.isFavorite) ||
          b.realmLevel - a.realmLevel ||
          a.displayName.localeCompare(b.displayName),
      );
  }, [structures, filter, query]);

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
    <input
      type="search"
      aria-label="Find a holding"
      placeholder="Find a holding…"
      className="hud-search shrink-0"
      value={holdings.query}
      onChange={(event) => holdings.setQuery(event.target.value)}
      onKeyDown={(event) => event.stopPropagation()}
    />
  ) : null;

const NoHoldingsMatch = () => <p className="px-2 py-3 text-base text-kit-muted">No holding matches.</p>;

/**
 * The holdings panel: the kinds held as tabs (from the second kind), each its painting and count, the lit kind's
 * name, the search, and its holdings as rows; the selected row is kept in view.
 */
export const HoldingsList = ({ holdings }: { holdings: Holdings }) => {
  const { toggleFavorite } = useFavoriteStructures();
  const kind = holdings.kinds.find((entry) => entry.kind === holdings.filter);
  return (
    <section className={cn(HUD_PANEL, "flex min-h-[252px] flex-1 flex-col gap-2")}>
      {holdings.kinds.length > 1 && (
        <div role="tablist" aria-label="Holdings by kind" className="hud-tabs">
          {holdings.kinds.map((entry) => (
            <button
              key={entry.kind}
              type="button"
              role="tab"
              aria-selected={entry.kind === holdings.filter}
              aria-label={`${entry.plural}, ${entry.count}`}
              title={entry.plural}
              className="hud-tab"
              onClick={() => holdings.setFilter(entry.kind)}
            >
              <Icon name={structureMeaning(entry.kind)} size={22} />
              <span>{entry.count}</span>
            </button>
          ))}
        </div>
      )}
      {kind && (
        <h2 className="hud-panel-title">
          {kind.plural} · {kind.count}
        </h2>
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
        {holdings.visible.length === 0 && <NoHoldingsMatch />}
      </div>
    </section>
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
    const starWord = structure.isFavorite ? "Unpin from the top" : "Pin to the top";
    return (
      <div
        ref={row}
        className={cn(
          "flex h-11 w-full items-center gap-1.5 rounded-lg border px-1.5 transition-colors",
          selected ? "border-gold/60 bg-gold/10" : "border-transparent hover:border-gold/30",
        )}
      >
        <button
          type="button"
          aria-pressed={structure.isFavorite}
          aria-label={starWord}
          title={starWord}
          onClick={() => onStar(safeInteger(structure.entityId))}
          className={cn(
            "flex h-8 w-7 shrink-0 items-center justify-center transition-opacity",
            structure.isFavorite ? "opacity-100" : "opacity-35 hover:opacity-70",
          )}
        >
          <Icon name="star" size={18} />
        </button>
        <button
          type="button"
          aria-pressed={selected}
          onClick={() => onSelect(structure.entityId)}
          className="flex h-full min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <Medallion
            icon={holdingIcon(structure)}
            size="sm"
            tone={selected ? "lit" : "plain"}
            corner={hasLevels(structure) ? structure.realmLevel + 1 : undefined}
          />
          <span className="min-w-0 flex-1 truncate text-base font-semibold text-kit-cream">
            {structure.displayName}
          </span>
        </button>
        {structure.category === StructureType.Realm && (
          <StructureRealmActions structureEntityId={structure.entityId} className="shrink-0" />
        )}
      </div>
    );
  },
);
HoldingRow.displayName = "HoldingRow";
