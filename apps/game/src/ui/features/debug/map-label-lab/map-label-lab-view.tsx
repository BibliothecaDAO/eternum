import { getTroopResourceId } from "@bibliothecadao/eternum";
import { StructureType, type ID } from "@bibliothecadao/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Vector3 } from "three";

import {
  createMapLabelFixture,
  PLATE_CLEARANCE,
  SEATS,
  type MapLabelEntity,
} from "@/three/debug/map-label-lab-fixture";
import { WORLDMAP_CAMERA_ZOOM } from "@/three/scenes/worldmap-camera-view-profile";
import {
  mountProceduralTerrainBenchmarkRenderer,
  type TerrainBenchmarkStage,
} from "@/three/debug/procedural-terrain-benchmark-renderer";
import { MapPlateLayer, type MapPlateScope } from "@/three/map-plates/map-plate-layer";
import { orderLineSize } from "@/three/map-plates/map-plate-layout";
import { PointerOrderTip } from "@/three/scenes/worldmap-order-tip";
import { Tooltip } from "@/ui/design-system/molecules/tooltip";
import { buildArmyPlate, buildStructurePlate, guardsToTell, type MapPlate } from "@/three/map-plates/map-plate-model";
import { PRODUCTION_TERRAIN_PROP_DENSITY_MULTIPLIER } from "@/three/terrain/terrain-props";
import { seatSide } from "@/tokens";
import { SeatMark } from "@/ui/design-system/seat-mark";

import { SiteUseLab } from "./site-use-lab";
import { drawPathStudy, PATH_STUDIES, studyFocus, type PathStudy } from "./path-study";

type MapZoom = "play" | "close" | "far";
type World = { stage: TerrainBenchmarkStage; entities: MapLabelEntity[] };

/**
 * The map label lab (`/lab/map-labels`): the map's labels (three/map-plates, the production layer the world map draws)
 * on the real map renderer, over a fixture world: 48 real realms in a dense block and real camp, rift, hyperstructure
 * and knight models between them. Every thing is its token; its plate opens in the token's place on hover or selection
 * (the owner's plan D). The address holds the view, so a capture is reproducible: `zoom` (play, close or far), `hover` or
 * `select` an entity by its id, `battle` one to put it in battle, `focus` one to centre the camera on it (a hovered one is
 * centred too), `busy=1` for an army beside every realm (a full Blitz in one view), `game=frontier` for a Frontier world
 * (no guard slots: a realm holds no guard and nothing marches home to it), `panel=0` to hide the lab's panel (for a
 * phone), `spectate=1` for a watching viewer (each player in their seat's colour with their initial, the seats listed
 * in the panel: the game's rule, `seatSide`, over the fixture's 24 seats), and `rendererMode=webgpu-force-webgl` for
 * WebGL. Pointer hover on a tile and click work too; Escape clears the selection. `sites=1` puts an army with a Shrine and
 * a Well beside it west of the block, under the world map's own input and handlers (site-use-lab).
 * With a thing selected, the hovered tile shows the map's order line ("Attack", or "Transfer troops" on the player's
 * own), said and placed as the world map says and places it.
 */
export const MapLabelLabView = () => {
  const [params, setParams] = useSearchParams();
  const zoom: MapZoom = params.get("zoom") === "close" ? "close" : params.get("zoom") === "far" ? "far" : "play";
  const selected = params.get("select");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pointerHover, setPointerHover] = useState<string | null>(null);
  const [counts, setCounts] = useState({ labels: 0, nodes: 0 });
  const hovered = pointerHover ?? params.get("hover");
  const busy = params.get("busy") === "1";
  const forceWebGL = params.get("rendererMode") === "webgpu-force-webgl";
  const frontier = params.get("mode") === "frontier";
  const sites = params.get("sites") === "1";
  // The HUD's sheet stands where the labels' panel does: the sites view leaves it the place.
  const panel = params.get("panel") !== "0" && !sites;
  const spectate = params.get("spectate") === "1";
  useMapWorld(canvasRef, busy, forceWebGL, setWorld, setError);
  useZoom(world, zoom, params.get("focus") ?? params.get("hover"));
  usePathStudy(world, zoom, pathStudyOf(params.get("paths")), params.get("focus") ?? params.get("hover"));
  const layer = usePlates(
    world,
    frontier,
    spectate,
    params.get("battle"),
    overlayRef,
    canvasRef,
    hovered,
    selected,
    setCounts,
  );
  useOrderLine(world, layer, overlayRef, hovered, selected);
  // The sites open at the map's play distance, once placed; the zoom buttons aim the camera after.
  const aimAt = useCallback((target: Vector3) => world && aimCamera(world, target, ZOOM_DISTANCE.play), [world]);
  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  useEffect(() => {
    const clear = (event: KeyboardEvent) => event.key === "Escape" && set("select", null);
    window.addEventListener("keydown", clear);
    return () => window.removeEventListener("keydown", clear);
  });
  return (
    <div className="relative h-full min-h-[600px] w-full overflow-hidden bg-[#d8d0ba]">
      {/* The map's canvas, as the world map names it: its screen projection reads it by this id. With `sites=1` the
          world map's own input takes it; otherwise a click or a tap selects the tile under it, read from the event
          itself (a tap brings no pointer move before it); the labels take none (owner, 2026-10-20: "we click the tile"). */}
      <canvas
        ref={canvasRef}
        id="main-canvas"
        className="absolute inset-0 size-full"
        onPointerMove={
          sites
            ? undefined
            : (event) =>
                setPointerHover(
                  tileUnder(world, canvasRef.current, event.nativeEvent.offsetX, event.nativeEvent.offsetY),
                )
        }
        onPointerLeave={sites ? undefined : () => setPointerHover(null)}
        onClick={
          sites
            ? undefined
            : (event) =>
                set("select", tileUnder(world, canvasRef.current, event.nativeEvent.offsetX, event.nativeEvent.offsetY))
        }
      />
      {sites && <SiteUseLab world={world} canvasRef={canvasRef} plates={layer} aim={aimAt} />}
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-[2] overflow-hidden" />
      <Tooltip />
      <aside
        hidden={!panel}
        className="absolute right-3 top-3 z-10 w-[19rem] rounded-lg border border-white/20 bg-black/90 p-3 text-sm text-white"
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="w-16 opacity-80">Zoom</span>
          {(["play", "close", "far"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === zoom}
              onClick={() => set("zoom", key)}
              className="rounded border border-white/25 px-2 py-0.5 aria-pressed:border-amber-300 aria-pressed:bg-amber-300/15"
            >
              {key === "play" ? "Play" : key === "close" ? "Close" : "Far"}
            </button>
          ))}
        </div>
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="w-16 opacity-80">Viewer</span>
          {([false, true] as const).map((watching) => (
            <button
              key={String(watching)}
              type="button"
              aria-pressed={watching === spectate}
              onClick={() => set("spectate", watching ? "1" : null)}
              className="rounded border border-white/25 px-2 py-0.5 aria-pressed:border-amber-300 aria-pressed:bg-amber-300/15"
            >
              {watching ? "Spectating" : "Playing"}
            </button>
          ))}
        </div>
        {spectate && (
          <ol data-role="seats" className="mb-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
            {SEATS.map((name, seat) => (
              <li key={name} className="flex items-center gap-1.5">
                <SeatMark side={seatSide(seat)} name={name} />
                {name}
              </li>
            ))}
          </ol>
        )}
        <p className="leading-snug opacity-90">
          Every thing is its token; hover a tile to open its plate in the token's place, click to select it.
        </p>
        <p className="mt-2 opacity-80" data-role="label-counts">
          {counts.labels} labels · {counts.nodes} DOM nodes
        </p>
      </aside>
      {error && <p className="absolute left-4 top-4 z-10 rounded bg-black/80 p-3 text-red-300">{error}</p>}
      {!world && !error && (
        <p role="status" className="absolute left-4 top-4 z-10 rounded bg-black/70 p-3 text-white">
          Loading the map…
        </p>
      )}
    </div>
  );
};

/** The benchmark's terrain and realms, with the label fixture placed on them; disposed on leaving. */
const useMapWorld = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  busy: boolean,
  forceWebGL: boolean,
  setWorld: (world: World | null) => void,
  setError: (error: string) => void,
) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let release = () => {};
    // The first frame renders before the canvas is observed: size it first, so its depth buffer matches.
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    void (async () => {
      const handle = await mountProceduralTerrainBenchmarkRenderer({
        realms: true,
        autoRun: false,
        canvas,
        captureMode: false,
        densityMultiplier: PRODUCTION_TERRAIN_PROP_DENSITY_MULTIPLIER,
        explorationMode: "explored",
        forceWebGL,
        onReady: () => {},
        runMode: "quick",
        traceMode: "performance",
        variant: "production",
      });
      // A mount already left (development renders effects twice) builds nothing on its scene: the hyperstructure
      // model's shared resources would stay bound to that renderer's device.
      if (disposed) return handle.dispose();
      const fixture = await createMapLabelFixture(
        handle.stage.scene,
        handle.stage.terrain,
        handle.stage.realmPositions,
        {
          busy,
        },
      );
      release = () => {
        fixture.dispose();
        handle.dispose();
      };
      if (disposed) return release();
      setWorld({ stage: handle.stage, entities: fixture.entities });
    })().catch((error: unknown) => setError(error instanceof Error ? error.message : String(error)));
    return () => {
      disposed = true;
      release();
    };
  }, [canvasRef, busy, forceWebGL, setWorld, setError]);
};

/**
 * The fixture's things on the production layer, through the same scopes and plate builders the world map's managers
 * use: structures and armies each in their scope, the hovered tile's plate open, the selected one ringed.
 */
const usePlates = (
  world: World | null,
  frontier: boolean,
  spectate: boolean,
  battle: string | null,
  overlayRef: React.RefObject<HTMLDivElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  hovered: string | null,
  selected: string | null,
  setCounts: (counts: { labels: number; nodes: number }) => void,
) => {
  const [layer, setLayer] = useState<{ layer: MapPlateLayer; scopes: Record<"army" | "structure", MapPlateScope> }>();
  useEffect(() => {
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!world || !overlay || !canvas) return;
    const plates = new MapPlateLayer(() => overlay);
    const scopes = { army: plates.createScope("army"), structure: plates.createScope("structure") };
    let frame = 0;
    const tick = () => {
      plates.update(world.stage.camera, canvas.clientWidth, canvas.clientHeight);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const counter = window.setInterval(() => setCounts({ labels: plates.labelCount, nodes: plates.domNodeCount }), 500);
    setLayer({ layer: plates, scopes });
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(counter);
      plates.dispose();
      setLayer(undefined);
    };
  }, [world, overlayRef, canvasRef, setCounts]);
  // Every thing carries its label, at its label point, as the world map's managers hand theirs to the layer.
  useEffect(() => {
    if (!layer || !world) return;
    for (const entity of world.entities)
      layer.scopes[entity.kind === "army" ? "army" : "structure"].setLabel({
        entityId: entity.entityId,
        position: entity.anchor,
        // `battle` puts one thing in battle, as a battle cooldown does in the game: the map keeps it in view.
        plate: {
          ...plateOf(entity, frontier, spectate),
          ...(String(entity.entityId) === battle ? { inBattle: true } : {}),
        },
      });
  }, [layer, world, frontier, spectate, battle]);
  // The world the plate probe measures each label against (scripts/client-playtest/plates.mjs), as the game reports its
  // own through window.__gameRenderer: the camera, the canvas, each thing's tile, its model's top and its label point.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!world || !canvas) return;
    const page = window as { __mapLabelLab?: unknown };
    page.__mapLabelLab = {
      camera: world.stage.camera,
      canvas,
      things: world.entities.map((entity) => ({
        key: `${entity.kind === "army" ? "army" : "structure"}:${entity.entityId}`,
        tile: entity.ground,
        top: entity.anchor.clone().setY(entity.anchor.y - PLATE_CLEARANCE),
        point: entity.anchor,
      })),
    };
    return () => {
      delete page.__mapLabelLab;
    };
  }, [world, canvasRef]);
  useEffect(() => {
    if (!layer || !world) return;
    const entity = world.entities.find((candidate) => String(candidate.entityId) === hovered);
    layer.scopes.army.clearHover();
    layer.scopes.structure.clearHover();
    if (entity) layer.scopes[entity.kind === "army" ? "army" : "structure"].setHover(entity.entityId);
  }, [layer, world, hovered]);
  useEffect(() => {
    layer?.layer.setSelected(selected === null ? null : (Number(selected) as ID));
  }, [layer, selected]);
  return layer?.layer ?? null;
};

/**
 * The map's order line for the hovered tile while another thing is selected, said as the world map says it
 * (`PointerOrderTip`) and placed by the plate layer; the layer's place is on the overlay, the tooltip's on the page.
 */
const useOrderLine = (
  world: World | null,
  plates: MapPlateLayer | null,
  overlayRef: React.RefObject<HTMLDivElement | null>,
  hovered: string | null,
  selected: string | null,
) => {
  useEffect(() => {
    const overlay = overlayRef.current;
    const target = world?.entities.find((candidate) => String(candidate.entityId) === hovered);
    if (!world || !plates || !overlay || !target || selected === null || hovered === selected) return;
    const order =
      target.relation === "own" ? { line: "Transfer troops", cost: null } : { line: "Attack", cost: "30 stamina" };
    const point = new Vector3();
    /** A line beside the hovered thing, placed as the map's scene places its order line. */
    const placeBeside = (line: string, cost: string | null) => {
      point.copy(target.ground).project(world.stage.camera);
      const at = { x: ((point.x + 1) / 2) * overlay.clientWidth, y: ((1 - point.y) / 2) * overlay.clientHeight };
      const place = plates.placeOrderLine({ at, size: orderLineSize(line, cost) });
      const page = overlay.getBoundingClientRect();
      return place && { line, cost, at: { x: place.x + page.left, y: place.y + page.top } };
    };
    const tip = new PointerOrderTip(
      () => placeBeside(order.line, order.cost),
      () => plates.placeOrderLine(null),
      (_, line) => placeBeside(line, null),
    );
    tip.point({ col: 0, row: 0 });
    // The camera settles after the view opens: the line is said again, as the map's scene says it on a camera move.
    const timer = window.setInterval(() => tip.refresh(), 250);
    return () => {
      window.clearInterval(timer);
      tip.point(null);
    };
  }, [world, plates, overlayRef, hovered, selected]);
};

const STRUCTURE_TYPES = {
  realm: StructureType.Realm,
  camp: StructureType.Camp,
  rift: StructureType.Mine,
  hyperstructure: StructureType.Hyperstructure,
} as const;

const CATEGORY = { crossbowman: "Crossbowman", knight: "Knight", paladin: "Paladin" } as const;
/** The stamina one explore costs in the lab's world, as Frontier's rules set it: a segment of every stamina bar. */
const EXPLORE_STAMINA = 20;

/**
 * A fixture thing as the world map's managers would hand it to the layer: their own builders, their own fields. In a
 * Frontier world a realm or a hyperstructure holds no guard and no troops march home; its sites keep their guards.
 */
const plateOf = (entity: MapLabelEntity, frontier: boolean, spectate: boolean): MapPlate => {
  const settled = frontier && (entity.kind === "realm" || entity.kind === "hyperstructure");
  const owner = { address: entity.owner === null ? 0n : 1n, ownerName: entity.owner ?? "", guildName: "" };
  const isMine = entity.relation === "own";
  const isAlly = entity.relation === "ally";
  // A watching viewer's side, as the game's managers read it (`watchedSide`): the owner's seat among the fixture's.
  const watched = spectate ? seatSide(entity.owner === null ? null : SEATS.indexOf(entity.owner)) : null;
  if (entity.kind === "army" && entity.army) {
    const { troops, stamina, staminaMax } = entity.army;
    return buildArmyPlate(
      {
        entityId: entity.entityId,
        isMine,
        isAlly,
        watched,
        owner,
        category: CATEGORY[troops.type],
        tier: `T${troops.tier}`,
        troopCount: troops.count,
        currentStamina: stamina,
        maxStamina: staminaMax,
      },
      entity.homeName,
      EXPLORE_STAMINA,
    );
  }
  return buildStructurePlate(
    {
      entityId: entity.entityId,
      structureName: entity.name,
      structureType: STRUCTURE_TYPES[entity.kind as keyof typeof STRUCTURE_TYPES],
      mineKind: entity.kind === "rift" ? 1 : undefined,
      isMine,
      isAlly,
      watched,
      owner,
      guardArmies: guardsToTell(
        (settled ? [] : entity.guards).map((slot, index) => ({
          slot: index,
          category: CATEGORY[slot.type],
          tier: slot.tier,
          count: slot.count,
          // A guard slot's stamina, as the map would read it (getGuardStaminaSnapshot): some rested, some spent.
          stamina: { current: 20 + ((slot.count * 13 + index * 41) % 100), max: 120, perExplore: EXPLORE_STAMINA },
        })),
        !frontier,
      ),
      incomingTroopArrivals: ((settled ? undefined : entity.arrivals) ?? []).map((arrival) => ({
        structureEntityId: entity.entityId,
        resourceId: getTroopResourceId(CATEGORY[arrival.troops.type], `T${arrival.troops.tier}`),
        troopType: CATEGORY[arrival.troops.type],
        troopTier: `T${arrival.troops.tier}`,
        count: arrival.troops.count,
        arrivesAt: BigInt(arrival.secondsLeft),
        day: 0,
        slot: 0n,
      })),
    },
    0,
    entity.reward,
  );
};

/** The game's camera over the block: its 45° field and 60° pitch, at a play distance or close. */
/** `far` is the world map's farthest camera distance (WORLDMAP_CAMERA_ZOOM.maxDistance), where labels still show. */
const ZOOM_DISTANCE: Record<MapZoom, number> = { play: 22, close: 12, far: WORLDMAP_CAMERA_ZOOM.maxDistance };
const PITCH = Math.PI / 3;

/** The armies' paths study, when the address asks for one (`paths=walk|preview`). */
const pathStudyOf = (value: string | null): PathStudy | null => PATH_STUDIES.find((style) => style === value) ?? null;

/** The armies' paths study drawn on the world, the camera on its walks unless a focus is asked. */
const usePathStudy = (world: World | null, zoom: MapZoom, style: PathStudy | null, focus: string | null) => {
  useEffect(() => {
    if (!world || !style) return;
    return drawPathStudy(world.stage.scene, world.stage.terrain, world.entities, style);
  }, [world, style]);
  useEffect(() => {
    if (!world || !style || focus) return;
    aimCamera(world, studyFocus(world.entities), ZOOM_DISTANCE[zoom]);
  }, [world, style, zoom, focus]);
};

const useZoom = (world: World | null, zoom: MapZoom, focus: string | null) => {
  useEffect(() => {
    if (!world) return;
    const focused = world.entities.find((entity) => String(entity.entityId) === focus);
    aimCamera(world, focused ? focused.anchor.clone().setY(0) : centerOf(world.entities), ZOOM_DISTANCE[zoom]);
  }, [world, zoom, focus]);
};

const aimCamera = (world: World, target: Vector3, distance: number) => {
  const { camera, controls } = world.stage;
  camera.fov = 45;
  camera.updateProjectionMatrix();
  camera.position.copy(target).add(new Vector3(0, Math.sin(PITCH), Math.cos(PITCH)).multiplyScalar(distance));
  controls.target.copy(target);
  camera.lookAt(target);
  controls.update();
};

const centerOf = (entities: readonly MapLabelEntity[]) => {
  const realms = entities.filter((entity) => entity.kind === "realm");
  const sum = realms.reduce((total, entity) => total.add(entity.anchor), new Vector3());
  return sum.divideScalar(Math.max(1, realms.length)).setY(0);
};

/** A hex's inner radius in world units: the pointer within it is on the tile. */
const TILE_EDGE = new Vector3(Math.sqrt(3) / 2, 0, 0);

/** The thing whose tile the pointer is over: its hex on screen, not its plate. */
const tileUnder = (world: World | null, canvas: HTMLCanvasElement | null, x: number, y: number): string | null => {
  if (!world || !canvas) return null;
  const point = new Vector3();
  const toScreen = (at: Vector3) => {
    point.copy(at).project(world.stage.camera);
    return { x: ((point.x + 1) / 2) * canvas.clientWidth, y: ((1 - point.y) / 2) * canvas.clientHeight };
  };
  let best: { key: string; distance: number } | null = null;
  for (const entity of world.entities) {
    const tile = toScreen(entity.ground);
    const edge = toScreen(entity.ground.clone().add(TILE_EDGE));
    const distance = Math.hypot(tile.x - x, tile.y - y);
    if (distance < Math.hypot(edge.x - tile.x, edge.y - tile.y) && (!best || distance < best.distance))
      best = { key: String(entity.entityId), distance };
  }
  return best?.key ?? null;
};
