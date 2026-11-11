import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { requireActiveGameSyncRuntime, type WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";

import { getCurrentPlayRouteBootToken, usePlayRouteReadinessStore } from "@/game-entry/play-route-readiness-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { parsePlayRoute } from "@/play/navigation/play-route";
import { resolveRendererBuildModeFromSearch } from "@/three/renderer-build-mode";
import { forgetCameraView, publishCameraView } from "@/three/scenes/worldmap-camera-view";
import { bindMapSelection } from "@/three/scenes/worldmap-map-selection";
import { TERRAIN_HEX_HORIZONTAL_SPACING, TERRAIN_HEX_VERTICAL_SPACING } from "@/three/terrain/terrain-coordinates";
import { latticeToWorld } from "@/three/utils/hex-lattice";
import { setWorldOrigin, worldHexAt, worldHexToWorld, worldOrigin } from "@/three/world-origin";

import { env } from "../../env";
import { ArmyMarches, TROOP_BUILDS } from "./army-marches";
import { landAround, type Hex } from "./land-from-facts";
import { MapArt } from "./map-art";
import { CAMERA_FAR, CAMERA_FOV, CAMERA_NEAR, cameraWorldMatrix, type GroundPoint, type MapCamera } from "./map-camera";
import { openWithoutMapClient } from "./map-client-flag";
import { changedHexes, contractHexOf, readArmies, readStructures, readTiles } from "./map-facts";
import { MapInput } from "./map-input";
import { MapSelection } from "./map-selection";
import type { MapRenderer } from "./renderer/map_client";
import { packLand } from "./scene-from-land";
import type { PackedScene } from "./scene-pack";

/**
 * The renderer's module, as `wasm-pack build --target web` builds the `apps/game/map-client` crate into `./renderer`.
 * It is fetched only when the address asks for this map.
 */
type MapRendererModule = typeof import("./renderer/map_client");

const CANVAS_ID = "main-canvas";
/** How many hexes round the camera the map holds, and how far the camera may stray before the land is taken again. */
const LAND_REACH = 28;
const LAND_SLACK = 12;
/**
 * How long after the first change to the land's facts the land is built again, in milliseconds: what one action
 * publishes in pieces is drawn together, and later changes never push the build further off.
 */
const LAND_BATCH_MS = 200;
/** The events that tell the page's address changed (`renderer-route-runtime.ts`). */
const ROUTE_EVENTS = ["urlChanged", "popstate", "sceneAddressChanged"] as const;
const START_DISTANCE = 22;
/** The renderer's quality tier: the middle one, which the phone bar was measured on. */
const QUALITY = "mid";

/**
 * The world map drawn by the map client's own renderer, from the game's facts: the spatial projection's tiles,
 * structures and armies. It stands where today's renderer stands in the game's renderer session, draws on the same
 * canvas id under the same HUD, and tells the same stores where the camera looks and what is picked. The realm view
 * is not drawn by it.
 */
export class MapClientRenderer {
  private canvas = document.createElement("canvas");
  private readonly marches = new ArmyMarches();
  private readonly startedAt = performance.now();
  private readonly unsubscribe: Array<() => void> = [];
  private art: MapArt | null = null;
  private module: MapRendererModule | null = null;
  private renderer: MapRenderer | null = null;
  private input: MapInput | null = null;
  private selection: MapSelection | null = null;
  private camera: MapCamera = { target: { x: 0, z: 0 }, distance: START_DISTANCE };
  /** The hex the land in the renderer was taken round. */
  private landCentre: Hex = { col: 0, row: 0 };
  /** Counts every change to what the land shows; the land drawn is as of `landBuilt`. */
  private landWanted = 0;
  private landBuilt = 0;
  private landTimer: number | null = null;
  private building = false;
  /** Set once WebGPU has failed to start here: every later start draws on WebGL2. */
  private onWebGL2 =
    resolveRendererBuildModeFromSearch({
      envBuildMode: env.VITE_PUBLIC_RENDERER_BUILD_MODE,
      search: window.location.search,
    }) === "webgpu-force-webgl" || !("gpu" in navigator);
  private frame: number | null = null;
  private destroyed = false;

  constructor(private readonly setup: GameClientSetup) {}

  async initScene(): Promise<void> {
    // The entry that started this map is the one told it stands, whatever entry is current by then.
    const token = getCurrentPlayRouteBootToken();
    this.mountCanvas();
    const [art, module] = await Promise.all([MapArt.load(), loadModule()]);
    if (this.destroyed) return art.dispose();
    this.art = art;
    this.module = module;
    const projection = requireActiveGameSyncRuntime().requireWorldSpatialProjection();
    // Facts are followed before the first land is read, so nothing published while it is built is missed.
    this.followFacts(projection);
    await this.buildLand(projection, this.firstHex(projection));
    if (this.destroyed) return;
    this.input = new MapInput(this.canvas, {
      camera: () => this.camera,
      moveCamera: (camera) => this.lookAt(camera),
      tap: (ground) => this.selection?.tapAt(this.hexUnder(ground)),
    });
    this.selection = new MapSelection(projection, this.setup.store, (stops) => this.renderer?.show_order(stops));
    this.unsubscribe.push(bindMapSelection(projection), () => this.selection?.dispose());
    window.addEventListener("resize", this.resize);
    for (const event of ROUTE_EVENTS) window.addEventListener(event, this.leaveForRealmView);
    this.draw();
    this.announceReady(token);
  }

  /** Today's renderer opens its frame-time monitors here; this map has none of its own yet. */
  initStats(): void {}

  destroy(): void {
    this.destroyed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    if (this.landTimer !== null) window.clearTimeout(this.landTimer);
    window.removeEventListener("resize", this.resize);
    for (const event of ROUTE_EVENTS) window.removeEventListener(event, this.leaveForRealmView);
    this.input?.dispose();
    for (const stop of this.unsubscribe.splice(0)) stop();
    this.renderer?.free();
    this.renderer = null;
    this.art?.dispose();
    this.canvas.remove();
    forgetCameraView();
  }

  /**
   * This map draws the world map only. When the address turns to the realm view the page is opened again without
   * the trial, so today's client draws it: this map never claims a view it does not have.
   */
  private readonly leaveForRealmView = (): void => {
    if (parsePlayRoute(window.location)?.scene === "hex") openWithoutMapClient();
  };

  private mountCanvas(): void {
    document.getElementById(CANVAS_ID)?.remove();
    this.canvas.id = CANVAS_ID;
    Object.assign(this.canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      touchAction: "none",
    });
    document.body.style.background = "black";
    document.body.appendChild(this.canvas);
    this.fitCanvas();
  }

  /** Sizes the canvas to the pixels it covers, no finer than twice the page's own; true when that changed it. */
  private fitCanvas(): boolean {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width === width && this.canvas.height === height) return false;
    this.canvas.width = width;
    this.canvas.height = height;
    return true;
  }

  private readonly resize = (): void => {
    if (this.fitCanvas()) this.renderer?.resize(this.canvas.width, this.canvas.height);
  };

  /** The hex the map opens on: the one its address names, else a structure, else any explored tile. */
  private firstHex(projection: WorldSpatialProjection): Hex {
    const route = parsePlayRoute(window.location);
    if (route?.col != null && route.row != null) return { col: route.col, row: route.row };
    return readStructures(projection)[0]?.hex ?? readTiles(projection)[0] ?? { col: 0, row: 0 };
  }

  /**
   * Builds the land until it shows the facts as they stand: a change published while a land is being built brings
   * another, so the last land drawn is never older than the last change.
   */
  private async buildLand(projection: WorldSpatialProjection, first?: Hex): Promise<void> {
    if (this.building) return;
    this.building = true;
    try {
      let centre = first;
      do {
        const wanted = this.landWanted;
        await this.takeLand(projection, centre ?? this.hexUnder(this.camera.target));
        this.landBuilt = wanted;
        centre = undefined;
      } while (!this.destroyed && this.landBuilt < this.landWanted);
    } finally {
      this.building = false;
    }
  }

  /** Takes the land round a hex from the facts and starts the renderer on it, keeping the camera where it looks. */
  private async takeLand(projection: WorldSpatialProjection, centre: Hex): Promise<void> {
    if (!this.art || !this.module) return;
    const lookedAt = this.renderer ? absoluteOf(this.camera.target) : null;
    setWorldOrigin(centre);
    this.landCentre = centre;
    this.camera = { ...this.camera, target: lookedAt ? drawnOf(lookedAt) : worldHexToWorld(centre.col, centre.row) };
    const land = landAround(readTiles(projection), centre, LAND_REACH);
    const structures = readStructures(projection).filter(({ hex }) => inReach(hex, centre));
    const scene = await packLand(this.art, land, structures);
    if (this.destroyed) return;
    // One renderer owns the canvas at a time: the last frame stays on it while the next land starts.
    this.renderer?.free();
    this.renderer = null;
    const started = await this.startRenderer(scene);
    if (this.destroyed) return started.free();
    this.renderer = started;
    this.marches.forget();
    this.placeArmies(projection);
    this.selection?.showOrder();
  }

  /**
   * Starts the renderer on the canvas: on WebGPU where the browser has it, and on WebGL2 where it has not, where
   * the address asks for it, or where WebGPU would not start (no adapter, no device). A canvas that was offered to
   * WebGPU cannot be drawn on by WebGL2, so the fallback starts on a new one.
   */
  private async startRenderer(scene: PackedScene): Promise<MapRenderer> {
    const start = () =>
      this.module!.MapRenderer.start(
        this.canvas,
        scene.table,
        scene.buffer,
        TERRAIN_HEX_HORIZONTAL_SPACING,
        TERRAIN_HEX_VERTICAL_SPACING,
        this.onWebGL2,
        QUALITY,
      );
    if (this.onWebGL2) return start();
    try {
      return await start();
    } catch (reason) {
      console.warn("The map could not start on WebGPU and starts on WebGL2:", reason);
      this.onWebGL2 = true;
      this.canvas.remove();
      this.canvas = document.createElement("canvas");
      if (!this.destroyed) this.mountCanvas();
      return start();
    }
  }

  /** Follows the facts: armies are placed again as they change; a change to the land held brings a new land. */
  private followFacts(projection: WorldSpatialProjection): void {
    const landChanged = (changes: Parameters<typeof changedHexes>[0]) => {
      if (changedHexes(changes).some((hex) => inReach(hex, this.landCentre))) this.wantLand(projection);
    };
    this.unsubscribe.push(
      projection.subscribeArmies(() => this.placeArmies(projection)),
      projection.subscribeTiles(landChanged),
      projection.subscribeStructures(landChanged),
    );
  }

  /**
   * Asks for the land to be built again. The first ask sets the time of the build; later ones are drawn with it,
   * and one that comes while a land is being built is caught up as that build ends.
   */
  private wantLand(projection: WorldSpatialProjection): void {
    this.landWanted += 1;
    if (this.landTimer !== null || this.building) return;
    this.landTimer = window.setTimeout(() => {
      this.landTimer = null;
      void this.buildLand(projection);
    }, LAND_BATCH_MS);
  }

  private placeArmies(projection: WorldSpatialProjection): void {
    if (!this.renderer) return;
    if (!this.marches.update(readArmies(projection, this.setup.store), this.seconds())) return;
    for (const build of TROOP_BUILDS) this.renderer.set_troop(build, this.marches.instancesOf(build));
  }

  private lookAt(camera: MapCamera): void {
    this.camera = camera;
    publishCameraView(camera.target, camera.distance);
    const under = this.hexUnder(camera.target);
    useUIStore.getState().setCameraTargetHex(contractHexOf(under));
    const strayed = Math.max(Math.abs(under.col - this.landCentre.col), Math.abs(under.row - this.landCentre.row));
    if (strayed > LAND_REACH - LAND_SLACK) {
      this.landCentre = under;
      this.wantLand(requireActiveGameSyncRuntime().requireWorldSpatialProjection());
    }
  }

  private hexUnder(point: GroundPoint): Hex {
    return worldHexAt(point.x, point.z);
  }

  private seconds(): number {
    return (performance.now() - this.startedAt) / 1_000;
  }

  private readonly draw = (): void => {
    if (this.destroyed) return;
    this.frame = requestAnimationFrame(this.draw);
    if (!this.renderer || this.building) return;
    this.renderer.render(cameraWorldMatrix(this.camera), CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR, this.seconds());
  };

  /** Tells the entry that started this map that the world map stands, as today's map does. */
  private announceReady(token: number): void {
    const readiness = usePlayRouteReadinessStore.getState();
    readiness.markWorldmapReady(token);
    readiness.markWorldmapConverged(token);
    useUIStore.getState().setIsLoadingScreenEnabled(false);
    this.lookAt(this.camera);
  }
}

async function loadModule(): Promise<MapRendererModule> {
  const module = await import("./renderer/map_client");
  await module.default();
  return module;
}

const inReach = (hex: Hex, centre: Hex): boolean =>
  Math.abs(hex.col - centre.col) <= LAND_REACH && Math.abs(hex.row - centre.row) <= LAND_REACH;

/** A drawn point as a point of the whole lattice, which does not move when the map's floating origin does. */
function absoluteOf(drawn: GroundPoint): GroundPoint {
  const origin = latticeToWorld(worldOrigin().col, worldOrigin().row);
  return { x: drawn.x + origin.x, z: drawn.z + origin.z };
}

function drawnOf(absolute: GroundPoint): GroundPoint {
  const origin = latticeToWorld(worldOrigin().col, worldOrigin().row);
  return { x: absolute.x - origin.x, z: absolute.z - origin.z };
}
