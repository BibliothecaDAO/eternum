import type { ID } from "@bibliothecadao/types";
import { memo } from "react";
import { createRoot, type Root } from "react-dom/client";
import { type Camera, Matrix4, Vector3 } from "three";

import "./map-plates.css";
import { hudColumnRects } from "../utils/labels/hud-clearance";
import { placePlates, plateSize, type OrderLineAsk, type PlateThing } from "./map-plate-layout";
import type { MapPlate } from "./map-plate-model";
import { Token, tokenSize } from "./map-plate-token";
import { Plate } from "./map-plates";

/**
 * What a manager hands the layer for one of its things: where its token stands in the world (its label point, right
 * above it), and what its plate says.
 */
export interface MapPlateInput {
  entityId: ID;
  position: Vector3;
  plate: MapPlate;
}

/** One manager's view of the layer: its own things, keyed by entity id. */
export interface MapPlateScope {
  setLabel(input: MapPlateInput): void;
  /** Moves a thing's label as it stands, saying the same: a marching army each frame. A thing with none has none. */
  setPosition(entityId: ID, position: Vector3): void;
  removeLabel(entityId: ID): void;
  removeMany(entityIds: Iterable<ID>): void;
  /** Keeps only the plates whose thing is still placed: the reconcile that hides a model hides its plate too. */
  retainOnly(entityIds: Iterable<ID>): void;
  clear(): void;
  /** Opens this thing's plate: the pointer is on its tile. */
  setHover(entityId: ID): void;
  clearHover(): void;
  dispose(): void;
}

interface PlateEntry {
  key: string;
  entityId: ID;
  plate: MapPlate;
  /** What the plate says, as one string: a plate built again from unchanged facts costs no render. */
  says: string;
  position: Vector3;
  /**
   * Each view's size, the one the layout weighs: estimated from its words until the view is drawn, then as last drawn,
   * kept while it is not on the page. A plate closed because its drawn size does not fit stays closed on a still map,
   * never reopened at the smaller estimate it outgrew. A content change makes a new entry; a web font loading
   * estimates them afresh.
   */
  sizes: Record<LabelView, { width: number; height: number }>;
}

/** How a thing is drawn: its token at rest, or its plate opened in the token's place. */
type LabelView = "token" | "open";

/** A plate's sizes before any is drawn, from its words' measure. */
const estimates = (plate: MapPlate): PlateEntry["sizes"] => ({
  token: tokenSize(plate),
  open: plateSize(plate),
});

/** How much a thing's place is worth: yours, then what threatens you. */
const RELATION_PRIORITY = { own: 60, enemy: 40, ally: 30, neutral: 10 } as const;
const KIND_PRIORITY = { army: 8, structure: 5 } as const;

/** What the layer cannot observe (the HUD's columns, a plate's drawn width) is read again at least this often. */
const RELAYOUT_MS = 500;
/** The HUD's bar across the top of the screen: the order line stays under it. */
const SCREEN_TOP = 56;

/**
 * The map's labels over the world renderer (map labels, the owner's plan D of 2026-10-19: "icons everywhere, full plate
 * on hover"): one DOM layer under the HUD, one React root for their content, and per frame only their screen positions,
 * written straight to each element. Every thing is its token (map-plate-token.tsx), right above it; hovered, its full plate (map-plates.tsx) replaces the token in place, and the order line stands beside its tile (`placePlates`).
 * The managers decide which things carry a label (the zoom band's gate); the layer decides only where each stands.
 */
export class MapPlateLayer {
  private readonly element: HTMLDivElement;
  private readonly root: Root;
  private readonly entries = new Map<string, PlateEntry>();
  private readonly elements = new Map<string, HTMLDivElement>();
  private hovered: string | null = null;
  private selected: ID | null = null;
  /** The hovered thing as it was selected: it rests until the pointer leaves it, and opens on the next hover. */
  private restingHover: string | null = null;
  /** A thing hovered whose plate the layout could not open clear of the others: it stays its token. */
  private closed = new Set<string>();
  private orderLineAsk: OrderLineAsk | null = null;
  private orderLineAt: { x: number; y: number } | null = null;
  private lastFrame: { camera: Camera; width: number; height: number } | null = null;
  private renderQueued = false;
  private layoutDirty = true;
  private readonly lastView = new Matrix4();
  private readonly lastProjection = new Matrix4();
  private lastViewport = "";
  private lastLayoutAt = -Infinity;
  private readonly point = new Vector3();

  /** `container` is where the layer draws: resolved again each frame until it exists (the world UI mounts late). */
  constructor(private readonly container: () => HTMLElement | null) {
    this.element = document.createElement("div");
    this.element.className = "mp";
    this.element.dataset.role = "map-plates";
    this.root = createRoot(this.element);
    document.fonts?.addEventListener("loadingdone", this.estimateAfresh);
  }

  /** A web font loaded: every label's words measure differently, so each view is weighed from its estimate again. */
  private readonly estimateAfresh = (): void => {
    for (const entry of this.entries.values()) entry.sizes = estimates(entry.plate);
    this.layoutDirty = true;
  };

  /** The world map shows its plates while it is the scene on screen; another scene hides them. */
  public setVisible(visible: boolean): void {
    this.element.style.display = visible ? "" : "none";
  }

  public createScope(namespace: string): MapPlateScope {
    const keyOf = (entityId: ID) => `${namespace}:${entityId}`;
    const ownKeys = () => [...this.entries.keys()].filter((key) => key.startsWith(`${namespace}:`));
    return {
      setLabel: (input) => this.setEntry(keyOf(input.entityId), input),
      setPosition: (entityId, position) => this.moveEntry(keyOf(entityId), position),
      removeLabel: (entityId) => this.removeEntries([keyOf(entityId)]),
      removeMany: (entityIds) => this.removeEntries([...entityIds].map(keyOf)),
      retainOnly: (entityIds) => {
        const keep = new Set([...entityIds].map(keyOf));
        this.removeEntries(ownKeys().filter((key) => !keep.has(key)));
      },
      clear: () => this.removeEntries(ownKeys()),
      setHover: (entityId) => this.setHovered(keyOf(entityId)),
      clearHover: () => {
        if (this.hovered?.startsWith(`${namespace}:`)) this.setHovered(null);
      },
      dispose: () => this.removeEntries(ownKeys()),
    };
  }

  /**
   * Where the map's order line goes for the tile under the pointer (`ask.at`, on screen): beside the tile, clear of the
   * opened plates; the tokens under it step aside until it goes (null). Null when no frame was laid out yet.
   */
  public placeOrderLine(ask: OrderLineAsk | null): { x: number; y: number } | null {
    this.orderLineAsk = ask;
    this.layoutDirty = true;
    if (this.lastFrame) this.layout(this.lastFrame.camera, this.lastFrame.width, this.lastFrame.height);
    return ask && this.orderLineAt;
  }

  /**
   * The selected thing's token is ringed in gold, and goes back to rest: its detail is the HUD's panel, so its plate
   * opens only while it is hovered, as any thing's (owner, 20 October 2026: "on select it goes back to the rest state
   * and we just open up a detail panel"). Selected under the pointer, it rests too, until the pointer leaves it.
   */
  public setSelected(entityId: ID | null): void {
    if (this.selected === entityId) return;
    this.selected = entityId;
    const hovered = this.hovered === null ? undefined : this.entries.get(this.hovered);
    if (entityId !== null && hovered?.entityId === entityId) this.restingHover = this.hovered;
    this.invalidate();
  }

  /**
   * Places every plate for this frame's camera. A frame changes nothing when none of the layout's inputs did: the
   * plates and their mounted elements, the camera's place and projection, the viewport; what the layer cannot observe
   * is read again every RELAYOUT_MS.
   */
  public update(camera: Camera, width: number, height: number): void {
    if (!this.element.isConnected) {
      const container = this.container();
      if (!container) return;
      container.appendChild(this.element);
    }
    const viewport = `${width}x${height}`;
    const now = performance.now();
    camera.updateMatrixWorld();
    if (
      !this.layoutDirty &&
      viewport === this.lastViewport &&
      this.lastView.equals(camera.matrixWorld) &&
      this.lastProjection.equals(camera.projectionMatrix) &&
      now - this.lastLayoutAt < RELAYOUT_MS
    )
      return;
    this.layoutDirty = false;
    this.lastViewport = viewport;
    this.lastView.copy(camera.matrixWorld);
    this.lastProjection.copy(camera.projectionMatrix);
    this.lastLayoutAt = now;
    this.lastFrame = { camera, width, height };
    this.layout(camera, width, height);
  }

  /** How many things carry a label (a token, or its plate opened). */
  public get labelCount(): number {
    return this.entries.size;
  }

  public get domNodeCount(): number {
    return this.element.querySelectorAll("*").length;
  }

  public dispose(): void {
    document.fonts?.removeEventListener("loadingdone", this.estimateAfresh);
    this.entries.clear();
    this.elements.clear();
    // The root unmounts after the frame that asked for it, never inside a React render.
    queueMicrotask(() => {
      this.root.unmount();
      this.element.remove();
    });
  }

  private setEntry(key: string, input: MapPlateInput): void {
    const says = JSON.stringify(input.plate);
    if (this.entries.get(key)?.says === says) {
      this.moveEntry(key, input.position);
      return;
    }
    this.entries.set(key, {
      key,
      entityId: input.entityId,
      plate: input.plate,
      says,
      position: input.position.clone(),
      sizes: estimates(input.plate),
    });
    this.invalidate();
  }

  private moveEntry(key: string, position: Vector3): void {
    const entry = this.entries.get(key);
    if (!entry || entry.position.equals(position)) return;
    entry.position.copy(position);
    this.layoutDirty = true;
  }

  /** A slot's element as React commits it: the next frame's layout places it, whatever ran before the commit. */
  private readonly register = (key: string, element: HTMLDivElement | null): void => {
    if (element) this.elements.set(key, element);
    else this.elements.delete(key);
    this.layoutDirty = true;
  };

  private removeEntries(keys: readonly string[]): void {
    let removed = false;
    for (const key of keys) removed = this.entries.delete(key) || removed;
    if (removed) this.invalidate();
  }

  private setHovered(key: string | null): void {
    if (this.hovered === key) return;
    this.hovered = key;
    // The pointer left the thing it selected: its next hover opens it.
    if (key !== this.restingHover) this.restingHover = null;
    this.invalidate();
  }

  /** How a thing asks to be drawn: its plate while it is hovered (not as it was selected), else its token. */
  private askedViewOf(entry: PlateEntry): LabelView {
    return entry.key === this.hovered && entry.key !== this.restingHover ? "open" : "token";
  }

  /** How a thing is drawn: as it asks, but its token where the layout could not open its plate clear of the others. */
  private viewOf(entry: PlateEntry): LabelView {
    return this.closed.has(entry.key) ? "token" : this.askedViewOf(entry);
  }

  /** The labels' content changed: draw the ones that changed again, and lay them all out on the next frame. */
  private invalidate(): void {
    this.layoutDirty = true;
    if (this.renderQueued) return;
    this.renderQueued = true;
    queueMicrotask(() => {
      this.renderQueued = false;
      this.render();
    });
  }

  private render(): void {
    this.root.render(
      <>
        {[...this.entries.values()].map((entry) => (
          <LabelSlot
            key={entry.key}
            entry={entry}
            view={this.viewOf(entry)}
            selected={entry.entityId === this.selected}
            register={this.register}
          />
        ))}
      </>,
    );
  }

  /** Each thing on screen, where its token stands; the layout hides the rest after its reads. */
  private onScreen(
    camera: Camera,
    width: number,
    height: number,
  ): { placed: { entry: PlateEntry; x: number; y: number }[]; offScreen: string[] } {
    const placed: { entry: PlateEntry; x: number; y: number }[] = [];
    const offScreen: string[] = [];
    for (const entry of this.entries.values()) {
      this.point.copy(entry.position).project(camera);
      const x = ((this.point.x + 1) / 2) * width;
      const y = ((1 - this.point.y) / 2) * height;
      if (this.point.z < 1 && x > -60 && x < width + 60 && y > -60 && y < height + 60) placed.push({ entry, x, y });
      else offScreen.push(entry.key);
    }
    return { placed, offScreen };
  }

  /**
   * A thing's size in a view, as the layout weighs it: as drawn when its element shows that view now (the layout keeps
   * what is drawn apart, not an estimate of it), else as it was last drawn, else its estimate (`PlateEntry.sizes`).
   */
  private sizeOf(entry: PlateEntry, view: LabelView): { width: number; height: number } {
    const element = this.elements.get(entry.key);
    const drawn = element?.dataset.view === view ? element.firstElementChild : null;
    if (drawn instanceof HTMLElement && drawn.offsetWidth > 0)
      entry.sizes[view] = { width: drawn.offsetWidth, height: drawn.offsetHeight };
    return entry.sizes[view];
  }

  /**
   * Every read (the drawn sizes, the HUD's columns) comes before the first write (each element's place, or its hiding
   * off screen), so the browser lays the page out once per layout, not once per label.
   */
  private layout(camera: Camera, width: number, height: number): void {
    const { placed, offScreen } = this.onScreen(camera, width, height);
    const things: PlateThing[] = placed.map(({ entry, x, y }) => {
      const asked = this.askedViewOf(entry);
      return {
        id: entry.key,
        at: { x, y },
        token: this.sizeOf(entry, "token"),
        opened: asked === "token" ? undefined : this.sizeOf(entry, asked),
        priority: RELATION_PRIORITY[entry.plate.relation] + KIND_PRIORITY[entry.plate.kind],
        // In view however crowded (the owner, 2026-10-20): the selected thing, the player's own armies, what is in battle.
        keep:
          entry.entityId === this.selected ||
          (entry.plate.kind === "army" && entry.plate.relation === "own") ||
          entry.plate.inBattle === true,
        openRank: asked === "open" ? 1 : 0,
      };
    });
    const { spots, orderLine, closed } = placePlates(
      things,
      { width, height, columns: hudColumnRects(), top: SCREEN_TOP },
      this.orderLineAsk,
    );
    this.orderLineAt = orderLine;
    for (const key of offScreen) {
      const element = this.elements.get(key);
      if (element && element.style.display !== "none") element.style.display = "none";
    }
    if (!sameKeys(closed, this.closed)) {
      this.closed = closed;
      this.invalidate();
    }
    for (const [key, spot] of spots) {
      const element = this.elements.get(key);
      if (!element) continue;
      element.style.display = spot.shape === "none" ? "none" : "";
      if (spot.shape === "none") continue;
      element.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px)`;
      element.dataset.yields = String(spot.shape === "token" && spot.yields);
    }
  }
}

/** One thing's element, its token at rest or its plate opened: drawn again only when its plate or its view changes. */
const LabelSlot = memo(function LabelSlot({
  entry,
  view,
  selected,
  register,
}: {
  entry: PlateEntry;
  view: LabelView;
  selected: boolean;
  register: (key: string, element: HTMLDivElement | null) => void;
}) {
  const watched = entry.plate.watched;
  return (
    <div
      ref={(element) => register(entry.key, element)}
      className="mp-at"
      data-key={entry.key}
      data-view={view}
      data-relation={entry.plate.relation}
      data-seat={watched ? (watched.seat ?? "none") : undefined}
      data-selected={selected}
      // A watching viewer's side is its player's seat colour, in place of the relation's (map-plates.css).
      style={{ display: "none", zIndex: view === "token" ? 1 : 5, ...(watched ? { "--mp-side": watched.colour } : {}) }}
    >
      {view === "token" ? <Token plate={entry.plate} /> : <Plate plate={entry.plate} />}
    </div>
  );
});

const sameKeys = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((key) => b.has(key));
