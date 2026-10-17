import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Vector3 } from "three";

import { createMapLabelFixture, type MapLabelEntity } from "@/three/debug/map-label-lab-fixture";
import {
  mountProceduralTerrainBenchmarkRenderer,
  type TerrainBenchmarkStage,
} from "@/three/debug/procedural-terrain-benchmark-renderer";
import { PRODUCTION_TERRAIN_PROP_DENSITY_MULTIPLIER } from "@/three/terrain/terrain-props";

import "./map-label-lab.css";
import { MapPlates, PLATE_RULES, type MapZoom, type ProjectedEntity } from "./map-label-plates";
import { formatCount, strongestOwnArmy } from "./map-label-reading";

/**
 * The map label lab (`/lab/map-labels`): the owner's pick (plates that open, short code names) on the real map renderer,
 * over a fixture world (48 real realms in a dense block, real camp, rift, hyperstructure and knight models between them).
 * The address holds the view, so a capture is reproducible: `zoom` (play or close), `hover` or `select` an entity by its
 * id, and `focus` one to centre the camera on it (a hovered one is centred too). Pointer hover and click work too; Escape clears the selection.
 */
export const MapLabelLabView = () => {
  const [params, setParams] = useSearchParams();
  const zoom: MapZoom = params.get("zoom") === "close" ? "close" : "play";
  const selected = params.get("select");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [world, setWorld] = useState<{ stage: TerrainBenchmarkStage; entities: MapLabelEntity[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pointerHover, setPointerHover] = useState<string | null>(null);
  const hovered = pointerHover ?? params.get("hover");
  const items = useProjectedEntities(world, canvasRef.current);
  const mine = world ? strongestOwnArmy(world.entities) : 0;
  useMapWorld(canvasRef, setWorld, setError);
  useZoom(world, zoom, params.get("focus") ?? params.get("hover"));
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
        onPointerMove={(event) => setPointerHover(nearest(items, event.nativeEvent.offsetX, event.nativeEvent.offsetY))}
        onPointerLeave={() => setPointerHover(null)}
        onClick={() => set("select", pointerHover)}
      />
      <div className="mll">
        <MapPlates items={items} hovered={hovered} selected={selected} mine={mine} />
      </div>
      <LabPanel zoom={zoom} mine={mine} items={items} set={set} />
      {error && <p className="absolute left-4 top-4 z-10 rounded bg-black/80 p-3 text-red-300">{error}</p>}
      {!world && !error && (
        <p role="status" className="absolute left-4 top-4 z-10 rounded bg-black/70 p-3 text-white">
          Loading the map…
        </p>
      )}
    </div>
  );
};

/** The zoom, the system's rules, the yardstick, and how many things are on screen now. */
const LabPanel = ({
  zoom,
  mine,
  items,
  set,
}: {
  zoom: MapZoom;
  mine: number;
  items: readonly ProjectedEntity[];
  set: (key: string, value: string | null) => void;
}) => {
  return (
    <aside className="absolute right-3 top-3 z-10 w-[19rem] rounded-lg border border-white/20 bg-black/90 p-3 text-sm text-white">
      <Choice
        label="Zoom"
        value={zoom}
        options={{ play: { name: "Play" }, close: { name: "Close" } }}
        onPick={(value) => set("zoom", value)}
      />
      <dl className="mt-2 flex flex-col gap-1.5 leading-snug">
        <dt className="font-bold">At rest</dt>
        <dd>{PLATE_RULES.rest}</dd>
        <dt className="font-bold">At a glance</dt>
        <dd>
          {PLATE_RULES.standing} Your strongest army: {formatCount(mine)} (troops × 1 / 3 / 9 by tier).
        </dd>
        <dt className="font-bold">Hover</dt>
        <dd>{PLATE_RULES.hover}</dd>
        <dt className="font-bold">Selected</dt>
        <dd>{PLATE_RULES.selected}</dd>
      </dl>
      <p className="mt-2 opacity-80" data-role="label-counts">
        {items.length} on screen
      </p>
    </aside>
  );
};

const Choice = <T extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: Record<T, { name: string }>;
  onPick: (value: T) => void;
}) => (
  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
    <span className="w-16 opacity-80">{label}</span>
    {(Object.keys(options) as T[]).map((key) => (
      <button
        key={key}
        type="button"
        aria-pressed={key === value}
        onClick={() => onPick(key)}
        className="rounded border border-white/25 px-2 py-0.5 aria-pressed:border-amber-300 aria-pressed:bg-amber-300/15"
      >
        {options[key].name}
      </button>
    ))}
  </div>
);

/** The benchmark's terrain and realms, with the label fixture placed on them; disposed on leaving. */
const useMapWorld = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  setWorld: (world: { stage: TerrainBenchmarkStage; entities: MapLabelEntity[] } | null) => void,
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
        forceWebGL: false,
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
  }, [canvasRef, setWorld, setError]);
};

/** The game's camera over the block: its 45° field and 60° pitch, at a play distance or close. */
const ZOOM_DISTANCE: Record<MapZoom, number> = { play: 22, close: 12 };
const PITCH = Math.PI / 3;

const useZoom = (
  world: { stage: TerrainBenchmarkStage; entities: MapLabelEntity[] } | null,
  zoom: MapZoom,
  focus: string | null,
) => {
  useEffect(() => {
    if (!world) return;
    const { camera, controls } = world.stage;
    const focused = world.entities.find((entity) => String(entity.entityId) === focus);
    const target = focused ? focused.anchor.clone().setY(0) : centerOf(world.entities);
    camera.fov = 45;
    camera.updateProjectionMatrix();
    const offset = new Vector3(0, Math.sin(PITCH), Math.cos(PITCH)).multiplyScalar(ZOOM_DISTANCE[zoom]);
    camera.position.copy(target).add(offset);
    controls.target.copy(target);
    camera.lookAt(target);
    controls.update();
  }, [world, zoom, focus]);
};

const centerOf = (entities: readonly MapLabelEntity[]) => {
  const realms = entities.filter((entity) => entity.kind === "realm");
  const sum = realms.reduce((total, entity) => total.add(entity.anchor), new Vector3());
  return sum.divideScalar(Math.max(1, realms.length)).setY(0);
};

/** Each entity's anchor projected to the canvas, refreshed on every frame the camera moved. */
const useProjectedEntities = (
  world: { stage: TerrainBenchmarkStage; entities: MapLabelEntity[] } | null,
  canvas: HTMLCanvasElement | null,
): ProjectedEntity[] => {
  const [items, setItems] = useState<ProjectedEntity[]>([]);
  useEffect(() => {
    if (!world || !canvas) return;
    let frame = 0;
    let last = "";
    const point = new Vector3();
    const tick = () => {
      const { camera } = world.stage;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const signature = `${camera.matrixWorld.elements.join(",")}:${width}:${height}`;
      if (signature !== last) {
        last = signature;
        setItems(
          world.entities.flatMap((entity) => {
            point.copy(entity.anchor).project(camera);
            const x = ((point.x + 1) / 2) * width;
            const y = ((1 - point.y) / 2) * height;
            const onScreen = point.z < 1 && x > -40 && x < width + 40 && y > -40 && y < height + 40;
            return onScreen ? [{ key: String(entity.entityId), entity, x, y }] : [];
          }),
        );
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [world, canvas]);
  return items;
};

/** The entity whose label anchor is nearest the pointer, within a hex's reach on screen. */
const nearest = (items: readonly ProjectedEntity[], x: number, y: number): string | null => {
  let best: { key: string; distance: number } | null = null;
  for (const item of items) {
    const distance = Math.hypot(item.x - x, item.y + 18 - y);
    if (distance < 40 && (!best || distance < best.distance)) best = { key: item.key, distance };
  }
  return best?.key ?? null;
};
