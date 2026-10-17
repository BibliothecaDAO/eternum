import { useGame } from "@/hooks/context/game-context";
import type { LeftListFilter } from "@/hooks/store/use-ui-store";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon } from "@/ui/design-system/icon";
import { useStructuresWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import { holdingIcon, kindsHeld, listHoldings, needsSearch, shownKind } from "@/ui/features/world/hud/holdings-model";
import { Medallion } from "@/ui/features/world/hud/medallion";
import { resolveStructureUiCapabilities } from "@/ui/lib/structure-capabilities";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

/**
 * One end of a transfer, listed as the HUD's holdings panel lists them (holdings-model): the kinds held as tabs with
 * their counts, one kind at a time, a search once the kind outgrows a screen, starred first. Only holdings with an
 * inventory, and never the other end. Each row carries what that end needs to know (`note`).
 */
export const HoldingPicker = ({
  title,
  chosen,
  otherEnd,
  onPick,
  note,
}: {
  title: string;
  chosen: number[];
  /** The holdings at the other end: not offered here. */
  otherEnd: number[];
  onPick: (id: number) => void;
  note: (id: number) => ReactNode;
}) => {
  const { setup } = useGame();
  const metadata = useStructuresWithMetadata({ structures: useFactView(playerStructuresView), store: setup.store });
  // The other end by value: its array is new on every render.
  const otherEndKey = otherEnd.join(",");
  const holdings = useMemo(() => {
    const others = new Set(otherEndKey.split(",").filter(Boolean).map(Number));
    return metadata.filter(
      (holding) =>
        resolveStructureUiCapabilities(holding.structure).canOpenTransferInventory &&
        !others.has(Number(holding.entityId)),
    );
  }, [metadata, otherEndKey]);
  const firstChosen = holdings.find((holding) => Number(holding.entityId) === chosen[0]);
  const [asked, setAsked] = useState<LeftListFilter>(firstChosen?.category ?? "all");
  const [query, setQuery] = useState("");
  const kinds = kindsHeld(holdings);
  const kind = shownKind(asked, kinds);
  const shown = kinds.find((entry) => entry.kind === kind);
  const searchable = needsSearch(kinds, kind, holdings.length);
  const rows = listHoldings(holdings, kind, searchable ? query : "");

  // The first chosen holding stays in view, as the holdings panel keeps its selected row.
  const chosenRow = useRef<HTMLButtonElement>(null);
  const firstChosenId = chosen[0];
  useEffect(() => {
    chosenRow.current?.scrollIntoView({ block: "nearest" });
  }, [firstChosenId, kind]);

  return (
    <section aria-label={title} className="flex min-h-0 flex-col gap-2">
      <h3 className="hud-panel-title flex justify-between">
        <span>{title}</span>
        {shown && (
          <span className="text-kit-muted">
            {shown.plural} · {shown.count}
          </span>
        )}
      </h3>
      {kinds.length > 1 && (
        <div role="tablist" aria-label={`${title} by kind`} className="hud-tabs">
          {kinds.map((entry) => (
            <button
              key={entry.kind}
              type="button"
              role="tab"
              aria-selected={entry.kind === kind}
              aria-label={`${entry.plural}, ${entry.count}`}
              title={entry.plural}
              className="hud-tab"
              onClick={() => setAsked(entry.kind)}
            >
              <Icon name={entry.icon} size={22} />
              <span>{entry.count}</span>
            </button>
          ))}
        </div>
      )}
      {searchable && (
        <input
          type="search"
          aria-label={`Find a holding to ${title.toLowerCase()}`}
          placeholder="Find a holding…"
          className="hud-search shrink-0"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
        />
      )}
      <div
        role="tabpanel"
        className="-mx-1 min-h-0 overflow-y-auto overscroll-contain px-1 scrollbar-thin max-lg:max-h-56"
      >
        {rows.map((holding) => {
          const id = Number(holding.entityId);
          const picked = chosen.includes(id);
          return (
            <button
              key={id}
              ref={id === firstChosenId ? chosenRow : undefined}
              type="button"
              value={id}
              aria-pressed={picked}
              onClick={() => onPick(id)}
              className={cn(
                "flex h-12 w-full items-center gap-2 rounded-lg border px-1.5 text-left transition-colors",
                picked ? "border-gold/60 bg-gold/10" : "border-transparent hover:border-gold/30",
              )}
            >
              <Medallion
                icon={holdingIcon(holding)}
                size="sm"
                tone={picked ? "lit" : "plain"}
                corner={holding.realmLevelLabel !== null ? holding.realmLevel + 1 : undefined}
              />
              {/* The name has the row's width, its note under it: a long name is not cut for "under a minute". */}
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-base font-semibold text-kit-cream" title={holding.displayName}>
                  {holding.isFavorite && <span className="mr-1 text-gold">★</span>}
                  {holding.displayName}
                </span>
                <span className="truncate text-sm text-kit-muted">{note(id)}</span>
              </span>
            </button>
          );
        })}
        {rows.length === 0 && <p className="px-2 py-3 text-base text-kit-muted">No holding matches.</p>}
      </div>
    </section>
  );
};
