import type { ID } from "@bibliothecadao/types";
import { createRoot, type Root } from "react-dom/client";
import { type Camera, Matrix4, Vector3 } from "three";

import "./map-plates.css";
import { openedSize, restingSize, stack, type PlateBox } from "./map-plate-layout";
import type { MapPlate } from "./map-plate-model";
import { Pin, Plate } from "./map-plates";

/** What a manager hands the layer for one of its things: where its plate stands in the world, and what it says. */
export interface MapPlateInput {
  entityId: ID;
  position: Vector3;
  plate: MapPlate;
}

/** One manager's view of the layer: its own things, keyed by entity id. */
export interface MapPlateScope {
  setLabel(input: MapPlateInput): void;
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
  position: Vector3;
  resting: { width: number; height: number };
  opened: { width: number; height: number };
}

/** How much a thing's place in the stack is worth: selected, hovered, yours, then what threatens you. */
const RELATION_PRIORITY = { own: 60, enemy: 40, ally: 30, neutral: 10 } as const;
const KIND_PRIORITY = { army: 8, structure: 5 } as const;

/**
 * The map's plates (map-plates.tsx) over the world renderer: one DOM layer under the HUD, one React root for the plates'
 * content, and per frame only their screen positions, written straight to each element. Where plates meet they stack
 * upward, two steps at most, then drop to a pin; an opened plate (its tile hovered, or selected) stands over the rest,
 * and the plates it would cover step aside. The managers decide which things carry a plate (the zoom band's gate);
 * the layer decides only where each stands.
 */
export class MapPlateLayer {
  private readonly element: HTMLDivElement;
  private readonly root: Root;
  private readonly entries = new Map<string, PlateEntry>();
  private readonly elements = new Map<string, HTMLDivElement>();
  private hovered: string | null = null;
  private selected: ID | null = null;
  /** Plates the last layout left without room: drawn as pins. */
  private pinned = new Set<string>();
  private renderQueued = false;
  private layoutDirty = true;
  private readonly lastView = new Matrix4();
  private lastViewport = "";
  private readonly point = new Vector3();

  /** `container` is where the layer draws: resolved again each frame until it exists (the world UI mounts late). */
  constructor(private readonly container: () => HTMLElement | null) {
    this.element = document.createElement("div");
    this.element.className = "mp";
    this.element.dataset.role = "map-plates";
    this.root = createRoot(this.element);
  }

  /** The world map shows its plates while it is the scene on screen; another scene hides them. */
  public setVisible(visible: boolean): void {
    this.element.style.display = visible ? "" : "none";
  }

  public createScope(namespace: string): MapPlateScope {
    const keyOf = (entityId: ID) => `${namespace}:${entityId}`;
    const ownKeys = () => [...this.entries.keys()].filter((key) => key.startsWith(`${namespace}:`));
    return {
      setLabel: (input) => this.setEntry(keyOf(input.entityId), input),
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

  /** The selected thing's plate stays open, ringed in gold. */
  public setSelected(entityId: ID | null): void {
    if (this.selected === entityId) return;
    this.selected = entityId;
    this.invalidate();
  }

  /** Places every plate for this frame's camera; a frame whose camera and plates did not change costs nothing. */
  public update(camera: Camera, width: number, height: number): void {
    if (!this.element.isConnected) {
      const container = this.container();
      if (!container) return;
      container.appendChild(this.element);
    }
    const viewport = `${width}x${height}`;
    camera.updateMatrixWorld();
    if (!this.layoutDirty && viewport === this.lastViewport && this.lastView.equals(camera.matrixWorld)) return;
    this.layoutDirty = false;
    this.lastViewport = viewport;
    this.lastView.copy(camera.matrixWorld);
    this.layout(camera, width, height);
  }

  public get plateCount(): number {
    return this.entries.size - this.pinned.size;
  }

  public get domNodeCount(): number {
    return this.element.querySelectorAll("*").length;
  }

  public dispose(): void {
    this.entries.clear();
    this.elements.clear();
    // The root unmounts after the frame that asked for it, never inside a React render.
    queueMicrotask(() => {
      this.root.unmount();
      this.element.remove();
    });
  }

  private setEntry(key: string, input: MapPlateInput): void {
    const existing = this.entries.get(key);
    if (existing && samePlate(existing.plate, input.plate)) {
      if (!existing.position.equals(input.position)) {
        existing.position.copy(input.position);
        this.layoutDirty = true;
      }
      return;
    }
    this.entries.set(key, {
      key,
      entityId: input.entityId,
      plate: input.plate,
      position: input.position.clone(),
      resting: restingSize(input.plate),
      opened: openedSize(input.plate),
    });
    this.invalidate();
  }

  private removeEntries(keys: readonly string[]): void {
    let removed = false;
    for (const key of keys) removed = this.entries.delete(key) || removed;
    if (removed) this.invalidate();
  }

  private setHovered(key: string | null): void {
    if (this.hovered === key) return;
    this.hovered = key;
    this.invalidate();
  }

  private openKey(): string | null {
    if (this.hovered && this.entries.has(this.hovered)) return this.hovered;
    if (this.selected === null) return null;
    for (const entry of this.entries.values()) if (entry.entityId === this.selected) return entry.key;
    return null;
  }

  /** The plates' content changed: draw it again, and lay it out on the next frame. */
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
    const open = this.openKey();
    this.root.render(
      <>
        {[...this.entries.values()].map((entry) => (
          <div
            key={entry.key}
            ref={(element) => {
              if (element) this.elements.set(entry.key, element);
              else this.elements.delete(entry.key);
            }}
            className="mp-at"
            data-relation={entry.plate.relation}
            data-selected={entry.entityId === this.selected}
            style={{ display: "none", zIndex: entry.key === open ? 5 : this.pinned.has(entry.key) ? 0 : 1 }}
          >
            {this.pinned.has(entry.key) ? (
              <Pin plate={entry.plate} />
            ) : (
              <Plate plate={entry.plate} open={entry.key === open} />
            )}
          </div>
        ))}
      </>,
    );
  }

  private layout(camera: Camera, width: number, height: number): void {
    const open = this.openKey();
    const placed: { entry: PlateEntry; x: number; y: number }[] = [];
    for (const entry of this.entries.values()) {
      this.point.copy(entry.position).project(camera);
      const x = ((this.point.x + 1) / 2) * width;
      const y = ((1 - this.point.y) / 2) * height;
      const onScreen = this.point.z < 1 && x > -60 && x < width + 60 && y > -60 && y < height + 60;
      const element = this.elements.get(entry.key);
      if (!onScreen) {
        if (element) element.style.display = "none";
        continue;
      }
      placed.push({ entry, x, y });
    }
    const boxes: PlateBox[] = placed.map(({ entry, x, y }) => {
      const size = entry.key === open ? entry.opened : entry.resting;
      return {
        id: entry.key,
        x: x - size.width / 2,
        y: y - size.height,
        width: size.width,
        height: size.height,
        priority:
          (entry.entityId === this.selected ? 1000 : 0) +
          (entry.key === this.hovered ? 500 : 0) +
          RELATION_PRIORITY[entry.plate.relation] +
          KIND_PRIORITY[entry.plate.kind],
      };
    });
    const lifts = stack(boxes);
    const openBox = boxes.find((box) => box.id === open);
    const pinned = new Set(placed.filter(({ entry }) => !lifts.has(entry.key)).map(({ entry }) => entry.key));
    for (const { entry, x, y } of placed) {
      const element = this.elements.get(entry.key);
      if (!element) continue;
      const lift = lifts.get(entry.key);
      const box = boxes.find((candidate) => candidate.id === entry.key)!;
      const yields =
        openBox !== undefined &&
        entry.key !== open &&
        lift !== undefined &&
        intersects({ ...box, y: box.y - lift }, { ...openBox, y: openBox.y - (lifts.get(openBox.id) ?? 0) });
      element.style.display = "";
      element.style.transform =
        lift === undefined
          ? `translate(${x}px, ${y}px) translate(-50%, -50%)`
          : `translate(${x}px, ${y - lift}px) translate(-50%, -100%)`;
      element.dataset.yields = String(yields);
    }
    if (!sameSet(pinned, this.pinned)) {
      this.pinned = pinned;
      this.invalidate();
    }
  }
}

const intersects = (a: Omit<PlateBox, "id" | "priority">, b: Omit<PlateBox, "id" | "priority">) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((key) => b.has(key));

/** Two plates draw the same: a plate built again from unchanged facts costs no render. */
const samePlate = (a: MapPlate, b: MapPlate) => JSON.stringify(a) === JSON.stringify(b);
