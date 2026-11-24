import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Matrix4,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  type Vector3,
} from "three";
import { WebGPURenderer } from "three/webgpu";

import { GameMapMaterialLibrary } from "@/three/effects/game-map-material-library";
import { WorldAtmosphereController } from "@/three/effects/world-atmosphere-controller";
import { configureWorldSunShadows } from "@/three/effects/world-sun-shadows";
import { createPipelineCompiler, type PipelineCompiler } from "@/three/pipeline-compiler";
import type { RendererSurfaceLike } from "@/three/renderer-backend";
import { configureRendererColorOutput } from "@/three/renderer-color-output";
import { HYPERSTRUCTURE_MODEL_PATH } from "@/three/structures/hyperstructure-design";
import { HyperstructureModel } from "@/three/structures/hyperstructure-model";
import { resolveStructureRotationY } from "@/three/structures/structure-orientation";
import { ProceduralTerrain } from "@/three/terrain/procedural-terrain";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import { TERRAIN_DEEP_FOG_COLOR } from "@/three/terrain/terrain-fog-style";
import { configureGltfTextureSupport } from "@/three/utils/utils";
import {
  ASPECT_HYPERSTRUCTURE_SEEDS,
  createAspectRaceTerrainRequests,
  frameAspectRaceCamera,
  projectRacePlateAnchors,
  RACE_DAYLIGHT_PROGRESS,
  RACE_TOWER_HEXES,
  type RaceTowerEntry,
  type TowerPlateAnchor,
} from "./aspect-race-world";

export interface AspectRaceRendererHandle {
  setStandings(entries: readonly RaceTowerEntry[], finishHeight: number): void;
  setPaused(paused: boolean): void;
  dispose(): void;
}

export interface MountAspectRaceRendererInput {
  canvas: HTMLCanvasElement;
  standings: readonly RaceTowerEntry[];
  finishHeight: number;
  onAnchors?(anchors: readonly TowerPlateAnchor[]): void;
  onReady?(): void;
  onError?(error: unknown): void;
}

interface RaceRendererSurface extends RendererSurfaceLike {
  library: GameMapMaterialLibrary;
  init(): Promise<void>;
  setAnimationLoop(callback: ((time: number) => void) | null): void;
  setClearColor(color: Color, alpha?: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  dispose(): Promise<void>;
}

type RaceRendererConstructor = new (options: {
  antialias: boolean;
  canvas: HTMLCanvasElement;
  forceWebGL: boolean;
}) => RaceRendererSurface;

interface RaceRuntime {
  renderer: RaceRendererSurface;
  scene: Scene;
  camera: PerspectiveCamera;
  terrain: ProceduralTerrain;
  atmosphere: WorldAtmosphereController;
  hyperstructures: HyperstructureModel;
  entries: readonly RaceTowerEntry[];
  finishHeight: number;
  paused: boolean;
  disposed: boolean;
}

const MAX_FRAME_DELTA_SECONDS = 0.05;
const SHADOW_MAP_SIZE = 1024;

const canvasTurns = new WeakMap<HTMLCanvasElement, Promise<void>>();

export async function mountAspectRaceRenderer(input: MountAspectRaceRendererInput): Promise<AspectRaceRendererHandle> {
  const previous = canvasTurns.get(input.canvas) ?? Promise.resolve();
  let release = () => {};
  canvasTurns.set(
    input.canvas,
    previous.then(() => new Promise<void>((resolve) => (release = resolve))),
  );
  await previous;
  try {
    return await mountOnCanvas(input, () => release());
  } catch (error) {
    release();
    throw error;
  }
}

async function mountOnCanvas(
  input: MountAspectRaceRendererInput,
  released: () => void,
): Promise<AspectRaceRendererHandle> {
  const runtime = await createRaceRuntime(input);
  const publishAnchors = () => {
    input.onAnchors?.(
      projectRacePlateAnchors(runtime.camera, runtime.entries, (x, z) => runtime.terrain.sampleSurface(x, z).height),
    );
  };
  const renderOnce = () => {
    if (runtime.disposed) return;
    runtime.renderer.render(runtime.scene, runtime.camera);
  };
  const syncLoop = () => setLoopActive(runtime, !runtime.paused, input.onError);

  const resizeObserver = observeCanvas(input.canvas, () => {
    resizeRaceView(input.canvas, runtime);
    publishAnchors();
    if (runtime.paused) renderOnce();
  });

  publishAnchors();
  renderOnce();
  syncLoop();
  input.onReady?.();

  return {
    setStandings: (entries, finishHeight) => {
      if (runtime.disposed) return;
      runtime.entries = entries;
      runtime.finishHeight = finishHeight;
      applyTowers(runtime.hyperstructures, runtime.terrain, entries, finishHeight);
      publishAnchors();
      if (runtime.paused) renderOnce();
    },
    setPaused: (paused) => {
      if (runtime.disposed || runtime.paused === paused) return;
      runtime.paused = paused;
      syncLoop();
    },
    dispose: () => {
      if (runtime.disposed) return;
      runtime.disposed = true;
      runtime.renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      runtime.hyperstructures.group.removeFromParent();
      runtime.hyperstructures.dispose();
      runtime.terrain.dispose();
      runtime.atmosphere.dispose();
      void runtime.renderer.dispose().finally(released);
    },
  };
}

async function createRaceRuntime(input: MountAspectRaceRendererInput): Promise<RaceRuntime> {
  const [width, height] = canvasSize(input.canvas);
  const background = new Color(TERRAIN_DEEP_FOG_COLOR);
  const renderer = await createRenderer(input.canvas, width, height, background);

  const scene = new Scene();
  scene.background = background;
  const camera = new PerspectiveCamera(30, width / height, 0.1, 200);
  const target = frameAspectRaceCamera(camera);

  let terrain: ProceduralTerrain | null = null;
  let atmosphere: WorldAtmosphereController | null = null;
  let hyperstructures: HyperstructureModel | null = null;

  try {
    terrain = await createWorldTerrain();
    scene.add(terrain.object3d);
    atmosphere = createWorldLighting(scene, target);
    renderer.setClearColor(scene.background as Color, 1);
    const compile = createPipelineCompiler({ getRenderer: () => renderer, getCamera: () => camera });
    hyperstructures = await createHyperstructures(scene, compile);
    applyTowers(hyperstructures, terrain, input.standings, input.finishHeight);
    return {
      renderer,
      scene,
      camera,
      terrain,
      atmosphere,
      hyperstructures,
      entries: input.standings,
      finishHeight: input.finishHeight,
      paused: false,
      disposed: false,
    };
  } catch (error) {
    hyperstructures?.group.removeFromParent();
    hyperstructures?.dispose();
    terrain?.dispose();
    atmosphere?.dispose();
    await renderer.dispose();
    throw error;
  }
}

async function createRenderer(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  background: Color,
): Promise<RaceRendererSurface> {
  const Renderer = WebGPURenderer as unknown as RaceRendererConstructor;
  const setup = async (forceWebGL: boolean): Promise<RaceRendererSurface> => {
    const renderer = new Renderer({ canvas, antialias: true, forceWebGL });
    renderer.library = new GameMapMaterialLibrary();
    configureRendererColorOutput(renderer);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.setClearColor(background, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    await renderer.init();
    configureGltfTextureSupport(renderer as Parameters<typeof configureGltfTextureSupport>[0]);
    return renderer;
  };
  try {
    return await setup(false);
  } catch {
    return await setup(true);
  }
}

async function createWorldTerrain(): Promise<ProceduralTerrain> {
  const terrain = new ProceduralTerrain({ streaming: false, gameMode: "frontier" });
  try {
    await terrain.loadProps().catch((error: unknown) => {
      console.warn("[AspectRace] Optional procedural terrain props failed to load", error);
    });
    const prepared = await Promise.all(
      createAspectRaceTerrainRequests().map((request) => terrain.preparePageAsync(request)),
    );
    const fogMask = await terrain.prepareFogMaskAsync(prepared);
    terrain.present(prepared, fogMask);
    terrain.update(0);
    return terrain;
  } catch (error) {
    terrain.dispose();
    throw error;
  }
}

function createWorldLighting(scene: Scene, target: Vector3): WorldAtmosphereController {
  const ambient = new AmbientLight();
  const hemisphere = new HemisphereLight();
  const sun = new DirectionalLight();
  configureWorldSunShadows(sun, true, SHADOW_MAP_SIZE);
  scene.add(ambient, hemisphere, sun, sun.target);
  const fog = new Fog(TERRAIN_DEEP_FOG_COLOR, 36, 90);
  scene.fog = fog;
  const atmosphere = new WorldAtmosphereController(scene, sun, hemisphere, ambient, fog, "frontier");
  atmosphere.update(RACE_DAYLIGHT_PROGRESS, target, { snap: true, environment: "world" });
  return atmosphere;
}

async function createHyperstructures(scene: Scene, compile: PipelineCompiler): Promise<HyperstructureModel> {
  const model = new HyperstructureModel(RACE_TOWER_HEXES.length);
  try {
    await compile(model.group, scene);
    scene.add(model.group);
    return model;
  } catch (error) {
    model.dispose();
    throw error;
  }
}

function applyTowers(
  model: HyperstructureModel,
  terrain: ProceduralTerrain,
  entries: readonly RaceTowerEntry[],
  finishHeight: number,
): void {
  const count = Math.min(entries.length, RACE_TOWER_HEXES.length);
  model.setCount(count);
  const yaw = resolveStructureRotationY([HYPERSTRUCTURE_MODEL_PATH], 0);
  for (let index = 0; index < count; index += 1) {
    const entry = entries[index]!;
    const hex = RACE_TOWER_HEXES[index]!;
    const { x, z } = terrainHexToWorld(hex.col, hex.row);
    const y = terrain.sampleSurface(x, z).height;
    model.setMatrixAt(index, new Matrix4().makeRotationY(yaw).setPosition(x, y, z));
    const progress = finishHeight > 0 ? Math.max(0, Math.min(100, Math.round((entry.height / finishHeight) * 100))) : 0;
    model.setConstructionAt(index, {
      entityId: ASPECT_HYPERSTRUCTURE_SEEDS[entry.aspectId],
      progress,
      completed: entry.finished || (finishHeight > 0 && entry.height >= finishHeight),
    });
  }
}

function setLoopActive(runtime: RaceRuntime, active: boolean, onError?: (error: unknown) => void): void {
  if (!active || runtime.disposed) {
    runtime.renderer.setAnimationLoop(null);
    return;
  }
  let previousTime: number | null = null;
  runtime.renderer.setAnimationLoop((time) => {
    if (runtime.disposed || runtime.paused) {
      runtime.renderer.setAnimationLoop(null);
      return;
    }
    const delta =
      previousTime === null ? 0 : Math.min(MAX_FRAME_DELTA_SECONDS, Math.max(0, (time - previousTime) / 1000));
    previousTime = time;
    try {
      if (delta > 0) {
        runtime.terrain.update(delta);
        runtime.hyperstructures.updateAnimations(delta);
      }
      runtime.renderer.render(runtime.scene, runtime.camera);
    } catch (error) {
      runtime.renderer.setAnimationLoop(null);
      onError?.(error);
    }
  });
}

function observeCanvas(canvas: HTMLCanvasElement, onResize: () => void): ResizeObserver {
  const observer = new ResizeObserver(onResize);
  observer.observe(canvas);
  return observer;
}

function resizeRaceView(canvas: HTMLCanvasElement, runtime: RaceRuntime): void {
  if (runtime.disposed) return;
  const [width, height] = canvasSize(canvas);
  runtime.renderer.setSize(width, height, false);
  runtime.camera.aspect = width / height;
  runtime.camera.updateProjectionMatrix();
  frameAspectRaceCamera(runtime.camera);
}

function canvasSize(canvas: HTMLCanvasElement): [width: number, height: number] {
  const bounds = canvas.getBoundingClientRect();
  return [Math.max(1, Math.floor(bounds.width)), Math.max(1, Math.floor(bounds.height))];
}
