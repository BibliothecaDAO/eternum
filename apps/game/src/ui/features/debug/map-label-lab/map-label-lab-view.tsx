import { getTroopResourceId } from "@bibliothecadao/eternum";
import { StructureType, type ID } from "@bibliothecadao/types";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Vector3 } from "three";

import { createMapLabelFixture, type MapLabelEntity } from "@/three/debug/map-label-lab-fixture";
import {
  mountProceduralTerrainBenchmarkRenderer,
  type TerrainBenchmarkStage,
} from "@/three/debug/procedural-terrain-benchmark-renderer";
import { MapPlateLayer, type MapPlateScope } from "@/three/map-plates/map-plate-layer";
import { buildArmyPlate, buildStructurePlate, type MapPlate } from "@/three/map-plates/map-plate-model";
import { PRODUCTION_TERRAIN_PROP_DENSITY_MULTIPLIER } from "@/three/terrain/terrain-props";

type MapZoom = "play" | "close";
type World = { stage: TerrainBenchmarkStage; entities: MapLabelEntity[] };

/**
 * The map label lab (`/lab/map-labels`): the map's plates (three/map-plates, the production layer the world map draws)
 * on the real map renderer, over a fixture world: 48 real realms in a dense block and real camp, rift, hyperstructure
 * and knight models between them. The address holds the view, so a capture is reproducible: `zoom` (play or close),
 * `hover` or `select` an entity by its id, `focus` one to centre the camera on it (a hovered one is centred too),
 * `busy=1` for an army beside every realm (a full Blitz in one view), and `rendererMode=webgpu-force-webgl` for WebGL.
 * Pointer hover on a tile and click work too; Escape clears the selection.
 */
export const MapLabelLabView = () => {
  const [params, setParams] = useSearchParams();
  const zoom: MapZoom = params.get("zoom") === "close" ? "close" : "play";
  const selected = params.get("select");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pointerHover, setPointerHover] = useState<string | null>(null);
  const [counts, setCounts] = useState({ plates: 0, nodes: 0 });
  const hovered = pointerHover ?? params.get("hover");
  const busy = params.get("busy") === "1";
  const forceWebGL = params.get("rendererMode") === "webgpu-force-webgl";
  useMapWorld(canvasRef, busy, forceWebGL, setWorld, setError);
  useZoom(world, zoom, params.get("focus") ?? params.get("hover"));
  usePlates(world, overlayRef, canvasRef, hovered, selected, setCounts);
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
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
        onPointerMove={(event) =>
          setPointerHover(tileUnder(world, canvasRef.current, event.nativeEvent.offsetX, event.nativeEvent.offsetY))
        }
        onPointerLeave={() => setPointerHover(null)}
        onClick={() => set("select", pointerHover)}
      />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-[2] overflow-hidden" />
      <aside className="absolute right-3 top-3 z-10 w-[19rem] rounded-lg border border-white/20 bg-black/90 p-3 text-sm text-white">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="w-16 opacity-80">Zoom</span>
          {(["play", "close"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === zoom}
              onClick={() => set("zoom", key)}
              className="rounded border border-white/25 px-2 py-0.5 aria-pressed:border-amber-300 aria-pressed:bg-amber-300/15"
            >
              {key === "play" ? "Play" : "Close"}
            </button>
          ))}
        </div>
        <p className="leading-snug opacity-90">
          The production plates (three/map-plates). Hover a tile to open its plate; click to select it.
        </p>
        <p className="mt-2 opacity-80" data-role="label-counts">
          {counts.plates} plates · {counts.nodes} DOM nodes
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
  overlayRef: React.RefObject<HTMLDivElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  hovered: string | null,
  selected: string | null,
  setCounts: (counts: { plates: number; nodes: number }) => void,
) => {
  const [layer, setLayer] = useState<{ layer: MapPlateLayer; scopes: Record<"army" | "structure", MapPlateScope> }>();
  useEffect(() => {
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!world || !overlay || !canvas) return;
    const plates = new MapPlateLayer(() => overlay);
    const scopes = { army: plates.createScope("army"), structure: plates.createScope("structure") };
    for (const entity of world.entities) {
      scopes[entity.kind === "army" ? "army" : "structure"].setLabel({
        entityId: entity.entityId,
        position: entity.anchor,
        plate: plateOf(entity),
      });
    }
    let frame = 0;
    const tick = () => {
      plates.update(world.stage.camera, canvas.clientWidth, canvas.clientHeight);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const counter = window.setInterval(() => setCounts({ plates: plates.plateCount, nodes: plates.domNodeCount }), 500);
    setLayer({ layer: plates, scopes });
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(counter);
      plates.dispose();
      setLayer(undefined);
    };
  }, [world, overlayRef, canvasRef, setCounts]);
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
};

const STRUCTURE_TYPES = {
  realm: StructureType.Realm,
  camp: StructureType.Camp,
  rift: StructureType.Mine,
  hyperstructure: StructureType.Hyperstructure,
} as const;

const CATEGORY = { crossbowman: "Crossbowman", knight: "Knight", paladin: "Paladin" } as const;

/** A fixture thing as the world map's managers would hand it to the layer: their own builders, their own fields. */
const plateOf = (entity: MapLabelEntity): MapPlate => {
  const owner = { address: entity.owner === null ? 0n : 1n, ownerName: entity.owner ?? "", guildName: "" };
  const isMine = entity.relation === "own";
  const isAlly = entity.relation === "ally";
  if (entity.kind === "army" && entity.army) {
    const { troops, stamina, staminaMax } = entity.army;
    return buildArmyPlate(
      {
        entityId: entity.entityId,
        isMine,
        isAlly,
        owner,
        category: CATEGORY[troops.type],
        tier: `T${troops.tier}`,
        troopCount: troops.count,
        currentStamina: stamina,
        maxStamina: staminaMax,
      },
      entity.homeName,
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
      owner,
      guardArmies: entity.guards.map((slot, index) => ({
        slot: index,
        category: CATEGORY[slot.type],
        tier: slot.tier,
        count: slot.count,
      })),
      incomingTroopArrivals: (entity.arrivals ?? []).map((arrival) => ({
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
const ZOOM_DISTANCE: Record<MapZoom, number> = { play: 22, close: 12 };
const PITCH = Math.PI / 3;

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
