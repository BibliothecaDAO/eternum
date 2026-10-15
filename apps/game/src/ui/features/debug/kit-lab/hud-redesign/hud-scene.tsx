import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { commandArt, facets, minimapArt, resourceArt } from "./hud-art";
import { readVisibleUnits } from "./sample.mjs";
import { useEffect, useLayoutEffect, useState, useRef, type ReactNode } from "react";
import { Button } from "@/ui/design-system/kit/button";
import { ViewSwitch } from "@/ui/design-system/kit/view-switch";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { HexMinimapView } from "@/ui/features/world/components/bottom-right-panel/hex-minimap";
import { BiomeTypeToId, StructureType, TileOccupier } from "@bibliothecadao/types";
import { isStructureActionEnabled } from "@/ui/features/world/containers/left-facets/use-structure-actions";
import { StructureStatusRowView } from "@/ui/features/world/components/structure-status-row/structure-status-row";
import { FilterChipsRow } from "@/ui/features/world/containers/left-facets/structure-category-filter";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import { ProductionStatusBadge } from "@/ui/shared/components/production-status-badge";
import {
  actionChoices,
  currentStructure,
  fixtureCommands,
  makeStructures,
  resources,
  viewNames,
  type Holding,
} from "./fixtures";
import {
  createTerrainVerificationRequest,
  TERRAIN_SETTLEMENT_REGROWTH_SITES,
} from "@/three/terrain/verification/terrain-verification-fixtures";
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

function HoldingList({
  holdings,
  selected,
  onSelect,
  density,
}: {
  holdings: Holding[];
  selected: Holding;
  onSelect: (holding: Holding) => void;
  density: string;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("All");
  const [sort, setSort] = useState("Needs attention");
  const [openGroups, setOpenGroups] = useState(["Needs attention"]);
  const filtered = holdings.filter(
    (h) => (kind === "All" || h.kind === kind) && h.name.toLowerCase().includes(query.toLowerCase()),
  );
  const sorted = filtered.toSorted((a, b) =>
    sort === "Name" ? a.name.localeCompare(b.name) : Number(b.needs) - Number(a.needs) || a.id - b.id,
  );
  const groups =
    density === "grouped"
      ? ["Needs attention", "Running"].map((name) => ({
          name,
          rows: sorted.filter((h) => h.needs === (name === "Needs attention")),
        }))
      : [{ name: "", rows: sorted }];
  return (
    <Panel title={`Your structures · ${holdings.length}`} className="holdings-panel">
      <div className="list-filters">
        <div className="filter-line" aria-label="Structure filters">
          {["All", "Realm", "Village", "Camp"].map((value) => (
            <button data-notice key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>
              {value === "All" ? value : `${value}s`}
            </button>
          ))}
        </div>
        <div className="search-sort">
          <input
            data-notice
            aria-label="Find a structure"
            placeholder="Find a structure…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select data-notice aria-label="Sort structures" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option>Needs attention</option>
            <option>Name</option>
          </select>
        </div>
      </div>
      <div className="structure-scroll">
        {groups.map((group) => (
          <div key={group.name}>
            {group.name ? (
              <>
                <button
                  className="group-toggle"
                  data-notice
                  aria-expanded={openGroups.includes(group.name) || query.length > 0}
                  onClick={() =>
                    setOpenGroups(
                      openGroups.includes(group.name)
                        ? openGroups.filter((name) => name !== group.name)
                        : [...openGroups, group.name],
                    )
                  }
                >
                  {openGroups.includes(group.name) || query.length > 0 ? "▾" : "▸"} {group.name} · {group.rows.length}
                </button>
                {(openGroups.includes(group.name) || query.length > 0) && group.rows.map(row)}
              </>
            ) : (
              group.rows.map(row)
            )}
          </div>
        ))}
        {!filtered.length && <p role="status">No matching structures</p>}
      </div>
    </Panel>
  );
  function row(holding: Holding) {
    return (
      <button
        key={holding.id}
        data-notice
        className="holding-row"
        aria-label={`Select ${holding.name}`}
        aria-pressed={selected.id === holding.id}
        onClick={() => onSelect(holding)}
      >
        <span className={`holding-mark ${holding.needs ? "warn" : ""}`} aria-hidden>
          <KitIcon code={holding.kind === "Camp" ? "Cp" : "Cs"} size={24} />
        </span>
        <span className="holding-name">{holding.name}</span>
        <span className={holding.needs ? "warning" : "muted"}>
          {density === "rows" ? `${holding.guards} guards` : holding.needs ? "Unguarded" : `Level ${holding.level}`}
        </span>
      </button>
    );
  }
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
              icon={
                !current && resourceArt[resource.name] ? (
                  <img className="resource-painting" src={resourceArt[resource.name]} alt="" />
                ) : undefined
              }
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

/** Marker artwork can change without changing ownership, values or selection. */
function MapMarker({
  current,
  kind,
  owner,
  value,
  x,
  y,
  onClick,
}: {
  current: boolean;
  kind: "realm" | "army";
  owner: "you" | "ally" | "enemy";
  value: number;
  x: number;
  y: number;
  onClick: () => void;
}) {
  return (
    <button
      data-notice
      className={`map-marker ${owner}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-label={`${owner} ${kind}, ${kind === "realm" ? "level" : "strength"} ${value}`}
      onClick={onClick}
    >
      <img
        src={
          current
            ? kind === "realm"
              ? "/image-icons/construction.png"
              : "/image-icons/military.png"
            : facets(kind === "realm" ? "map-realm" : "map-army", 32)
        }
        alt=""
      />
      <b>{value}</b>
    </button>
  );
}
const ownedStructureIds = new Set(["1", "2", "3"]);
const ownedExplorerIds = new Set(["501"]);
const paintedMinimapArt = {
  armyMine: "/image-icons/military.png",
  armyEnemy: "/image-icons/military.png",
  realmMine: "/image-icons/construction.png",
  realmEnemy: "/image-icons/construction.png",
  villageMine: "/image-icons/construction.png",
  villageEnemy: "/image-icons/construction.png",
  hyperstructure: "/image-icons/construction.png",
  fragmentMine: "/image-icons/production.png",
  chest: "/image-icons/transfer.png",
};
const minimapTarget = { col: 9, row: 6 };
const terrainFixture = createTerrainVerificationRequest("settlement-regrowth");
const minimapTiles = terrainFixture.cells.map((cell) => {
  const siteIndex = TERRAIN_SETTLEMENT_REGROWTH_SITES.findIndex(
    (site) => site.col === cell.col && site.row === cell.row,
  );
  const armyId = cell.col === 7 && cell.row === 3 ? "501" : cell.col === 12 && cell.row === 2 ? "999" : null;
  return {
    col: cell.col,
    row: cell.row,
    biome: cell.biome ? BiomeTypeToId[cell.biome] : undefined,
    ...(siteIndex >= 0
      ? {
          occupier_id: String(siteIndex + 1),
          occupier_type: TileOccupier.RealmRegularLevel2,
          occupier_is_structure: true,
        }
      : armyId
        ? { occupier_id: armyId, occupier_type: TileOccupier.ExplorerKnightT1, occupier_is_structure: false }
        : {}),
  };
});
function Minimap({
  onOpen,
  camera,
  current,
}: {
  onOpen: (name: string) => void;
  camera: { hex: { col: number; row: number }; distance: number };
  current: boolean;
}) {
  const field = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<{ x: number; y: number }[]>([]);
  useEffect(() => {
    const host = field.current!;
    const svg = host.querySelector("svg")!;
    const update = () => {
      const rect = host.getBoundingClientRect();
      const marks = [
        svg.querySelector('image[data-entity-id="3"]'),
        svg.querySelector('image[data-entity-id="501"]'),
        svg.querySelector('image[data-entity-id="999"]'),
      ];
      setPositions(
        marks.map((mark) => {
          const r = mark?.getBoundingClientRect();
          return r
            ? {
                x: ((r.x + r.width / 2 - rect.x) / rect.width) * 100,
                y: ((r.y + r.height / 2 - rect.y) / rect.height) * 100,
              }
            : { x: -100, y: -100 };
        }),
      );
    };
    const mutations = new MutationObserver(update);
    mutations.observe(svg, { subtree: true, childList: true, attributes: true });
    const resize = new ResizeObserver(update);
    resize.observe(host);
    update();
    return () => {
      mutations.disconnect();
      resize.disconnect();
    };
  }, []);
  return (
    <section className="minimap" data-group="Minimap">
      <div className="minimap-heading" data-notice>
        Area map <span>North</span>
      </div>
      <div ref={field} className="minimap-field" aria-label="Area map markers">
        <HexMinimapView
          tiles={minimapTiles}
          mapCenter={0}
          cameraDistance={camera.distance}
          ownedStructureIds={ownedStructureIds}
          ownedExplorerIds={ownedExplorerIds}
          markerArt={current ? paintedMinimapArt : minimapArt}
          selectedHex={minimapTarget}
          navigationTarget={null}
          cameraTargetHex={camera.hex}
        />
        {positions.length === 3 && (
          <>
            <MapMarker
              current={current}
              kind="realm"
              owner="you"
              value={2}
              {...positions[0]}
              onClick={() => onOpen("Stolsli on the map")}
            />
            <MapMarker
              current={current}
              kind="army"
              owner="ally"
              value={80}
              {...positions[1]}
              onClick={() => onOpen("Allied army · strength 80")}
            />
            <MapMarker
              current={current}
              kind="army"
              owner="enemy"
              value={120}
              {...positions[2]}
              onClick={() => onOpen("Enemy army · strength 120")}
            />
          </>
        )}
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

export function HudScene({
  layout = "rails",
  count = 3,
  density = "rows",
  placement = "center",
  names = viewNames[0],
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
  const [selectedTile, setSelectedTile] = useState("Oakheart");
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
      className={`hud-scene ${layout} phone-${phoneTab.toLowerCase()} placement-${placement}`}
      data-layout={layout}
      data-count={count}
    >
      <header className="match-bar" data-group="Match">
        <button data-notice onClick={() => open("Standings")}>
          {layout === "rails" && <KitIcon code="Tp" size={18} />} uxplay#1 · <b>5 VP</b>
        </button>
        <div className="view-toggle">
          <ViewSwitch
            label="Map view"
            views={[
              { id: "realm", word: layout === "current" ? "Local" : names[0] },
              { id: "world", word: layout === "current" ? "World" : names[1] },
            ]}
            lit={view}
            onChange={setView}
          />
        </div>
        <span data-notice>
          <b>41m 37s</b> left
        </span>
        <span data-notice>3m 04s</span>
        {layout === "current" && (
          <button data-notice onClick={() => open("Level up to City")}>
            Attention
          </button>
        )}
      </header>
      {layout === "rails" && (
        <div className="guidance-rail">
          <Panel title={`${selected.name} can level up`} className="suggestion-panel">
            <div data-notice className="primary-suggestion">
              <Button role="primary" word="Level up to City" onClick={() => open("Level up to City")} />
            </div>
          </Panel>
          <Panel title="Events" className="events-panel">
            <button
              data-notice
              className="event-row"
              onClick={() => {
                setSelectedTile("Northern grassland");
                setView("world");
              }}
            >
              <KitIcon code="Ey" size={20} />
              <span>
                Scouts found grassland <span className="muted">· 1m ↗</span>
              </span>
            </button>
            <button data-notice className="event-row" onClick={() => open("Transfer arrived")}>
              <KitIcon code="Bt" size={20} />
              <span>
                Transfer reached Stolsli <span className="muted">· 3m ↗</span>
              </span>
            </button>
          </Panel>
          <Panel
            title={`${selectedTile === "Oakheart" ? selected.name : selectedTile} · (12, 8)`}
            className="tile-panel"
          >
            <p data-notice className="muted">
              <KitIcon code={selectedTile === "Oakheart" ? (selected.kind === "Camp" ? "Cp" : "Cs") : "Ey"} size={20} />
              Grassland · {selectedTile === "Oakheart" ? `Your ${selected.kind.toLowerCase()}` : "Unoccupied"}
            </p>
          </Panel>
        </div>
      )}
      <aside className="holdings-rail">
        {layout === "current" ? (
          <CurrentHoldings holdings={holdings} selected={selected} onSelect={setSelected} onOpen={open} />
        ) : (
          <HoldingList
            holdings={holdings}
            selected={selected}
            onSelect={(h) => {
              setSelected(h);
              setSelectedTile("Oakheart");
            }}
            density={density}
          />
        )}
        <RealmPanel selected={selected} onOpen={open} current={layout === "current"} />
      </aside>
      <Minimap onOpen={open} camera={camera} current={layout === "current"} />
      <nav className="action-dock" aria-label="Realm actions" data-group="Realm actions">
        {actionChoices
          .filter((action) => isStructureActionEnabled(action.id, (command) => commands.has(command)))
          .map((action) => (
            <button data-notice key={action.word} aria-label={action.word} onClick={() => open(action.word)}>
              <span className="action-circle">
                <img src={layout === "current" ? action.image : commandArt[action.id]} alt="" />
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
        {layout === "rails" && <KitIcon code="Ct" size={18} />}
        {layout === "current" ? "djiizus: ohayo" : "Chat"}
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
