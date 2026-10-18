import { useGame } from "@/hooks/context/game-context";
import { realmLevelNumber } from "@/ui/lib/realm-level";
import type { LeftListFilter } from "@/hooks/store/use-ui-store";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { HudField, HudRing, HudRow, HudTabs } from "@/ui/design-system/kit/hud-elements";
import { useStructuresWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata";
import { holdingIcon, kindsHeld, listHoldings, needsSearch, shownKind } from "@/ui/features/world/hud/holdings-model";
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
  const searchable = needsSearch(kinds, kind, holdings.length);
  const rows = listHoldings(holdings, kind, searchable ? query : "");

  // The first chosen holding stays in view, as the holdings panel keeps its selected row.
  const chosenRow = useRef<HTMLSpanElement>(null);
  const firstChosenId = chosen[0];
  useEffect(() => {
    chosenRow.current?.scrollIntoView({ block: "nearest" });
  }, [firstChosenId, kind]);

  return (
    <section aria-label={title} className="flex min-h-0 flex-col gap-2">
      <h3 className="text-hud-label text-hud-muted">{title}</h3>
      {/* The kinds held as tabs, one even when only one is held: the lit tab names the kind its list shows. */}
      <HudTabs
        tabs={kinds.map((entry) => ({
          key: entry.kind,
          label: entry.kind === kind ? entry.plural : undefined,
          icon: entry.icon,
          count: entry.count,
          ariaLabel: `${entry.plural}, ${entry.count}`,
          title: entry.plural,
        }))}
        value={kind}
        onChange={setAsked}
      />
      {searchable && (
        <span className="shrink-0" onKeyDown={(event) => event.stopPropagation()}>
          <HudField
            type="search"
            icon="search"
            aria-label={`Find a holding to ${title.toLowerCase()}`}
            placeholder="Find a holding…"
            value={query}
            onChange={setQuery}
          />
        </span>
      )}
      <div role="tabpanel" className="flex min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain max-lg:max-h-56">
        {rows.map((holding) => {
          const id = Number(holding.entityId);
          return (
            <span key={id} ref={id === firstChosenId ? chosenRow : undefined}>
              <HudRow
                lead={
                  <HudRing
                    icon={holdingIcon(holding)}
                    label={holding.displayName}
                    corner={holding.realmLevelLabel !== null ? realmLevelNumber(holding.realmLevel) : undefined}
                  />
                }
                title={
                  <span className="truncate" title={holding.displayName}>
                    {holding.isFavorite && <span className="mr-1 text-hud-accent">★</span>}
                    {holding.displayName}
                  </span>
                }
                detail={note(id)}
                selected={chosen.includes(id)}
                onClick={() => onPick(id)}
              />
            </span>
          );
        })}
        {rows.length === 0 && <p className="px-2 py-3 text-hud-muted">No holding matches.</p>}
      </div>
    </section>
  );
};
