import { readVisibleUnits } from "./sample.mjs";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { Button } from "@/ui/design-system/kit/button";
import { ViewSwitch } from "@/ui/design-system/kit/view-switch";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { HexMinimapView } from "@/ui/features/world/components/bottom-right-panel/hex-minimap";
import { StructureType } from "@bibliothecadao/types";
import { isStructureActionEnabled } from "@/ui/features/world/containers/left-facets/use-structure-actions";
import { StructureStatusRowView } from "@/ui/features/world/components/structure-status-row/structure-status-row";
import { FilterChipsRow } from "@/ui/features/world/containers/left-facets/structure-category-filter";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import { ProductionStatusBadge } from "@/ui/shared/components/production-status-badge";
import { actionChoices, currentStructure, fixtureCommands, makeStructures, resources, type Holding } from "./fixtures";
import { minimapTiles } from "./fixtures";
import "./hud-scene.css";

function NoticedUnit({ children }: { children: ReactNode }) {
  return <span data-notice>{children}</span>;
}

function Panel({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section data-group={title} className={className}>
      <InfoBubble title={<NoticedUnit>{title}</NoticedUnit>} collapsible={false}>
        {children}
      </InfoBubble>
    </section>
  );
}

function CurrentHoldings({
  holdings,
  selected,
  onSelect,
  onOpen,
}: {
  holdings: Holding[];
  selected: Holding;
  onSelect: (holding: Holding) => void;
  onOpen: (name: string) => void;
}) {
  const [filter, setFilter] = useState<number | "all">(StructureType.Realm);
  const [favorites, setFavorites] = useState<number[]>([]);
  const rows = holdings.map(currentStructure).filter((row) => filter === "all" || row.category === filter);
  return (
    <section data-group="Current structures" className={`current-holdings ${OVERLAY_SURFACE_BASE}`}>
      <div className="current-filter" data-notice>
        <FilterChipsRow
          availableCategories={[StructureType.Realm, StructureType.Village, StructureType.Camp]}
          filterValue={filter}
          onFilterChange={setFilter}
        />
        <span>{rows.length}</span>
      </div>
      <div className="current-structure-scroll">
        {rows.map((row) => (
          <div key={row.entityId} data-notice>
            <StructureStatusRowView
              structure={{ ...row, isFavorite: favorites.includes(row.entityId) }}
              isActive={selected.id === row.entityId}
              onSelect={(id) => onSelect(holdings.find((holding) => holding.id === id)!)}
              onToggleFavorite={(id) =>
                setFavorites((current) =>
                  current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
                )
              }
              onRequestRename={() => onOpen("Rename structure")}
              realmActions={
                <button onClick={() => onOpen("Level up to City")} aria-label={`Level up ${row.displayName}`}>
                  Level up
                </button>
              }
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function RealmPanel({
  selected,
  onOpen,
  current = false,
}: {
  selected: Holding;
  onOpen: (name: string) => void;
  current?: boolean;
}) {
  const [preset, setPreset] = useState("Smart");
  return (
    <Panel title={`${selected.name} · ${selected.kind}`} className="realm-panel">
      <div className="realm-controls">
        <label data-notice>
          Automation{" "}
          <select aria-label="Production automation" value={preset} onChange={(e) => setPreset(e.target.value)}>
            {["Smart", "Idle", "Custom"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button data-notice onClick={() => onOpen("Production detail")}>
          Production detail ↗
        </button>
      </div>
      <p className="muted realm-key" data-notice>
        Owned · ring: supply · badge: buildings
      </p>
      <div className="resource-grid simple">
        {resources.map((resource) => (
          <button
            data-notice
            className="resource-item"
            key={resource.name}
            aria-label={`${resource.name} production`}
            onClick={() => onOpen(`${resource.name} production`)}
          >
            <ProductionStatusBadge
              resourceLabel={resource.name}
              tooltipText={`${resource.name}: ${resource.held} owned`}
              isProducing={preset !== "Idle" && resource.producing}
              timeRemainingSeconds={resource.seconds}
              cornerTopLeft={String(resource.buildings)}
              cornerTopRight={current ? resource.held : undefined}
              size="xs"
              showTooltip={false}
            />
            <span>
              <b>{resource.name}</b>
              <strong>{resource.held}</strong>
              {(!resource.producing || preset === "Idle") && <small className="warning">Idle</small>}
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

const ownedStructureIds = new Set(["1", "2", "3"]);
const ownedExplorerIds = new Set(["501"]);
const minimapTarget = { col: 9, row: 6 };
function Minimap({ camera }: { camera: { hex: { col: number; row: number }; distance: number } }) {
  return (
    <section className="minimap" data-group="Minimap">
      <div className="minimap-heading" data-notice>
        Area map <span>North</span>
      </div>
      <div className="minimap-field" aria-label="Area map markers">
        <HexMinimapView
          tiles={minimapTiles}
          mapCenter={0}
          cameraDistance={camera.distance}
          ownedStructureIds={ownedStructureIds}
          ownedExplorerIds={ownedExplorerIds}
          selectedHex={minimapTarget}
          navigationTarget={null}
          cameraTargetHex={camera.hex}
        />
      </div>
      <p className="map-legend" data-notice>
        <span>You</span>
        <span>Ally</span>
        <span>Enemy</span>
      </p>
      <p className="map-values" data-notice>
        Realm level · army strength
      </p>
    </section>
  );
}

export function CurrentHudReference({
  count = 3,
  placement = "center",
  onReadout,
  camera,
}: {
  camera: { hex: { col: number; row: number }; distance: number };
  layout?: "rails" | "current";
  count?: number;
  density?: string;
  placement?: string;
  names?: readonly [string, string];
  onReadout?: (groups: { group: string; elements: string[] }[]) => void;
}) {
  const holdings = makeStructures(count);
  const commands = fixtureCommands(count);
  const [selected, setSelected] = useState(holdings[2]);
  const [view, setView] = useState("world");
  const [phoneTab, setPhoneTab] = useState("Map");
  const [modal, setModal] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  useLayoutEffect(() => {
    const update = () => {
      const groups = readVisibleUnits();
      onReadout?.(groups);
    };
    const observer = new MutationObserver(update);
    observer.observe(document.querySelector(".hud-scene")!, { childList: true, subtree: true, attributes: true });
    addEventListener("resize", update);
    document.querySelector(".hud-scene")!.addEventListener("scroll", update, true);
    update();
    return () => {
      observer.disconnect();
      removeEventListener("resize", update);
      document.querySelector(".hud-scene")?.removeEventListener("scroll", update, true);
    };
  }, [onReadout]);
  const open = (name: string) => setModal(name);
  return (
    <main
      className={`arena-hud hud-scene current phone-${phoneTab.toLowerCase()} placement-${placement}`}
      data-layout="current"
      data-count={count}
    >
      <header className="match-bar" data-group="Match">
        <button data-notice onClick={() => open("Standings")}>
          uxplay#1 · <b>5 VP</b>
        </button>
        <div className="view-toggle">
          <ViewSwitch
            label="Map view"
            views={[
              { id: "realm", word: "Local" },
              { id: "world", word: "World" },
            ]}
            lit={view}
            onChange={setView}
          />
        </div>
        <span data-notice>
          <b>41m 37s</b> left
        </span>
        <span data-notice>3m 04s</span>
        <button data-notice onClick={() => open("Level up to City")}>
          Attention
        </button>
      </header>
      <aside className="holdings-rail">
        <CurrentHoldings holdings={holdings} selected={selected} onSelect={setSelected} onOpen={open} />
        <RealmPanel selected={selected} onOpen={open} current />
      </aside>
      <Minimap camera={camera} />
      <nav className="action-dock" aria-label="Realm actions" data-group="Realm actions">
        {actionChoices
          .filter((action) => isStructureActionEnabled(action.id, (command) => commands.has(command)))
          .map((action) => (
            <button data-notice key={action.word} aria-label={action.word} onClick={() => open(action.word)}>
              <span className="action-circle">
                <img src={action.image} alt="" />
              </span>
              <span>{action.word}</span>
            </button>
          ))}
      </nav>
      <nav className="phone-tabs" aria-label="Phone panels" data-group="Phone navigation">
        {["Map", "Holdings"].map((tab) => (
          <button data-notice key={tab} aria-pressed={phoneTab === tab} onClick={() => setPhoneTab(tab)}>
            {tab}
          </button>
        ))}
      </nav>
      <button className="hud-chat" data-group="Chat" data-notice onClick={() => open("Chat")}>
        {"djiizus: ohayo"}
      </button>
      <button className="hud-log" data-group="Log" data-notice onClick={() => open("Event log")}>
        Log
      </button>
      {modal && (
        <Sheet
          label={modal}
          onClose={() => {
            setModal(null);
            setDetailOpen(false);
          }}
        >
          <h2>{modal}</h2>
          <p className="muted">{selected.name} · fixture preview</p>
          {/production/i.test(modal) ? (
            <>
              <p>Owned and production are separate readings.</p>
              <table>
                <thead>
                  <tr>
                    <th>Resource</th>
                    <th>Owned</th>
                    <th>Production</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>{r.held}</td>
                      <td>{r.rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => setDetailOpen(!detailOpen)} aria-expanded={detailOpen}>
                Input rules
              </button>
              {detailOpen && (
                <p>
                  Smart supplies each active building. Idle stops automatic supply. Custom uses each resource’s saved
                  rule.
                </p>
              )}
            </>
          ) : (
            <p>
              {modal === "Build a farm" || modal === "Build"
                ? "Choose an empty tile in the realm, then choose Farm. This preview stops before an order."
                : `${modal} opens here, keeping the selected realm in context. This picker previews placement; it sends no orders.`}
            </p>
          )}
          <Button role="outline" word="Back to map" onClick={() => setModal(null)} />
        </Sheet>
      )}
    </main>
  );
}
