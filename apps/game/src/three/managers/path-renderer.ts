import {
  Box3,
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  RGBAFormat,
  SRGBColorSpace,
  Vector3,
  type Scene,
} from "three";
import {
  incrementWorldmapRenderCounter,
  recordWorldmapRenderDuration,
  setWorldmapRenderGauge,
} from "../perf/worldmap-render-diagnostics";
import type { CentralizedVisibilityManager } from "../utils/centralized-visibility-manager";
import { buildMovementSpline } from "../utils/spline-path";

/**
 * Where armies are going, as the owner picked it (option A, "Focus", of reports/army-path-3.md): what every strategy
 * game we looked at does, the full route only for the army in hand.
 *
 * - The selected army's walk: a trail of chevrons along the curve it walks, and a ring on the tile it goes to.
 * - The preview: the same trail for the selected army's route to the tile under the pointer, before the order (the
 *   map's order ring already marks that tile).
 * - The army under the pointer: a slim arrow to its end, and a pin there.
 * - Every other walking army: only a pin on its end tile.
 *
 * Each in the colour its caller gives (the army's side's: armyPathColour). Everything lies on the ground, depth-tested
 * and writing no depth, so the models standing on it hide it where they stand and the labels stay above. However many
 * armies walk, it draws in two meshes of one pass each: the chevrons (instanced) and every ring, pin and arrow (one
 * flat mesh).
 */
export type PathDisplayState = "selected" | "hover" | "moving" | "preview";
type PathMark = "trail" | "ring" | "arrow" | "pin";

const PATH_MARKS: Record<PathDisplayState, readonly PathMark[]> = {
  selected: ["trail", "ring"],
  // The tile under the pointer already wears the map's order ring (orderTargetRing): the preview draws only the way.
  preview: ["trail"],
  hover: ["arrow", "pin"],
  moving: ["pin"],
};

/** The preview's key among the paths: no army's id. */
const PREVIEW = -1;
/** How high above the walk its marks lie, clear of the ground's surface. */
const LIFT = 0.08;
/** The route the army's own tile keeps clear (its feet), and the room the end keeps for its ring or arrowhead. */
const START_CLEAR = 0.45;
const END_CLEAR = 0.6;
/** How far apart the trail's chevrons are, and their size. */
const CHEVRON_SPACING = 0.45;
const CHEVRON_SIZE = 0.44;
/** The end tile's ring: a pointy-top hex as the map's tiles are, just inside the tile's edge. */
const RING = { inner: 0.66, outer: 0.8 };
/** Another army's pin: a small round ring and its dot. */
const PIN = { inner: 0.22, outer: 0.3, dot: 0.1 };
/** The slim arrow: its width at the army and at its head, its dark edge, and its head's length. */
const ARROW = { narrow: 0.05, wide: 0.11, edge: 0.05, head: 0.34 };
const ARROW_EDGE = new Color(0x1d1a16);
/** What the two meshes can hold. */
const MAX_CHEVRONS = 2048;
const MAX_FLAT_VERTICES = 49152;
const UP = new Vector3(0, 1, 0);

interface DrawnPath {
  entityId: number;
  colour: Color;
  /** Its tiles' centres, the first where the army stands. */
  tiles: Vector3[];
  /** The curve it walks, lifted and trimmed of the army's feet and the end's mark. */
  walk: Vector3[];
  bounds: Box3;
}

export class PathRenderer {
  private scene: Scene | null = null;
  private mesh: Group | null = null;
  private trail: InstancedMesh | null = null;
  private marks: Mesh | null = null;
  private readonly bounds = new Box3();

  private readonly activePaths = new Map<number, DrawnPath>();
  private selectedEntityId: number | null = null;
  private hoveredEntityId: number | null = null;

  private lastCullFrame = 0;
  private cullCheckInterval = 3;
  private visibilityManager?: Pick<CentralizedVisibilityManager, "isBoxVisible">;
  private isDisposed = false;

  // Dirty-flag deferred rebuild: coalesce several changes into one rebuild on the next animation frame.
  private batchesDirty = false;
  private rebuildFrameHandle: number | null = null;

  public initialize(scene: Scene): void {
    if (this.scene === scene && this.mesh) return;
    if (this.scene && this.scene !== scene) {
      throw new Error("[PathRenderer] Each instance can only be bound to one scene");
    }
    this.scene = scene;
    if (!this.mesh) {
      this.mesh = new Group();
      this.mesh.name = "army-paths";
      this.mesh.visible = false;
      this.trail = trailMesh();
      this.marks = marksMesh();
      this.mesh.add(this.trail, this.marks);
    }
    if (!this.mesh.parent) this.scene.add(this.mesh);
  }

  public setVisibilityManager(visibilityManager?: Pick<CentralizedVisibilityManager, "isBoxVisible">): void {
    this.visibilityManager = visibilityManager;
  }

  /** An army's walk: its tiles' world positions, the first where it stands, in its side's colour. */
  public createPath(entityId: number, positions: Vector3[], colour: Color): void {
    const createStartedAt = performance.now();
    this.setPath(entityId, positions, colour);
    incrementWorldmapRenderCounter("pathCreateCalls");
    recordWorldmapRenderDuration("createPath", performance.now() - createStartedAt);
    setWorldmapRenderGauge("activePaths", this.activePaths.size);
  }

  public removePath(entityId: number): void {
    if (!this.activePaths.delete(entityId)) return;
    this.markBatchesDirty();
    setWorldmapRenderGauge("activePaths", this.activePaths.size);
  }

  /** The selected army, whose walk draws in full; kept while it has no path, so a walk it starts later does too. */
  public setSelectedPath(entityId: number | null): void {
    if (this.selectedEntityId === entityId) return;
    this.selectedEntityId = entityId;
    this.markBatchesDirty();
  }

  /** The army under the pointer, whose walk draws as a slim arrow. */
  public setHoveredPath(entityId: number | null): void {
    if (this.hoveredEntityId === entityId) return;
    this.hoveredEntityId = entityId;
    this.markBatchesDirty();
  }

  /** The selected army's route to the tile under the pointer, before the order; null takes it away. */
  public showPreview(positions: Vector3[] | null, colour: Color): void {
    if (positions === null) this.removePath(PREVIEW);
    else this.setPath(PREVIEW, positions, colour);
  }

  public hasPath(entityId: number): boolean {
    return this.activePaths.has(entityId);
  }

  /** Rebuild what changed, and cull (call each frame). */
  public update(_deltaTime: number): void {
    this.flushDirtyBatches();
    this.lastCullFrame += 1;
    if (this.lastCullFrame >= this.cullCheckInterval) {
      this.lastCullFrame = 0;
      this.updateFrustumCulling();
    }
  }

  public onResize(_width: number, _height: number): void {}

  public clearAll(): void {
    this.activePaths.clear();
    this.selectedEntityId = null;
    this.hoveredEntityId = null;
    this.markBatchesDirty();
    setWorldmapRenderGauge("activePaths", 0);
  }

  public dispose(): void {
    if (this.isDisposed) {
      console.warn("PathRenderer already disposed, skipping cleanup");
      return;
    }
    this.isDisposed = true;
    if (this.rebuildFrameHandle !== null) {
      cancelAnimationFrame(this.rebuildFrameHandle);
      this.rebuildFrameHandle = null;
    }
    this.activePaths.clear();
    for (const mesh of [this.trail, this.marks]) {
      if (!mesh) continue;
      mesh.geometry.dispose();
      const material = mesh.material as MeshBasicMaterial;
      material.map?.dispose();
      material.dispose();
    }
    this.mesh?.parent?.remove(this.mesh);
    this.mesh = null;
    this.trail = null;
    this.marks = null;
    this.scene = null;
  }

  public compact(): void {}

  public shouldCompact(): boolean {
    return false;
  }

  /** The walks drawn: the chevrons, the flat marks' vertices and the meshes drawing them (2 at most). */
  public getStats(): { activePaths: number; chevrons: number; markVertices: number; meshes: number } {
    const chevrons = this.trail?.count ?? 0;
    const markVertices = this.marks?.geometry.drawRange.count ?? 0;
    return {
      activePaths: this.activePaths.size,
      chevrons,
      markVertices,
      meshes: Number(chevrons > 0) + Number(markVertices > 0),
    };
  }

  /** What a path draws now: from the selection, the pointer and the preview. */
  private stateOf(entityId: number): PathDisplayState {
    if (entityId === PREVIEW) return "preview";
    if (entityId === this.selectedEntityId) return "selected";
    if (entityId === this.hoveredEntityId) return "hover";
    return "moving";
  }

  private setPath(entityId: number, positions: Vector3[], colour: Color): void {
    if (positions.length < 2) {
      this.removePath(entityId);
      return;
    }
    const tiles = positions.map((position) => position.clone());
    this.activePaths.set(entityId, {
      entityId,
      colour: colour.clone(),
      tiles,
      walk: walkAlong(tiles),
      bounds: new Box3().setFromPoints(tiles).expandByScalar(1),
    });
    this.markBatchesDirty();
  }

  private updateFrustumCulling(): void {
    if (!this.mesh || this.activePaths.size === 0) return;
    this.mesh.visible = !this.visibilityManager || this.visibilityManager.isBoxVisible(this.bounds);
  }

  private markBatchesDirty(): void {
    this.batchesDirty = true;
    if (this.rebuildFrameHandle === null && typeof requestAnimationFrame !== "undefined") {
      this.rebuildFrameHandle = requestAnimationFrame(() => {
        this.rebuildFrameHandle = null;
        this.flushDirtyBatches();
      });
    }
  }

  private flushDirtyBatches(): void {
    if (!this.batchesDirty) return;
    this.batchesDirty = false;
    if (this.rebuildFrameHandle !== null) {
      cancelAnimationFrame(this.rebuildFrameHandle);
      this.rebuildFrameHandle = null;
    }
    this.rebuild();
  }

  /** Writes every path's marks, by its state, into the two meshes. */
  private rebuild(): void {
    if (!this.mesh || !this.trail || !this.marks) return;
    const chevrons = new ChevronWriter(this.trail);
    const flat = new FlatWriter(this.marks.geometry);
    this.bounds.makeEmpty();
    for (const path of this.activePaths.values()) {
      for (const mark of PATH_MARKS[this.stateOf(path.entityId)]) writeMark(mark, path, chevrons, flat);
      this.bounds.union(path.bounds);
    }
    chevrons.finish();
    flat.finish();
    this.mesh.visible = this.activePaths.size > 0;
    this.trail.visible = chevrons.count > 0;
    this.marks.visible = flat.vertices > 0;
  }
}

/* ── The route's shape ────────────────────────────────────────────────────────────────────────────────────────── */

/** Points every 0.15 along the curve the army walks through its tiles, lifted, without its feet or its end's mark. */
const walkAlong = (tiles: Vector3[]): Vector3[] => {
  const spline = buildMovementSpline(tiles);
  const length = spline.getLength();
  const start = Math.min(START_CLEAR, length / 3);
  const end = Math.max(start, length - Math.min(END_CLEAR, length / 3));
  const count = Math.max(2, Math.round((end - start) / 0.15));
  return Array.from({ length: count + 1 }, (_, index) => {
    const point = spline.getPointAt((start + ((end - start) * index) / count) / length);
    point.y += LIFT;
    return point;
  });
};

/** Points `step` apart along a polyline. */
const everyStep = (points: Vector3[], step: number): Vector3[] => {
  const stations = [points[0].clone()];
  let carried = 0;
  for (let index = 1; index < points.length; index += 1) {
    const to = points[index];
    let at = points[index - 1].clone();
    let span = at.distanceTo(to);
    while (carried + span >= step) {
      const take = step - carried;
      at = at.clone().lerp(to, take / span);
      stations.push(at.clone());
      span -= take;
      carried = 0;
    }
    carried += span;
  }
  return stations;
};

const endOf = (path: DrawnPath): Vector3 => {
  const tile = path.tiles[path.tiles.length - 1];
  return new Vector3(tile.x, tile.y + LIFT, tile.z);
};

const writeMark = (mark: PathMark, path: DrawnPath, chevrons: ChevronWriter, flat: FlatWriter) => {
  if (mark === "trail") {
    const stations = everyStep(path.walk, CHEVRON_SPACING);
    for (let index = 0; index < stations.length - 1; index += 1)
      chevrons.add(stations[index], stations[index + 1].clone().sub(stations[index]), path.colour);
  } else if (mark === "ring") {
    flat.hexRing(endOf(path), RING.inner, RING.outer, path.colour);
  } else if (mark === "pin") {
    flat.roundRing(endOf(path), PIN.inner, PIN.outer, path.colour);
    flat.disc(endOf(path), PIN.dot, path.colour);
  } else {
    // A dark edge under the coloured arrow, so it reads on light and dark ground alike.
    flat.arrow(path.walk, ARROW.narrow + ARROW.edge, ARROW.wide + ARROW.edge, ARROW.head + 0.08, ARROW_EDGE);
    flat.arrow(path.walk, ARROW.narrow, ARROW.wide, ARROW.head, path.colour);
  }
};

/* ── The two meshes ───────────────────────────────────────────────────────────────────────────────────────────── */

/** The trails' chevrons: one instanced square each, tinted per instance, turned to point along its walk. */
const trailMesh = (): InstancedMesh => {
  const half = CHEVRON_SIZE / 2;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([-half, 0, -half, half, 0, -half, half, 0, half, -half, 0, half], 3),
  );
  geometry.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geometry.setIndex([0, 2, 1, 0, 3, 2]);
  const mesh = new InstancedMesh(geometry, groundMaterial(chevronTexture()), MAX_CHEVRONS);
  mesh.name = "army-path-trail";
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(MAX_CHEVRONS * 3), 3);
  mesh.count = 0;
  return prepared(mesh);
};

/** Every ring, pin and arrow, written in world space with their colours, drawn at once. */
const marksMesh = (): Mesh => {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(MAX_FLAT_VERTICES * 3), 3));
  geometry.setAttribute("color", new Float32BufferAttribute(new Float32Array(MAX_FLAT_VERTICES * 3), 3));
  geometry.setDrawRange(0, 0);
  const mesh = new Mesh(geometry, groundMaterial());
  mesh.name = "army-path-marks";
  return prepared(mesh);
};

const prepared = <T extends Mesh>(mesh: T): T => {
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  mesh.visible = false;
  return mesh;
};

/**
 * A stock material, lit by nothing, writing no depth, held off the ground's surface. Flat on the ground, its marks are
 * seen from either face in one pass: a transparent double-sided material would otherwise draw twice, back then front.
 */
const groundMaterial = (map?: DataTexture): MeshBasicMaterial =>
  new MeshBasicMaterial({
    map: map ?? null,
    vertexColors: !map,
    transparent: true,
    opacity: map ? 1 : 0.9,
    depthWrite: false,
    side: DoubleSide,
    forceSinglePass: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

class ChevronWriter {
  public count = 0;
  private readonly matrix = new Matrix4();
  private readonly turn = new Quaternion();
  private readonly scale = new Vector3(1, 1, 1);

  constructor(private readonly mesh: InstancedMesh) {}

  public add(at: Vector3, heading: Vector3, colour: Color): void {
    if (this.count >= MAX_CHEVRONS) return;
    heading.setY(0).normalize();
    this.turn.setFromAxisAngle(UP, Math.atan2(heading.x, heading.z));
    this.mesh.setMatrixAt(this.count, this.matrix.compose(at, this.turn, this.scale));
    this.mesh.setColorAt(this.count, colour);
    this.count += 1;
  }

  public finish(): void {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

class FlatWriter {
  public vertices = 0;
  private readonly position: Float32Array;
  private readonly color: Float32Array;

  constructor(private readonly geometry: BufferGeometry) {
    this.position = geometry.getAttribute("position").array as Float32Array;
    this.color = geometry.getAttribute("color").array as Float32Array;
  }

  public triangle(a: Vector3, b: Vector3, c: Vector3, colour: Color): void {
    if ((this.vertices + 3) * 3 > this.position.length) return;
    for (const point of [a, b, c]) {
      this.position.set([point.x, point.y, point.z], this.vertices * 3);
      this.color.set([colour.r, colour.g, colour.b], this.vertices * 3);
      this.vertices += 1;
    }
  }

  /** A pointy-top hex ring around `centre`, as the map's tiles are. */
  public hexRing(centre: Vector3, inner: number, outer: number, colour: Color): void {
    this.ring(centre, inner, outer, 6, Math.PI / 6, colour);
  }

  /** A pin's ring: twelve sides read round at its size (24 triangles). */
  public roundRing(centre: Vector3, inner: number, outer: number, colour: Color): void {
    this.ring(centre, inner, outer, 12, 0, colour);
  }

  /** A pin's dot: eight sides (8 triangles). */
  public disc(centre: Vector3, radius: number, colour: Color): void {
    const sides = 8;
    for (let side = 0; side < sides; side += 1)
      this.triangle(centre, around(centre, radius, side, sides, 0), around(centre, radius, side + 1, sides, 0), colour);
  }

  /** A band along the walk, `narrow` wide at the army and `wide` at the end, then a head `head` long. */
  public arrow(walk: Vector3[], narrow: number, wide: number, head: number, colour: Color): void {
    const last = walk.length - 1;
    const edges = walk.map((point, index) => {
      const along = walk[Math.min(last, index + 1)]
        .clone()
        .sub(walk[Math.max(0, index - 1)])
        .setY(0)
        .normalize();
      const across = new Vector3(-along.z, 0, along.x).multiplyScalar((narrow + ((wide - narrow) * index) / last) / 2);
      return [point.clone().add(across), point.clone().sub(across)];
    });
    for (let index = 1; index <= last; index += 1) {
      const [[a, b], [c, d]] = [edges[index - 1], edges[index]];
      this.triangle(a, b, c, colour);
      this.triangle(b, d, c, colour);
    }
    const tail = walk[last];
    const heading = tail
      .clone()
      .sub(walk[last - 1])
      .setY(0)
      .normalize();
    const side = new Vector3(-heading.z, 0, heading.x).multiplyScalar(wide * 1.6 + (head - ARROW.head));
    this.triangle(tail.clone().add(side), tail.clone().sub(side), tail.clone().addScaledVector(heading, head), colour);
  }

  public finish(): void {
    for (const name of ["position", "color"]) {
      const attribute = this.geometry.getAttribute(name) as Float32BufferAttribute;
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, this.vertices * 3);
      attribute.needsUpdate = true;
    }
    this.geometry.setDrawRange(0, this.vertices);
  }

  private ring(centre: Vector3, inner: number, outer: number, sides: number, start: number, colour: Color): void {
    for (let side = 0; side < sides; side += 1) {
      const [outerA, outerB] = [
        around(centre, outer, side, sides, start),
        around(centre, outer, side + 1, sides, start),
      ];
      const [innerA, innerB] = [
        around(centre, inner, side, sides, start),
        around(centre, inner, side + 1, sides, start),
      ];
      this.triangle(outerA, outerB, innerA, colour);
      this.triangle(outerB, innerB, innerA, colour);
    }
  }
}

const around = (centre: Vector3, radius: number, step: number, steps: number, start: number) => {
  const angle = start + (step * Math.PI * 2) / steps;
  return new Vector3(centre.x + radius * Math.cos(angle), centre.y, centre.z + radius * Math.sin(angle));
};

/**
 * A slim chevron pointing up the texture (+v), white with a dark rim, painted in memory (no canvas, so it builds
 * wherever the renderer does). White takes each chevron's colour.
 */
const chevronTexture = (): DataTexture => {
  const size = 48;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [u, v] = [(x + 0.5) / size, (y + 0.5) / size];
      const across = Math.abs(u - 0.5);
      // The chevron's centre line: v = 0.72 - |u - 0.5| * 0.9, its arms out to |u - 0.5| = 0.4.
      const distance = across > 0.4 ? 1 : Math.abs(v - (0.72 - across * 0.9)) * 0.75;
      const [shade, alpha] = distance < 0.07 ? [255, 255] : distance < 0.11 ? [55, 220] : [0, 0];
      pixels.set([shade, shade, shade, alpha], (y * size + x) * 4);
    }
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
};
