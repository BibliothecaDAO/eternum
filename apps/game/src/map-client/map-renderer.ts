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
import { contractHexOf, readArmies, readStructures, readTiles } from "./map-facts";
import { MapInput } from "./map-input";
import { MapSelection } from "./map-selection";
import type { MapRenderer } from "./renderer/map_client";
import { packLand } from "./scene-from-land";

/**
 * The renderer's module, as `wasm-pack build --target web` builds the `apps/game/map-client` crate into `./renderer`.
 * It is fetched only when the address asks for this map.
 */
type MapRendererModule = typeof import("./renderer/map_client");

const CANVAS_ID = "main-canvas";
/** How many hexes round the camera the map holds, and how far the camera may stray before the land is taken again. */
const LAND_REACH = 28;
const LAND_SLACK = 12;
/** How long the facts must be still before a changed land is built again, in milliseconds. */
const LAND_SETTLE_MS = 600;
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
  private readonly canvas = document.createElement("canvas");
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
  /** What the facts told of the land when it was last taken. */
  private landHeld = "";
  private landTimer: number | null = null;
  private building = false;
  private frame: number | null = null;
  private destroyed = false;

  constructor(private readonly setup: GameClientSetup) {}

  async initScene(): Promise<void> {
    this.mountCanvas();
    const [art, module] = await Promise.all([MapArt.load(), loadModule()]);
    if (this.destroyed) return art.dispose();
    this.art = art;
    this.module = module;
    const projection = requireActiveGameSyncRuntime().requireWorldSpatialProjection();
    await this.takeLand(projection, this.firstHex(projection));
    this.followFacts(projection);
    this.input = new MapInput(this.canvas, {
      camera: () => this.camera,
      moveCamera: (camera) => this.lookAt(camera),
      tap: (ground) => this.selection?.tapAt(this.hexUnder(ground)),
    });
    this.selection = new MapSelection(projection, this.setup.store, (stops) => this.renderer?.show_order(stops));
    this.unsubscribe.push(bindMapSelection(projection), () => this.selection?.dispose());
    window.addEventListener("resize", this.resize);
    this.draw();
    this.announceReady();
  }

  /** Today's renderer opens its frame-time monitors here; this map has none of its own yet. */
  initStats(): void {}

  destroy(): void {
    this.destroyed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    if (this.landTimer !== null) window.clearTimeout(this.landTimer);
    window.removeEventListener("resize", this.resize);
    this.input?.dispose();
    for (const stop of this.unsubscribe) stop();
    this.renderer?.free();
    this.renderer = null;
    this.art?.dispose();
    this.canvas.remove();
    forgetCameraView();
  }

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

  /** Takes the land round a hex from the facts and starts the renderer on it, keeping the camera where it looks. */
  private async takeLand(projection: WorldSpatialProjection, centre: Hex): Promise<void> {
    if (!this.art || !this.module || this.building) return;
    this.building = true;
    try {
      const lookedAt = this.renderer ? absoluteOf(this.camera.target) : null;
      setWorldOrigin(centre);
      this.landCentre = centre;
      this.camera = { ...this.camera, target: lookedAt ? drawnOf(lookedAt) : worldHexToWorld(centre.col, centre.row) };
      this.landHeld = landSeen(projection, centre);
      const land = landAround(readTiles(projection), centre, LAND_REACH);
      const structures = readStructures(projection).filter(({ hex }) => inReach(hex, centre));
      const scene = await packLand(this.art, land, structures);
      if (this.destroyed) return;
      // One renderer owns the canvas at a time: the last frame stays on it while the next land starts.
      this.renderer?.free();
      this.renderer = null;
      const started = await this.module.MapRenderer.start(
        this.canvas,
        scene.table,
        scene.buffer,
        TERRAIN_HEX_HORIZONTAL_SPACING,
        TERRAIN_HEX_VERTICAL_SPACING,
        resolveRendererBuildModeFromSearch({
          envBuildMode: env.VITE_PUBLIC_RENDERER_BUILD_MODE,
          search: window.location.search,
        }) === "webgpu-force-webgl",
        QUALITY,
      );
      if (this.destroyed) return started.free();
      this.renderer = started;
      this.marches.forget();
      this.placeArmies(projection);
      this.selection?.showOrder();
    } finally {
      this.building = false;
    }
  }

  /** Follows the facts: armies are placed again as they change; tiles and structures bring a new land, once still. */
  private followFacts(projection: WorldSpatialProjection): void {
    this.unsubscribe.push(
      projection.subscribeArmies(() => this.placeArmies(projection)),
      projection.subscribeTiles(() => this.landChanged(projection)),
      projection.subscribeStructures(() => this.landChanged(projection)),
    );
  }

  private landChanged(projection: WorldSpatialProjection): void {
    if (this.landTimer !== null) window.clearTimeout(this.landTimer);
    this.landTimer = window.setTimeout(() => {
      this.landTimer = null;
      // Facts are published for the whole world: only a change within the land held brings a new one.
      if (this.landHeld === landSeen(projection, this.landCentre)) return;
      void this.takeLand(projection, this.hexUnder(this.camera.target));
    }, LAND_SETTLE_MS);
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
      void this.takeLand(requireActiveGameSyncRuntime().requireWorldSpatialProjection(), under);
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

  /**
   * Tells the game's entry that the map stands, as today's map does. The realm view is not this renderer's to draw,
   * so an entry that waits for it is answered too: the page then shows this map under the realm's HUD.
   */
  private announceReady(): void {
    const readiness = usePlayRouteReadinessStore.getState();
    const token = getCurrentPlayRouteBootToken();
    readiness.markWorldmapReady(token);
    readiness.markWorldmapConverged(token);
    readiness.markHexReady(token);
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

/** What the facts tell of the land round a hex, as one comparable line: its explored tiles and its structures. */
function landSeen(projection: WorldSpatialProjection, centre: Hex): string {
  const tiles = readTiles(projection).filter((tile) => inReach(tile, centre)).length;
  const structures = readStructures(projection)
    .filter(({ hex }) => inReach(hex, centre))
    .map((structure) => `${structure.entityId}:${structure.occupierType}`);
  return `${tiles}|${structures.join(",")}`;
}

/** A drawn point as a point of the whole lattice, which does not move when the map's floating origin does. */
function absoluteOf(drawn: GroundPoint): GroundPoint {
  const origin = latticeToWorld(worldOrigin().col, worldOrigin().row);
  return { x: drawn.x + origin.x, z: drawn.z + origin.z };
}

function drawnOf(absolute: GroundPoint): GroundPoint {
  const origin = latticeToWorld(worldOrigin().col, worldOrigin().row);
  return { x: absolute.x - origin.x, z: absolute.z - origin.z };
}
