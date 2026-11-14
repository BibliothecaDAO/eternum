import { WorldUpdateListener } from "@bibliothecadao/eternum";
import { BUILDINGS_CENTER } from "@bibliothecadao/types";
import type { GameClientSetup, NativeFactChange, NativeRows } from "@bibliothecadao/eternum/game-client";
import { requireActiveGameSyncRuntime, type WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";

import { getCurrentPlayRouteBootToken, usePlayRouteReadinessStore } from "@/game-entry/play-route-readiness-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { watchPlayerNames } from "@/hooks/use-player-profile";
import { parsePlayRoute } from "@/play/navigation/play-route";
import { resolvePlayRouteTarget } from "@/play/navigation/play-route-target";
import { LOCAL_CAMERA_ZOOM } from "@/three/constants";
import { activeMapLayer } from "@/three/map-layer";
import { markPresentedResults, presentResult } from "@/three/presented-results";
import { resolveRendererBuildModeFromSearch } from "@/three/renderer-build-mode";
import { forgetCameraView, publishCameraView } from "@/three/scenes/worldmap-camera-view";
import { bindMapSelection } from "@/three/scenes/worldmap-map-selection";
import { TERRAIN_HEX_HORIZONTAL_SPACING, TERRAIN_HEX_VERTICAL_SPACING } from "@/three/terrain/terrain-coordinates";
import { latticeHexAt, latticeToWorld } from "@/three/utils/hex-lattice";
import { setWorldOrigin, worldHexAt, worldHexToWorld, worldOrigin } from "@/three/world-origin";

import { env } from "../../env";
import { ArmyMarches, TROOP_BUILDS } from "./army-marches";
import { landAround, type Hex } from "./land-from-facts";
import { MapArt } from "./map-art";
import { CAMERA_FAR, CAMERA_FOV, CAMERA_NEAR, cameraWorldMatrix, type GroundPoint, type MapCamera } from "./map-camera";
import {
  changedHexes,
  contractHexOf,
  normalizedHexOf,
  readArmies,
  readLandmarks,
  readStructures,
  readTiles,
} from "./map-facts";
import { MapInput } from "./map-input";
import { MapLabels } from "./map-labels";
import { MapSelection } from "./map-selection";
import { orderStops } from "./order-stops";
import type { MapRenderer } from "./renderer/map_client";
import { readArmyPlates, readStructurePlates } from "./plate-facts";
import { readRealm, type RealmLand } from "./realm-facts";
import { tapRealmHex } from "./realm-selection";
import { packLand, packRealm, placeOf, type PackedLand } from "./scene-from-land";
import { animalHomes, landRoamed } from "./wildlife-homes";
import { ANIMAL_SPECIES, Wildlife } from "./wildlife";
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
const NO_REALM_THERE = "No realm stands where the address points.";
/** How far the realm view's camera stands from the keep, and how near and far it may go: today's realm view's. */
const REALM_DISTANCE = { ...LOCAL_CAMERA_ZOOM };
const KEEP: Hex = { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] };
/** How often the map's animals decide what to do, in seconds. */
const WILDLIFE_ACTS_EVERY = 0.5;
/** How often the labels are said again, in seconds: stamina regenerates and a holding grows with no fact changing. */
const LABELS_SAID_EVERY = 1;
const START_DISTANCE = 22;
/** The renderer's quality tier: the middle one, which the phone bar was measured on. */
const QUALITY = "mid";

/**
 * The world map drawn by the map client's own renderer, from the game's facts: the spatial projection's tiles,
 * structures and armies. It stands where today's renderer stands in the game's renderer session, draws on the same
 * canvas id under the same HUD, and tells the same stores where the camera looks and what is picked. Where the
 * address names the realm view it draws that realm instead: its plots, its ground and its buildings. It is the page's
 * only renderer: what it does not draw yet is not drawn.
 */
export class MapClientRenderer {
  private canvas = document.createElement("canvas");
  private readonly marches = new ArmyMarches();
  private readonly wildlife = new Wildlife();
  /** Whether a point is ground the land's animals may walk on, and when they last acted. */
  private roams: (point: GroundPoint) => boolean = () => false;
  private wildlifeActedAt = 0;
  private readonly labels = new MapLabels();
  private labelsSaidAt = 0;
  /** The land in the renderer, for the heights its labels stand on. */
  private land: PackedLand | null = null;
  /** The realm in the renderer while the realm view is drawn, and where the map's camera stood before it. */
  private realm: RealmLand | null = null;
  private mapCamera: MapCamera | null = null;
  /** The realm view's hex of the address last answered; null when it named the map. */
  private realmAsked: Hex | null = null;
  /** Whether the map has been drawn on this page: until then the camera has no place on it to keep. */
  private mapStood = false;
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
      tap: (ground) => this.tapAt(ground),
      hover: (ground) =>
        this.labels.hover(ground && !this.realm ? this.thingOn(projection, this.hexUnder(ground)) : {}),
    });
    this.selection = new MapSelection(projection, this.setup.store, (stops) => this.renderer?.show_order(stops));
    this.unsubscribe.push(bindMapSelection(projection), () => this.selection?.dispose());
    window.addEventListener("resize", this.resize);
    for (const event of ROUTE_EVENTS) window.addEventListener(event, this.followRoute);
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
    for (const event of ROUTE_EVENTS) window.removeEventListener(event, this.followRoute);
    this.input?.dispose();
    for (const stop of this.unsubscribe.splice(0)) stop();
    this.renderer?.free();
    this.renderer = null;
    this.art?.dispose();
    this.labels.dispose();
    this.canvas.remove();
    forgetCameraView();
  }

  /** The address turned to the other view, or to another realm: what it names is drawn. */
  private readonly followRoute = (): void => {
    const asked = realmRoute();
    if (asked === this.realmAsked || (asked && this.realmAsked && sameHex(asked, this.realmAsked))) return;
    this.wantLand(requireActiveGameSyncRuntime().requireWorldSpatialProjection());
  };

  private tapAt(ground: GroundPoint): void {
    if (this.realm) tapRealmHex(this.realm, latticeHexAt(ground.x, ground.z));
    else this.selection?.tapAt(this.hexUnder(ground));
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

  /** Takes what the address names, the realm or the land round a hex, and starts the renderer on it. */
  private async takeLand(projection: WorldSpatialProjection, centre: Hex): Promise<void> {
    if (!this.art || !this.module) return;
    const route = realmRoute();
    this.realmAsked = route;
    const realm = route && readRealm(this.setup.store, projection, route);
    if (realm) return this.takeRealm(realm);
    if (route) this.tellNoRealm();
    if (this.realm) centre = this.leaveRealm();
    const lookedAt = this.renderer && this.mapStood ? absoluteOf(this.camera.target) : null;
    this.mapStood = true;
    const was = absoluteOf({ x: 0, z: 0 });
    setWorldOrigin(centre);
    const now = absoluteOf({ x: 0, z: 0 });
    this.marches.shift({ x: was.x - now.x, z: was.z - now.z });
    this.landCentre = centre;
    this.camera = { ...this.camera, target: lookedAt ? drawnOf(lookedAt) : worldHexToWorld(centre.col, centre.row) };
    const land = landAround(readTiles(projection), centre, LAND_REACH);
    const structures = readStructures(projection).filter(({ hex }) => inReach(hex, centre));
    const landmarks = readLandmarks(projection).filter(({ hex }) => inReach(hex, centre));
    const packed = await packLand(this.art, land, structures, landmarks);
    if (this.destroyed) return;
    // One renderer owns the canvas at a time: the last frame stays on it while the next land starts.
    this.renderer?.free();
    this.renderer = null;
    const started = await this.startRenderer(packed.scene);
    if (this.destroyed) return started.free();
    this.renderer = started;
    this.land = packed;
    this.marches.update(readArmies(projection, this.setup.store), this.seconds());
    this.showTroops(started);
    this.sayLabels(projection);
    this.roams = landRoamed(land);
    this.wildlife.settle(animalHomes(land), this.seconds());
    this.placeWildlife(started);
    this.selection?.showOrder();
  }

  /**
   * Takes a realm from the facts and starts the renderer on it, the camera on its keep. Nothing of the map goes
   * with it: no army, no animal, no label. The entry that asked for the realm view is told it stands.
   */
  private async takeRealm(realm: RealmLand): Promise<void> {
    const token = getCurrentPlayRouteBootToken();
    const packed = await packRealm(this.art!, realm);
    if (this.destroyed) return;
    this.renderer?.free();
    this.renderer = null;
    const started = await this.startRenderer(packed.scene);
    if (this.destroyed) return started.free();
    this.renderer = started;
    this.land = packed;
    this.presentBuildings(this.realm, realm);
    if (!this.realm) {
      this.mapCamera = this.mapStood ? this.camera : null;
      this.camera = { target: placeOf(KEEP), distance: REALM_DISTANCE.defaultDistance };
    }
    this.realm = realm;
    this.labels.showStructures([], packed);
    this.labels.showArmies([], NO_ARMIES, packed);
    this.showRealmPick();
    usePlayRouteReadinessStore.getState().markHexReady(token, realm.site);
  }

  /** Whether a change to the facts is to the realm drawn: one of its buildings, or its own level. */
  private changesRealmDrawn({ model, current, previous }: NativeFactChange): boolean {
    const id = this.realm && BigInt(this.realm.realmId);
    const row = current ?? previous;
    if (id === null || !row) return false;
    if (model === "Building") return (row as NativeRows["Building"]).structure_id === id;
    return model === "Structure" && (row as NativeRows["Structure"]).entity_id === id;
  }

  /** Lights the hex of the building or the plot picked in the realm drawn; nothing where none is. */
  private showRealmPick(): void {
    if (!this.realm) return;
    const picked = useUIStore.getState().selectedBuildingHex;
    const lit = picked?.structureId === this.realm.realmId;
    this.renderer?.show_order(orderStops(lit ? [placeOf({ col: picked.innerCol, row: picked.innerRow })] : []));
  }

  /** Marks, as today's realm view does, each building a realm's facts added or took away since it was last drawn. */
  private presentBuildings(before: RealmLand | null, now: RealmLand): void {
    if (before?.realmId !== now.realmId) return;
    const keyOf = (hex: Hex) => `${hex.col},${hex.row}`;
    const stood = new Set(before.buildings.map(keyOf));
    const stands = new Set(now.buildings.map(keyOf));
    for (const building of now.buildings) {
      if (!stood.has(keyOf(building))) presentResult(`building:${keyOf(building)}:${building.category}`);
    }
    for (const building of before.buildings) {
      if (!stands.has(keyOf(building))) presentResult(`building-gone:${keyOf(building)}`);
    }
  }

  /**
   * Back to the map, the realm's pick put away: the camera where the player left it, or on the realm's site when
   * the page opened on the realm view. Returns the hex the map's land is taken round.
   */
  private leaveRealm(): Hex {
    const site = normalizedHexOf(this.realm!.site);
    this.camera = this.mapCamera ?? { target: this.camera.target, distance: START_DISTANCE };
    const centre = this.mapCamera ? this.hexUnder(this.camera.target) : site;
    this.realm = null;
    this.mapCamera = null;
    useUIStore.getState().setSelectedBuildingHex(null);
    return centre;
  }

  /** An address that names the realm view where no realm answers is told so, as a scene that did not open is. */
  private tellNoRealm(): void {
    usePlayRouteReadinessStore
      .getState()
      .markSceneFailed(getCurrentPlayRouteBootToken(), "hex", new Error(NO_REALM_THERE));
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
      // Another layer is another land: the Surface, or the Ethereal under it.
      useUIStore.subscribe(
        (state) => state.mapLayer,
        () => this.wantLand(projection),
      ),
      projection.subscribeArmies(() => this.placeArmies(projection)),
      useUIStore.subscribe(
        (state) => state.selectedBuildingHex,
        () => this.showRealmPick(),
      ),
      // A realm drawn follows its buildings and its level.
      this.setup.store.subscribe((changes) => {
        if (changes.some((change) => this.changesRealmDrawn(change))) this.wantLand(projection);
      }),
      // A battle is an event, not a fact: its blows are a flourish over the armies the facts place.
      new WorldUpdateListener(this.setup).BattleEvent.onBattleUpdate(({ battleData }) =>
        this.showBattle(projection, battleData.attackerId, battleData.defenderId),
      ),
      // A player's name that lands is said by the labels at once.
      watchPlayerNames(() => this.sayLabels(projection)),
      useUIStore.subscribe(
        (state) => state.mapSelection,
        (picked) => this.labels.select(picked && picked.kind !== "hex" ? Number(picked.entityId) : null),
      ),
      projection.subscribeTiles(landChanged),
      projection.subscribeStructures(landChanged),
      projection.subscribeChests(landChanged),
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
    if (!this.renderer || this.realm) return;
    if (this.marches.update(readArmies(projection, this.setup.store), this.seconds())) this.showTroops(this.renderer);
    this.sayLabels(projection);
  }

  /** Gives the renderer every army as the marches now have it. */
  private showTroops(renderer: MapRenderer): void {
    for (const build of TROOP_BUILDS) renderer.set_troop(build, this.marches.instancesOf(build));
  }

  /**
   * A battle was fought: the attacker strikes at the defender where it stands, an army or a structure, and a
   * defending army strikes back. Nothing for an attacker or a defender the map does not hold.
   */
  private showBattle(projection: WorldSpatialProjection, attackerId: number, defenderId: number): void {
    if (!this.renderer || this.realm) return;
    const now = this.seconds();
    const armies = this.marches.positions(now);
    const attacker = armies.get(attackerId);
    const defender = armies.get(defenderId) ?? this.structurePlace(projection, defenderId);
    if (!attacker || !defender) return;
    const struck = [this.marches.strike(attackerId, defender, now), this.marches.strike(defenderId, attacker, now)];
    if (struck.includes(true)) this.showTroops(this.renderer);
  }

  /** Where a structure of the layer shown stands on the ground. */
  private structurePlace(projection: WorldSpatialProjection, entityId: number): GroundPoint | undefined {
    const structure = projection.getStructure(entityId);
    if (!structure || structure.hexCoords.alt !== activeMapLayer()) return undefined;
    const hex = normalizedHexOf(structure.hexCoords);
    return worldHexToWorld(hex.col, hex.row);
  }

  /** Says every label of the land held as the facts now have it. Unchanged words cost nothing. */
  private sayLabels(projection: WorldSpatialProjection): void {
    if (!this.land || this.realm) return;
    this.labelsSaidAt = this.seconds();
    const held = ({ hex }: { hex: Hex }) => inReach(hex, this.landCentre);
    const { store } = this.setup;
    this.labels.showStructures(readStructurePlates(projection, store).filter(held), this.land);
    this.labels.showArmies(
      readArmyPlates(projection, store).filter(held),
      this.marches.positions(this.labelsSaidAt),
      this.land,
    );
  }

  /** The army or the structure that stands on a hex, an army first, as a tap picks. */
  private thingOn(projection: WorldSpatialProjection, hex: Hex): { army?: number; structure?: number } {
    const at = { alt: activeMapLayer(), ...contractHexOf(hex) };
    const army = projection.getArmiesAtHex(at)[0];
    if (army) return { army: Number(army.entityId) };
    const structure = projection.getStandingStructureAtHex(at);
    return structure ? { structure: Number(structure.entityId) } : {};
  }

  /** Lets the animals act twice a second, and tells the renderer where each now walks, grazes or rests. */
  private placeWildlife(renderer: MapRenderer): void {
    this.wildlifeActedAt = this.seconds();
    const armies = [...this.marches.positions(this.wildlifeActedAt).values()];
    this.wildlife.update(this.wildlifeActedAt, armies, this.roams);
    for (const species of ANIMAL_SPECIES) renderer.set_troop(species, this.wildlife.instancesOf(species));
  }

  private lookAt(camera: MapCamera): void {
    if (this.realm) {
      // The realm view's camera stays on the keep: it only comes nearer or goes further.
      const { minDistance, maxDistance } = REALM_DISTANCE;
      this.camera = { ...this.camera, distance: Math.min(maxDistance, Math.max(minDistance, camera.distance)) };
      return;
    }
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
    if (!this.renderer || this.building || !this.land) return;
    if (!this.realm && this.seconds() - this.wildlifeActedAt >= WILDLIFE_ACTS_EVERY) this.placeWildlife(this.renderer);
    if (this.seconds() - this.labelsSaidAt >= LABELS_SAID_EVERY)
      this.sayLabels(requireActiveGameSyncRuntime().requireWorldSpatialProjection());
    const armies = this.realm ? NO_ARMIES : this.marches.positions(this.seconds());
    this.labels.frame(this.camera, armies, this.land);
    this.renderer.render(cameraWorldMatrix(this.camera), CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR, this.seconds());
    // What the frame drew of a player's action is marked now, as today's frame loop marks it.
    markPresentedResults();
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

const NO_ARMIES: ReadonlyMap<number, GroundPoint> = new Map();
const sameHex = (a: Hex, b: Hex): boolean => a.col === b.col && a.row === b.row;

/** The hex the address names for the realm view, as contracts count it; null while the address names the map. */
function realmRoute(): Hex | null {
  return resolvePlayRouteTarget(window.location).hexRealmPosition;
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
